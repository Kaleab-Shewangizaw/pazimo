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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GiftCardsSection from "@/components/admin/GiftCardsSection";
import GiftCardRouting from "@/components/admin/GiftCardRouting";
import CinemaGiftCardRouting from "@/components/admin/CinemaGiftCardRouting";
import BeverageGiftCardRouting from "@/components/admin/BeverageGiftCardRouting";
import VenueGiftCardRouting from "@/components/admin/VenueGiftCardRouting";
import ChapaV2Section from "@/components/admin/ChapaV2Section";
import PlatformFeeSection from "@/components/admin/PlatformFeeSection";
import FinanceOverviewCards from "@/components/admin/FinanceOverviewCards";
import GiftCardOverview from "@/components/admin/GiftCardOverview";

interface ChapaBalance {
  currency: string;
  available_balance: number;
  ledger_balance: number;
}

interface ChapaTransaction {
  status: string;
  ref_id: string;
  type: string;
  created_at: string;
  currency: string;
  amount: string;
  charge: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  email: string | null;
  trans_id: string | null;
  payment_method: string | null;
}

interface ChapaPagination {
  per_page: string | number;
  current_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
}

interface ChapaTransactionEvent {
  item: number;
  message: string;
  type: string;
  created_at: string;
}

interface ChapaSummary {
  period: { from: string; to: string };
  truncated?: boolean;
  totalCount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  byCurrency: Record<
    string,
    { count: number; amount: number; charges: number }
  >;
  daily: Record<string, Record<string, number>>;
}

interface LocalSummary {
  [status: string]: { count: number; amount: number };
}

const formatMoney = (value: number, currency: string) =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const statusBadgeClass = (status: string) => {
  const s = status.toLowerCase();
  if (s === "success")
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900";
  if (s === "pending")
    return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900";
  return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
};

