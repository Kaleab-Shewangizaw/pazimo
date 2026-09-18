"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import BeverageWithdrawForm, {
  formatEtb,
} from "@/components/beverages/BeverageWithdrawForm";
import {
  ArrowLeft,
  Beer,
  Wallet,
  Clock,
  CheckCircle2,
  Receipt,
  TrendingUp,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

/**
 * Bar takings, end to end: what the balance is, what has been requested, and
 * how to request more.
 *
 * This lives apart from /organizer/withdrawals because it is a genuinely
 * separate pool — beverage revenue is settled independently of ticket revenue,
 * and Pazimo Capital never touches it. Three tabs rather than three routes
 * because an organizer checking a request's status almost always wants the
 * balance in the same breath.
 */

interface FinanceData {
  totals: {
    grossRevenue: number;
    organizerNet: number;
    pazimoCommission: number;
    vatOnCommission: number;
    // VAT Pazimo withheld and remits to the government on the organizer's
    // behalf, on events set to be covered. Shown so a smaller payout is
    // explained rather than mysterious.
    organizerVat: number;
    pazimoCollected: number;
    unitsSold: number;
    salesCount: number;
  };
  withdrawals: { pending: number; approved: number };
  availableBalance: number;
  events: {
    eventId: string;
    title: string;
    startDate?: string;
    commissionPercent: number;
    coversOrganizerVat: boolean;
    totalCutPercent: number;
    salesCount: number;
    unitsSold: number;
    grossRevenue: number;
    organizerNet: number;
    organizerVat: number;
    pazimoCollected: number;
  }[];
}

interface WithdrawalRow {
  _id: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
  processedAt?: string;
  transactionId?: string;
  notes?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    accountHolderName?: string;
  };
  processedBy?: { firstName?: string; lastName?: string };
}

const STATUS_COPY: Record<
  WithdrawalRow["status"],
  { label: string; hint: string; className: string }
