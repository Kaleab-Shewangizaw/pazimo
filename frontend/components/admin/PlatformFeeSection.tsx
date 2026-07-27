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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, RefreshCw, Send, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";

interface FeeConfig {
  merchantName: string | null;
  merchantId: string | null;
  feePercentage: number;
  autoSendEnabled: boolean;
  lastAutoRunDate: string | null;
}

interface LedgerRow {
  date: string;
  currency: string;
  totalSales: number;
  paymentCount: number;
  feePercentage: number;
  feeAmount: number;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt: string | null;
  payoutReference: string | null;
  initiatedBy: string | null;
  errorMessage: string | null;
}

interface TodayPreview {
  date: string;
  totalSales: number;
  paymentCount: number;
  feeAmount: number;
  feePercentage: number;
}

const CURRENCIES = ["ETB", "USD"] as const;

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const statusBadgeClass = (status: string) =>
  status === "SENT"
    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
    : status === "FAILED"
    ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
    : "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900";

// Daily 3% platform fee, skimmed off gift-card ticket sales only, sent to a
// dedicated Chapa merchant account — one ledger + one send button per
// currency, plus an optional fully-automatic daily run.
export default function PlatformFeeSection() {
  const [config, setConfig] = useState<FeeConfig | null>(null);
  const [merchantForm, setMerchantForm] = useState({ merchantName: "", merchantId: "" });
  const [savingConfig, setSavingConfig] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const [today, setToday] = useState<Record<string, TodayPreview | null>>({
    ETB: null,
    USD: null,
  });
  const [history, setHistory] = useState<Record<string, LedgerRow[]>>({
    ETB: [],
    USD: [],
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null); // `${date}-${currency}`

  const fetchConfig = useCallback(async () => {
    const res = await adminApi.get("/admin/finance/platform-fee/config");
    if (res.status === "success") {
      setConfig(res.data);
      setMerchantForm({
        merchantName: res.data.merchantName || "",
        merchantId: res.data.merchantId || "",
      });
    }
  }, []);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        CURRENCIES.map((currency) =>
          adminApi.get(`/admin/finance/platform-fee/daily?currency=${currency}&days=14`)
        )
      );
      const nextToday: Record<string, TodayPreview | null> = { ETB: null, USD: null };
      const nextHistory: Record<string, LedgerRow[]> = { ETB: [], USD: [] };
      results.forEach((res, i) => {
        const currency = CURRENCIES[i];
        if (res.status === "success") {
          nextToday[currency] = res.data.today;
          nextHistory[currency] = [...res.data.history].reverse(); // newest first
        }
      });
      setToday(nextToday);
      setHistory(nextHistory);
    } catch (e: any) {
      toast.error(e.message || "Failed to load daily platform fee data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchDaily();
  }, [fetchConfig, fetchDaily]);

  const handleSaveMerchant = async () => {
    if (!merchantForm.merchantId.trim()) {
      toast.error("Merchant ID is required");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await adminApi.patch("/admin/finance/platform-fee/config", {
        merchantName: merchantForm.merchantName.trim() || undefined,
        merchantId: merchantForm.merchantId.trim(),
      });
      if (res.status === "success") {
        setConfig(res.data);
        toast.success("Merchant saved");
      } else {
        throw new Error(res.message || "Failed to save merchant");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleAuto = async (enabled: boolean) => {
    setTogglingAuto(true);
    try {
      const res = await adminApi.patch("/admin/finance/platform-fee/config", {
        autoSendEnabled: enabled,
      });
      if (res.status === "success") {
        setConfig(res.data);
        toast.success(`Automatic daily send ${enabled ? "enabled" : "disabled"}`);
      } else {
        throw new Error(res.message || "Failed to update");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTogglingAuto(false);
    }
  };

  const handleSend = async (date: string, currency: string) => {
    const key = `${date}-${currency}`;
    setSending(key);
    try {
      const res = await adminApi.post("/admin/finance/platform-fee/send", { date, currency });
      if (res.status === "success") {
        toast.success(`Sent ${formatMoney(res.data.feeAmount, currency)} to the merchant`);
        fetchDaily();
      } else {
        throw new Error(res.message || "Send failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" /> Daily platform fee
          </CardTitle>
          <CardDescription>
            {config?.feePercentage ?? 3}% of each day&apos;s gift-card ticket sales is sent to
            this merchant — separately for ETB and USD, out of whichever gift card ticket
            payments are currently routed to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fee-merchant-name">Merchant name</Label>
              <Input
                id="fee-merchant-name"
                placeholder="e.g. Pazimo Holdings"
                value={merchantForm.merchantName}
                onChange={(e) =>
                  setMerchantForm((f) => ({ ...f, merchantName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-merchant-id">Chapa merchant ID</Label>
              <Input
                id="fee-merchant-id"
                placeholder="merchant_id"
                value={merchantForm.merchantId}
                onChange={(e) =>
                  setMerchantForm((f) => ({ ...f, merchantId: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSaveMerchant} disabled={savingConfig}>
                {savingConfig ? "Saving…" : "Save merchant"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Automatic daily send</p>
              <p className="text-xs text-muted-foreground">
                Runs shortly after midnight (Africa/Addis_Ababa) and sends the previous day&apos;s
                3% for both currencies automatically.
                {config?.lastAutoRunDate && (
                  <> Last finalized: <span className="font-mono">{config.lastAutoRunDate}</span>.</>
                )}
              </p>
            </div>
            <Switch
              checked={!!config?.autoSendEnabled}
              onCheckedChange={handleToggleAuto}
              disabled={togglingAuto || !config}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {CURRENCIES.map((currency) => (
          <Card key={currency}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" /> {currency}
                </CardTitle>
                <Button variant="outline" size="icon" onClick={fetchDaily} disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {today[currency] && (
                <CardDescription>
                  Today so far ({today[currency]!.date}):{" "}
                  {formatMoney(today[currency]!.totalSales, currency)} in sales,{" "}
                  {formatMoney(today[currency]!.feeAmount, currency)} projected fee —
                  finalizes at day&apos;s end.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : history[currency].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          No completed days yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      history[currency].map((row) => {
                        const key = `${row.date}-${row.currency}`;
                        const canSend = row.status !== "SENT" && row.feeAmount > 0;
                        return (
                          <TableRow key={key}>
                            <TableCell className="whitespace-nowrap text-xs font-mono">
                              {row.date}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatMoney(row.totalSales, currency)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatMoney(row.feeAmount, currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusBadgeClass(row.status)}>
                                {row.status.toLowerCase()}
                              </Badge>
                              {row.status === "SENT" && row.sentAt && (
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  {new Date(row.sentAt).toLocaleString(undefined, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </p>
                              )}
                              {row.status === "FAILED" && row.errorMessage && (
                                <p className="mt-0.5 max-w-[180px] text-[10px] text-red-600 dark:text-red-400">
                                  {row.errorMessage}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canSend || sending === key}
                                onClick={() => handleSend(row.date, currency)}
                              >
                                <Send className="mr-1 h-3.5 w-3.5" />
                                {sending === key
                                  ? "Sending…"
                                  : row.status === "SENT"
                                  ? "Sent"
                                  : row.status === "FAILED"
                                  ? "Retry"
                                  : "Send"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