const StatusIcon = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  if (s === "success") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (s === "pending") return <Clock className="h-3.5 w-3.5" />;
  return <XCircle className="h-3.5 w-3.5" />;
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ChapaFinancePage() {
  // Period filter (shared by summary + transactions)
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(today());

  // Balances
  const [balances, setBalances] = useState<ChapaBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // Summary
  const [summary, setSummary] = useState<ChapaSummary | null>(null);
  const [localSummary, setLocalSummary] = useState<LocalSummary>({});
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [chartCurrency, setChartCurrency] = useState("ETB");

  // Transactions table
  const [transactions, setTransactions] = useState<ChapaTransaction[]>([]);
  const [pagination, setPagination] = useState<ChapaPagination | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  // Transaction detail dialog
  const [selectedTx, setSelectedTx] = useState<ChapaTransaction | null>(null);
  const [events, setEvents] = useState<ChapaTransactionEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await adminApi.get("/admin/finance/chapa/balances");
      if (res.status === "success") {
        setBalances(res.data);
      } else {
        throw new Error(res.message || "Failed to load balances");
      }
    } catch (e: any) {
      setError(e.message);
      toast.error(`Balances: ${e.message}`);
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await adminApi.get(
        `/admin/finance/chapa/summary?from_date=${fromDate}&to_date=${toDate}`
      );
      if (res.status === "success") {
        setSummary(res.data.chapa);
        setLocalSummary(res.data.local || {});
      } else {
        throw new Error(res.message || "Failed to load summary");
      }
    } catch (e: any) {
      setError(e.message);
      toast.error(`Summary: ${e.message}`);
    } finally {
      setSummaryLoading(false);
    }
  }, [fromDate, toDate]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
        from_date: fromDate,
        to_date: toDate,
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (currencyFilter !== "all") params.set("currency", currencyFilter);
      const res = await adminApi.get(
        `/admin/finance/chapa/transactions?${params.toString()}`
      );
      if (res.status === "success") {
        setTransactions(res.data.transactions);
        setPagination(res.data.pagination);
      } else {
        throw new Error(res.message || "Failed to load transactions");
      }
    } catch (e: any) {
      setError(e.message);
      toast.error(`Transactions: ${e.message}`);
    } finally {
      setTxLoading(false);
    }
  }, [page, fromDate, toDate, statusFilter, currencyFilter]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, currencyFilter, fromDate, toDate]);

  const openTransaction = async (tx: ChapaTransaction) => {
    setSelectedTx(tx);
    setEvents([]);
    setEventsLoading(true);
    try {
      const res = await adminApi.get(
        `/admin/finance/chapa/transactions/${encodeURIComponent(
          tx.ref_id
        )}/events`
      );
      if (res.status === "success") {
        setEvents(res.data);
      } else {
        throw new Error(res.message || "Failed to load transaction events");
      }
    } catch (e: any) {
      toast.error(`Events: ${e.message}`);
    } finally {
      setEventsLoading(false);
    }
  };

  const refreshAll = () => {
    setError(null);
    fetchBalances();
    fetchSummary();
    fetchTransactions();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chapa Finance</h1>
          <p className="text-sm text-muted-foreground">
            Live balances, transactions and settlement activity from Chapa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            min={fromDate}
            max={today()}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
          <Button variant="outline" size="icon" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="giftcards">Gift Cards</TabsTrigger>
          <TabsTrigger value="platformfee">Platform Fee</TabsTrigger>
          <TabsTrigger value="v2">API v2</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
      {summary?.truncated && (
        <Card className="border-yellow-300 dark:border-yellow-800">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            This period has more than 3,000 Chapa transactions — the summary
            figures below only cover the most recent 3,000. Narrow the date
            range for exact numbers.
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <FinanceOverviewCards
        balances={balances}
        balancesLoading={balancesLoading}
        summary={summary}
        summaryLoading={summaryLoading}
        localSummary={localSummary}
        chartCurrency={chartCurrency}
        onChartCurrencyChange={setChartCurrency}
        fromDate={fromDate}
        toDate={toDate}
      />

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Every payment processed through Chapa in the selected period
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All currencies</SelectItem>
                  <SelectItem value="etb">ETB</SelectItem>
                  <SelectItem value="usd">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No transactions match these filters
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow
                      key={tx.ref_id}
                      className="cursor-pointer"
                      onClick={() => openTransaction(tx)}
                    >
                      <TableCell className="font-mono text-xs">
                        {tx.ref_id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(tx.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {[tx.first_name, tx.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                          tx.email ||
                          tx.mobile ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.payment_method || tx.type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatMoney(parseFloat(tx.amount) || 0, tx.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {formatMoney(parseFloat(tx.charge) || 0, tx.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${statusBadgeClass(tx.status)}`}
                        >
                          <StatusIcon status={tx.status} />
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Prev/next pagination — Chapa's API doesn't return a total count */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {pagination?.current_page ?? page}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={txLoading || !pagination?.prev_page_url}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={txLoading || !pagination?.next_page_url}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="giftcards" className="mt-4">
          <Tabs defaultValue="manage">
            <TabsList>
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="mt-4 space-y-4">
              <GiftCardRouting />
              <CinemaGiftCardRouting />
              <BeverageGiftCardRouting />
              <VenueGiftCardRouting />
              <GiftCardsSection />
            </TabsContent>

            <TabsContent value="overview" className="mt-4">
              <GiftCardOverview fromDate={fromDate} toDate={toDate} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="platformfee" className="mt-4">
          <PlatformFeeSection />
        </TabsContent>

        <TabsContent value="v2" className="mt-4">
          <ChapaV2Section />
        </TabsContent>
      </Tabs>

      {/* Transaction detail dialog */}
      <Dialog
        open={!!selectedTx}
        onOpenChange={(open) => !open && setSelectedTx(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Transaction{" "}
              <span className="font-mono text-sm">{selectedTx?.ref_id}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedTx && formatDateTime(selectedTx.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="tabular-nums">
                  {formatMoney(
                    parseFloat(selectedTx.amount) || 0,
                    selectedTx.currency
                  )}
                </span>
                <span className="text-muted-foreground">Chapa fee</span>
                <span className="tabular-nums">
                  {formatMoney(
                    parseFloat(selectedTx.charge) || 0,
                    selectedTx.currency
                  )}
                </span>
                <span className="text-muted-foreground">Status</span>
                <span>
                  <Badge
                    variant="outline"
                    className={`gap-1 ${statusBadgeClass(selectedTx.status)}`}
                  >
                    <StatusIcon status={selectedTx.status} />
                    {selectedTx.status}
                  </Badge>
                </span>
                <span className="text-muted-foreground">Method</span>
                <span>{selectedTx.payment_method || selectedTx.type}</span>
                <span className="text-muted-foreground">Customer</span>
                <span className="truncate">
                  {[selectedTx.first_name, selectedTx.last_name]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </span>
                <span className="text-muted-foreground">Email</span>
                <span className="truncate">{selectedTx.email || "—"}</span>
                <span className="text-muted-foreground">Phone</span>
                <span>{selectedTx.mobile || "—"}</span>
                <span className="text-muted-foreground">Provider ref</span>
                <span className="font-mono text-xs">
                  {selectedTx.trans_id || "—"}
                </span>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">Timeline</h4>
                {eventsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No events recorded for this transaction.
                  </p>
                ) : (
                  <ol className="space-y-2 border-l pl-4">
                    {events.map((ev) => (
                      <li key={ev.item} className="text-sm">
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(ev.created_at)}
                        </span>
                        {ev.message}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
