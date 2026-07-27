"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gift,
  Plus,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";
import GiftCardTxTable, {
  CardTransaction,
  CardOwnerInfo,
} from "./GiftCardTxTable";
import GiftCardFeed from "./GiftCardFeed";

interface GiftCard {
  ref_id: string;
  name: string;
  card_number: string;
  currency: string;
  status: number;
  last_four?: string;
  available_amount: number;
  created_at: string;
}

interface PayoutBank {
  slug: string;
  name: string;
  type?: string;
  currencies?: string[];
  acct_length?: number | null;
  is_mobilemoney?: boolean;
}

// CardTransaction / CardOwnerInfo types live in GiftCardTxTable

const CARD_STATUS: Record<number, { label: string; className: string }> = {
  1: {
    label: "active",
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  },
  3: {
    label: "disabled",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

const cardStatus = (status: number) =>
  CARD_STATUS[status] || {
    label: `status ${status}`,
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900",
  };

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// The Link API stores every monetary value in cents (balance 1000 = 10.00 ETB),
// confirmed against real payments. Convert on display and multiply user input
// by 100 before sending.
const formatCents = (cents: number, currency: string) =>
  formatMoney((Number(cents) || 0) / 100, currency);

const birrToCents = (major: string | number) =>
  Math.round(Number(major) * 100);

// Direct-charge wallets supported by Chapa Link (docs only guarantee telebirr;
// the others mirror the main API's mobile-money slugs)
const WALLET_SLUGS = ["telebirr", "mpesa", "cbebirr"];

export default function GiftCardsSection() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [notActivated, setNotActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [phoneSearch, setPhoneSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    currency: "ETB",
  });
  const [creating, setCreating] = useState(false);

  // Top-up dialog
  const [topUpCard, setTopUpCard] = useState<GiftCard | null>(null);
  const [topUpForm, setTopUpForm] = useState({
    type: "hosted",
    amount: "",
    phone_number: "",
    payment_method: "telebirr",
  });
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Payout dialog
  const [payoutCard, setPayoutCard] = useState<GiftCard | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    destination: "bank",
    amount: "",
    bank_slug: "",
    account_number: "",
    account_name: "",
    destination_card_number: "",
    merchant_id: "",
  });
  const [payoutBusy, setPayoutBusy] = useState(false);

  // Payout institutions (slug + full name), fetched from Chapa on first use
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [banksLoaded, setBanksLoaded] = useState(false);

  const fetchBanks = useCallback(async () => {
    if (banksLoaded) return;
    try {
      const res = await adminApi.get("/admin/finance/chapa/giftcards/banks");
      if (res.status === "success" && Array.isArray(res.data)) {
        setBanks(res.data);
        setBanksLoaded(true);
      }
    } catch {
      // Selector falls back to a free-text slug input when the list is empty
    }
  }, [banksLoaded]);

  // Cancel confirmation
  const [cancelCard, setCancelCard] = useState<GiftCard | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Transaction history dialog
  const [historyCard, setHistoryCard] = useState<GiftCard | null>(null);
  const [history, setHistory] = useState<CardTransaction[]>([]);
  const [historyOwner, setHistoryOwner] = useState<CardOwnerInfo | null>(null);
  const [historyTruncated, setHistoryTruncated] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (card: GiftCard) => {
    setHistoryCard(card);
    setHistory([]);
    setHistoryOwner(null);
    setHistoryTruncated(false);
    setHistoryLoading(true);
    try {
      const res = await adminApi.get(
        `/admin/finance/chapa/giftcards/${card.card_number}/transactions`
      );
      if (res.status === "success") {
        setHistory(res.data.transactions || []);
        setHistoryOwner(res.data.owner || null);
        setHistoryTruncated(!!res.data.truncated);
      } else {
        throw new Error(res.message || "Failed to load card history");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (phoneSearch.trim()) params.set("phone_number", phoneSearch.trim());
      const res = await adminApi.get(
        `/admin/finance/chapa/giftcards?${params.toString()}`
      );
      if (res.status === "success") {
        setNotActivated(false);
        setCards(res.data.items || []);
        setPages(res.data.pages || 1);
        setTotal(res.data.total || 0);
      } else if (res.linkNotActivated) {
        setNotActivated(true);
      } else {
        throw new Error(res.message || "Failed to load gift cards");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, phoneSearch]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCreate = async () => {
    if (!createForm.phone_number.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setCreating(true);
    try {
      const res = await adminApi.post("/admin/finance/chapa/giftcards", {
        ...createForm,
        first_name: createForm.first_name.trim() || undefined,
        last_name: createForm.last_name.trim() || undefined,
        phone_number: createForm.phone_number.trim(),
      });
      if (res.status === "success") {
        toast.success(
          `Gift card created — card number ${res.data?.card_number}`
        );
        setCreateOpen(false);
        setCreateForm({
          first_name: "",
          last_name: "",
          phone_number: "",
          currency: "ETB",
        });
        fetchCards();
      } else {
        throw new Error(res.message || "Failed to create gift card");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (card: GiftCard) => {
    const action = card.status === 1 ? "disable" : "enable";
    setRowBusy(card.card_number);
    try {
      const res = await adminApi.patch(
        `/admin/finance/chapa/giftcards/${card.card_number}`,
        { status: action }
      );
      if (res.status === "success") {
        toast.success(res.message || `Card ${action}d`);
        fetchCards();
      } else {
        throw new Error(res.message || `Failed to ${action} card`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelCard) return;
    setRowBusy(cancelCard.card_number);
    try {
      const res = await adminApi.delete(
        `/admin/finance/chapa/giftcards/${cancelCard.card_number}`
      );
      if (res.status === "success") {
        toast.success(res.message || "Gift card cancelled");
        fetchCards();
      } else {
        throw new Error(res.message || "Failed to cancel card");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowBusy(null);
      setCancelCard(null);
    }
  };

  const handleTopUp = async () => {
    if (!topUpCard) return;
    setTopUpBusy(true);
    setCheckoutUrl(null);
    try {
      const res = await adminApi.post(
        `/admin/finance/chapa/giftcards/${topUpCard.card_number}/topup`,
        {
          type: topUpForm.type,
          // User types birr; the Link API expects cents
          amount: birrToCents(topUpForm.amount),
          phone_number:
            topUpForm.type === "direct-charge"
              ? topUpForm.phone_number.trim()
              : undefined,
          payment_method:
            topUpForm.type === "direct-charge"
              ? topUpForm.payment_method
              : undefined,
        }
      );
      if (res.status === "success") {
        if (topUpForm.type === "hosted" && res.data?.checkout_url) {
          setCheckoutUrl(res.data.checkout_url);
          toast.success("Checkout link ready — share it or open it to pay");
        } else {
          toast.success(
            `Charge initiated (${res.data?.link_reference}). Customer approves via USSD; balance updates once the payment succeeds.`
          );
          setTopUpCard(null);
        }
      } else {
        throw new Error(res.message || "Top-up failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTopUpBusy(false);
    }
  };

  const handlePayout = async () => {
    if (!payoutCard) return;
    setPayoutBusy(true);
    try {
      const body: Record<string, unknown> = {
        // User types birr; the Link API expects cents
        amount: birrToCents(payoutForm.amount),
      };
      if (payoutForm.destination === "bank") {
        body.bank_slug = payoutForm.bank_slug.trim();
        body.account_number = payoutForm.account_number.trim();
        body.account_name = payoutForm.account_name.trim();
      } else if (payoutForm.destination === "card") {
        body.destination_card_number =
          payoutForm.destination_card_number.trim();
      } else {
        body.merchant_id = payoutForm.merchant_id.trim();
      }
      const res = await adminApi.post(
        `/admin/finance/chapa/giftcards/${payoutCard.card_number}/payouts`,
        body
      );
      if (res.status === "success") {
        toast.success(
          payoutForm.destination === "bank"
            ? "Payout initiated — bank transfers settle asynchronously (PENDING until processed)"
            : "Payout completed"
        );
        setPayoutCard(null);
        fetchCards();
      } else {
        throw new Error(res.message || "Payout failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPayoutBusy(false);
    }
  };

  if (notActivated) {
    return (
      <Card className="border-yellow-300 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Chapa Link is not activated yet
          </CardTitle>
          <CardDescription>
            Gift cards are powered by Chapa Link (api.chapa.link), which needs
            its own API key — your regular Chapa secret key does not work
            there.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Note: API keys generated from the dashboard permissions screen
            (CHAPA_LIVE_PRIV_…) are v2 payment-API keys — they do not unlock
            gift cards. There is no gift-card permission there.
          </p>
          <p>
            1. Contact your Chapa account manager (or support) and ask them to
            activate the <strong>Link app</strong> for your merchant account.
            They will issue a test key and a live key.
          </p>
          <p>
            2. Add the key to the backend environment as{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              CHAPA_LINK_API_KEY
            </code>{" "}
            and restart the backend.
          </p>
          <p>3. Reload this page — the gift card tools will appear here.</p>
          <Button variant="outline" size="sm" onClick={fetchCards}>
            <RefreshCw className="mr-2 h-4 w-4" /> Check again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" /> Gift cards
              </CardTitle>
              <CardDescription>
                Chapa Link stored-value cards — create, top up, withdraw,
                disable or cancel
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by phone (9…)"
                value={phoneSearch}
                onChange={(e) => {
                  setPhoneSearch(e.target.value);
                  setPage(1);
                }}
                className="w-[180px]"
              />
              <Button variant="outline" size="icon" onClick={fetchCards}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New gift card
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Card number</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : cards.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No gift cards yet — create the first one
                    </TableCell>
                  </TableRow>
                ) : (
                  cards.map((card) => {
                    const status = cardStatus(card.status);
                    const busy = rowBusy === card.card_number;
                    return (
                      <TableRow key={card.ref_id}>
                        <TableCell className="text-sm">{card.name}</TableCell>
                        <TableCell>
                          <button
                            className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                            onClick={() => {
                              navigator.clipboard.writeText(card.card_number);
                              toast.success("Card number copied");
                            }}
                            title="Copy card number"
                          >
                            {card.card_number}
                            <Copy className="h-3 w-3 opacity-60" />
                          </button>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCents(card.available_amount, card.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={status.className}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(card.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => openHistory(card)}
                            >
                              <History className="mr-1 h-3.5 w-3.5" />
                              History
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || card.status !== 1}
                              onClick={() => {
                                setTopUpForm({
                                  type: "hosted",
                                  amount: "",
                                  phone_number: "",
                                  payment_method: "telebirr",
                                });
                                setCheckoutUrl(null);
                                setTopUpCard(card);
                              }}
                            >
                              <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
                              Top up
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                busy ||
                                card.status !== 1 ||
                                card.available_amount <= 0
                              }
                              onClick={() => {
                                setPayoutForm({
                                  destination: "bank",
                                  amount: "",
                                  bank_slug: "",
                                  account_number: "",
                                  account_name: card.name || "",
                                  destination_card_number: "",
                                  merchant_id: "",
                                });
                                fetchBanks();
                                setPayoutCard(card);
                              }}
                            >
                              <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
                              Withdraw
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleToggleStatus(card)}
                            >
                              {card.status === 1 ? (
                                <>
                                  <Ban className="mr-1 h-3.5 w-3.5" /> Disable
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{" "}
                                  Enable
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              onClick={() => setCancelCard(card)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages} · {total} cards
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account-wide searchable transaction feed */}
      <GiftCardFeed />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New gift card</DialogTitle>
            <DialogDescription>
              One card per currency per customer. Name is required only if the
              phone number is new to Chapa Link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gc-first">First name</Label>
                <Input
                  id="gc-first"
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gc-last">Last name</Label>
                <Input
                  id="gc-last"
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-phone">Phone number</Label>
              <Input
                id="gc-phone"
                placeholder="+2519…"
                value={createForm.phone_number}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, phone_number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={createForm.currency}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, currency: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="DJF">DJF</SelectItem>
                  <SelectItem value="UGX">UGX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up dialog */}
      <Dialog
        open={!!topUpCard}
        onOpenChange={(open) => !open && setTopUpCard(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Top up {topUpCard?.name}</DialogTitle>
            <DialogDescription>
              Card{" "}
              <span className="font-mono">{topUpCard?.card_number}</span> —
              amount is credited in {topUpCard?.currency} (the card&apos;s
              currency).
            </DialogDescription>
          </DialogHeader>
          {checkoutUrl ? (
            <div className="space-y-3">
              <p className="text-sm">
                Checkout link created (valid ~24h). Open it to pay, or copy and
                send it to the customer:
              </p>
              <div className="flex gap-2">
                <Input readOnly value={checkoutUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(checkoutUrl);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(checkoutUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setTopUpCard(null)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select
                    value={topUpForm.type}
                    onValueChange={(v) =>
                      setTopUpForm((f) => ({ ...f, type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hosted">
                        Hosted checkout (payment link)
                      </SelectItem>
                      <SelectItem value="direct-charge">
                        Direct charge (mobile wallet)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tu-amount">
                    Amount ({topUpCard?.currency})
                  </Label>
                  <Input
                    id="tu-amount"
                    type="number"
                    min="0"
                    value={topUpForm.amount}
                    onChange={(e) =>
                      setTopUpForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                {topUpForm.type === "direct-charge" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="tu-phone">Payer phone number</Label>
                      <Input
                        id="tu-phone"
                        placeholder="+2519…"
                        value={topUpForm.phone_number}
                        onChange={(e) =>
                          setTopUpForm((f) => ({
                            ...f,
                            phone_number: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Wallet</Label>
                      <Select
                        value={topUpForm.payment_method}
                        onValueChange={(v) =>
                          setTopUpForm((f) => ({ ...f, payment_method: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WALLET_SLUGS.map((slug) => (
                            <SelectItem key={slug} value={slug}>
                              {slug}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setTopUpCard(null)}
                  disabled={topUpBusy}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTopUp}
                  disabled={topUpBusy || !Number(topUpForm.amount)}
                >
                  {topUpBusy ? "Working…" : "Top up"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payout dialog */}
      <Dialog
        open={!!payoutCard}
        onOpenChange={(open) => !open && setPayoutCard(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from {payoutCard?.name}</DialogTitle>
            <DialogDescription>
              Available:{" "}
              {payoutCard &&
                formatCents(
                  payoutCard.available_amount,
                  payoutCard.currency
                )}{" "}
              — one destination per payout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Select
                value={payoutForm.destination}
                onValueChange={(v) =>
                  setPayoutForm((f) => ({ ...f, destination: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank / wallet account</SelectItem>
                  <SelectItem value="card">Another gift card</SelectItem>
                  <SelectItem value="business">
                    Another Chapa merchant
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-amount">Amount ({payoutCard?.currency})</Label>
              <Input
                id="po-amount"
                type="number"
                min="0"
                max={
                  payoutCard ? payoutCard.available_amount / 100 : undefined
                }
                value={payoutForm.amount}
                onChange={(e) =>
                  setPayoutForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            {payoutForm.destination === "bank" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="po-bank">Bank / wallet</Label>
                  {banks.length > 0 ? (
                    <Select
                      value={payoutForm.bank_slug}
                      onValueChange={(v) =>
                        setPayoutForm((f) => ({ ...f, bank_slug: v }))
                      }
                    >
                      <SelectTrigger id="po-bank">
                        <SelectValue placeholder="Select institution" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.slug} value={bank.slug}>
                            {bank.name}
                            {bank.currencies?.length
                              ? ` (${bank.currencies.join(", ")})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="po-bank"
                      placeholder="Bank slug, e.g. telebirr"
                      value={payoutForm.bank_slug}
                      onChange={(e) =>
                        setPayoutForm((f) => ({
                          ...f,
                          bank_slug: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-account">Account number</Label>
                  <Input
                    id="po-account"
                    value={payoutForm.account_number}
                    onChange={(e) =>
                      setPayoutForm((f) => ({
                        ...f,
                        account_number: e.target.value,
                      }))
                    }
                  />
                  {(() => {
                    const bank = banks.find(
                      (b) => b.slug === payoutForm.bank_slug
                    );
                    return bank?.acct_length ? (
                      <p className="text-[11px] text-muted-foreground">
                        {bank.name} account numbers are {bank.acct_length}{" "}
                        digits
                        {payoutForm.account_number &&
                          payoutForm.account_number.replace(/\D/g, "").length !==
                            bank.acct_length && (
                            <span className="text-yellow-700 dark:text-yellow-400">
                              {" "}
                              — currently{" "}
                              {
                                payoutForm.account_number.replace(/\D/g, "")
                                  .length
                              }
                            </span>
                          )}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-name">Account name</Label>
                  <Input
                    id="po-name"
                    value={payoutForm.account_name}
                    onChange={(e) =>
                      setPayoutForm((f) => ({
                        ...f,
                        account_name: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}
            {payoutForm.destination === "card" && (
              <div className="space-y-1.5">
                <Label htmlFor="po-dest-card">
                  Destination card number (same currency)
                </Label>
                <Input
                  id="po-dest-card"
                  value={payoutForm.destination_card_number}
                  onChange={(e) =>
                    setPayoutForm((f) => ({
                      ...f,
                      destination_card_number: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            {payoutForm.destination === "business" && (
              <div className="space-y-1.5">
                <Label htmlFor="po-merchant">Merchant ID</Label>
                <Input
                  id="po-merchant"
                  value={payoutForm.merchant_id}
                  onChange={(e) =>
                    setPayoutForm((f) => ({
                      ...f,
                      merchant_id: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayoutCard(null)}
              disabled={payoutBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayout}
              disabled={payoutBusy || !Number(payoutForm.amount)}
            >
              {payoutBusy ? "Working…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction history dialog */}
      <Dialog
        open={!!historyCard}
        onOpenChange={(open) => !open && setHistoryCard(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History — {historyCard?.name}
            </DialogTitle>
            <DialogDescription>
              Card{" "}
              <span className="font-mono">{historyCard?.card_number}</span> ·
              current balance{" "}
              {historyCard &&
                formatCents(
                  historyCard.available_amount,
                  historyCard.currency
                )}
              {historyOwner?.owner_phone && (
                <>
                  {" "}
                  · owner{" "}
                  <span className="font-mono">
                    {historyOwner.owner_phone}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {historyTruncated && (
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              This card has a very long history — only the most recent ~500
              top-ups and payouts were scanned.
            </p>
          )}
          {historyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No transactions on this card yet
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <GiftCardTxTable transactions={history} />
            
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelCard}
        onOpenChange={(open) => !open && setCancelCard(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this gift card?</AlertDialogTitle>
            <AlertDialogDescription>
              Card {cancelCard?.card_number} ({cancelCard?.name}) will be
              permanently removed — it disappears from listings and can no
              longer be used for payments or payouts. Current balance:{" "}
              {cancelCard &&
                formatCents(cancelCard.available_amount, cancelCard.currency)}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep card</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