> = {
  pending: {
    label: "Pending",
    hint: "Waiting on Pazimo to review it.",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  },
  approved: {
    label: "Approved",
    hint: "Cleared for payout.",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  completed: {
    label: "Paid out",
    hint: "Money has been sent.",
    className:
      "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    hint: "Not approved — see the note.",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) => (
  <Card className="border border-gray-200 dark:border-gray-800 dark:bg-gray-900/40">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className={`h-4 w-4 ${accent || ""}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </CardContent>
  </Card>
);

export default function BeverageWithdrawalsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const organizerId = user?._id || user?.id;

  const [eligibility, setEligibility] = useState<
    "loading" | "eligible" | "not_eligible"
  >("loading");
  const [tab, setTab] = useState("dashboard");

  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [financeLoading, setFinanceLoading] = useState(true);

  const [history, setHistory] = useState<WithdrawalRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const authHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/beverages/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        setEligibility(
          data?.data?.eligibility === "eligible" ? "eligible" : "not_eligible"
        )
      )
      .catch(() => setEligibility("not_eligible"));
  }, [token]);

  const loadFinance = useCallback(async () => {
    if (!token) return;
    try {
      setFinanceLoading(true);
      const res = await fetch(`${API}/api/beverages/finance/organizer`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setFinance(data);
    } catch {
      // Leave the last good figures on screen rather than toasting on every
      // poll; the History tab still tells the organizer where a request stands.
    } finally {
      setFinanceLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token || !organizerId) return;
    try {
      setHistoryLoading(true);
      // The backend pins this to the caller for organizers; the id in the path
      // is only what the route shape requires.
      const params = new URLSearchParams({
        stream: "beverages",
        currency: "ETB",
        page: String(page),
        limit: "10",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(
        `${API}/api/withdrawals/organizer/${organizerId}/withdrawals?${params}`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setHistory(payload.data || []);
      setTotalPages(payload.pagination?.pages || 1);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizerId, page, statusFilter]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (eligibility === "loading") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (eligibility === "not_eligible") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Beer className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Beverage selling isn&apos;t enabled for your account
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          Pazimo approves organizers for beverage sales individually. Get in touch if
          you&apos;d like to sell drinks at your events.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push("/organizer")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
        </Button>
      </div>
    );
  }

  const available = finance?.availableBalance ?? 0;
  const totals = finance?.totals;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/organizer/beverages"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> Beverage sales
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bar withdrawals
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your beverage earnings and the payouts drawn from them. This balance is
          settled separately from{" "}
          <Link
            href="/organizer/withdrawals"
            className="font-medium text-[#1a2d5a] dark:text-blue-400 hover:underline"
          >
            ticket revenue
          </Link>
          .
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="dashboard" className="space-y-6">
          {financeLoading && !finance ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  icon={Wallet}
                  label="Available"
                  value={formatEtb(available)}
                  sub="Ready to withdraw"
                  accent="text-emerald-600 dark:text-emerald-400"
                />
                <StatTile
                  icon={Clock}
                  label="Pending"
                  value={formatEtb(finance?.withdrawals.pending ?? 0)}
                  sub="Awaiting review"
                  accent="text-amber-600 dark:text-amber-400"
                />
                <StatTile
                  icon={CheckCircle2}
                  label="Withdrawn"
                  value={formatEtb(finance?.withdrawals.approved ?? 0)}
                  sub="Approved or paid out"
                  accent="text-blue-600 dark:text-blue-400"
                />
                <StatTile
                  icon={TrendingUp}
                  label="Bar earnings"
                  value={formatEtb(totals?.organizerNet ?? 0)}
                  sub={
                    totals && totals.organizerVat > 0
                      ? `After ${formatEtb(totals.organizerVat)} VAT paid for you`
                      : undefined
                  }
                  accent="text-purple-600 dark:text-purple-400"
                />
              </div>

              <Card className="dark:bg-black dark:border-gray-800">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Where the money came from
                    </h2>
                  </div>
                  {!finance?.events.length ? (
                    <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No beverage sales recorded yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-200 dark:border-gray-800">
                            <TableHead className="text-xs dark:text-gray-300">
                              Event
                            </TableHead>
                            <TableHead className="text-xs dark:text-gray-300">
                              Sold
                            </TableHead>
                            <TableHead className="text-xs dark:text-gray-300">
                              Taken at the bar
                            </TableHead>
                            
                            <TableHead className="text-xs dark:text-gray-300">
                              Your earnings
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {finance.events.map((row) => (
                            <TableRow
                              key={row.eventId}
                              className="border-gray-100 dark:border-gray-800"
                            >
                              <TableCell className="text-xs dark:text-gray-200">
                                <span className="font-medium">{row.title}</span>
                                {row.startDate && (
                                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                    {new Date(row.startDate).toLocaleDateString()}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums dark:text-gray-300">
                                {row.unitsSold} bottles
                                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                  {row.salesCount} order
                                  {row.salesCount === 1 ? "" : "s"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums dark:text-gray-300">
                                {formatEtb(row.grossRevenue)}
                              </TableCell>
                             
                              <TableCell className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatEtb(row.organizerNet)}
                                {row.organizerVat > 0 && (
                                  <span className="block text-[11px] font-normal text-amber-600 dark:text-amber-400">
                                    {formatEtb(row.organizerVat)} VAT paid for you
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {available > 0 && (
                <Button
                  onClick={() => setTab("withdraw")}
                  className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white"
                >
                  Withdraw {formatEtb(available)}
                </Button>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Every bar withdrawal you&apos;ve requested, and where it stands.
            </p>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Paid out</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="dark:bg-black dark:border-gray-800">
            <CardContent className="p-4 sm:p-5">
              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-md" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center">
                  <Wallet className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    No bar withdrawals yet
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {statusFilter === "all"
                      ? "Requests you make from the Withdraw tab will appear here."
                      : "Nothing matches that status."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-800">
                        <TableHead className="text-xs dark:text-gray-300">
                          Requested
                        </TableHead>
                        <TableHead className="text-xs dark:text-gray-300">
                          Amount
                        </TableHead>
                        <TableHead className="text-xs dark:text-gray-300">
                          Paid to
                        </TableHead>
                        <TableHead className="text-xs dark:text-gray-300">
                          Status
                        </TableHead>
                        <TableHead className="text-xs dark:text-gray-300">
                          Transaction ID
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((row) => {
                        const status = STATUS_COPY[row.status];
                        return (
                          <TableRow
                            key={row._id}
                            className="border-gray-100 dark:border-gray-800"
                          >
                            <TableCell className="text-xs dark:text-gray-300">
                              {new Date(row.createdAt).toLocaleDateString()}
                              {row.processedAt && (
                                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                  Processed{" "}
                                  {new Date(row.processedAt).toLocaleDateString()}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium dark:text-gray-100">
                              <span className="tabular-nums">
                                {formatEtb(row.amount)}
                              </span>
                              {!!row.feeAmount && row.feeAmount > 0 && (
                                <span className="block text-[11px] font-normal text-amber-600 dark:text-amber-400">
                                  −{formatEtb(row.feeAmount)} fee · you get{" "}
                                  {formatEtb(
                                    row.netAmount ?? row.amount - row.feeAmount
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs capitalize dark:text-gray-300">
                              {row.bankDetails?.bankName || "—"}
                              {row.bankDetails?.accountNumber && (
                                <span className="block text-[11px] normal-case text-gray-500 dark:text-gray-400">
                                  {row.bankDetails.accountNumber}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs border-transparent ${status.className}`}
                              >
                                {status.label}
                              </Badge>
                              <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                                {row.status === "rejected" && row.notes
                                  ? row.notes
                                  : status.hint}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs dark:text-gray-300">
                              {row.transactionId || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="withdraw">
          <Card className="dark:bg-black dark:border-gray-800">
            <CardContent className="p-4 sm:p-6">
              <BeverageWithdrawForm
                token={token}
                available={available}
                onSuccess={() => {
                  loadFinance();
                  setPage(1);
                  setStatusFilter("all");
                  loadHistory();
                  setTab("history");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
