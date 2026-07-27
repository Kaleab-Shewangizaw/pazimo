"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import { Banknote, Landmark, Lock, Repeat, ShieldAlert, TrendingUp } from "lucide-react";

const STANDARD_FEE_RATE = 0.15;

type LoanStatus = "pending" | "approved" | "rejected" | "active" | "repaid" | "cancelled";

interface CapitalMetrics {
  currency: "ETB" | "USD";
  totalEvents: number;
  totalRevenue: number;
  lastEventRevenue: number;
  lastTwoEventsRevenue: number;
  borrowingLimit: number;
  limitBasis: { eventId: string; eventTitle: string; eventDate: string; revenue: number }[];
}

interface Loan {
  _id: string;
  requestedAmount: number;
  approvedAmount?: number;
  currency: "ETB" | "USD";
  status: LoanStatus;
  feeRate?: number;
  feeAmount?: number;
  totalRepayable?: number;
  outstandingBalance?: number;
  totalRepaid?: number;
  rejectionReason?: string;
  requestedAt: string;
  createdAt: string;
}

const STATUS_STYLES: Record<LoanStatus, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900",
  approved:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  active:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  repaid:
    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900",
  rejected:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  cancelled:
    "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const getAuth = () => {
  const stored = localStorage.getItem("auth-storage");
  if (!stored) return { token: "", userId: "" };
  try {
    const parsed = JSON.parse(stored);
    return { token: parsed.state?.token || "", userId: parsed.state?.user?._id || "" };
  } catch {
    return { token: "", userId: "" };
  }
};

export default function CapitalDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<CapitalMetrics | null>(null);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [history, setHistory] = useState<Loan[]>([]);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEverything = useCallback(async () => {
    const { token } = getAuth();
    if (!token) {
      toast.error("Please login to view Pazimo Capital");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const eligibilityRes = await fetch(`${API_URL}/api/capital/organizer/eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const eligibilityData = await eligibilityRes.json();
      const isEligible = eligibilityData?.data?.eligibility === "eligible";
      setEligible(isEligible);

      if (!isEligible) {
        setLoading(false);
        return;
      }

      const [summaryRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/capital/organizer/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/capital/organizer/loans?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const summaryData = await summaryRes.json();
      const historyData = await historyRes.json();

      if (summaryRes.ok && summaryData.success) {
        setMetrics(summaryData.data.metrics);
        setActiveLoan(summaryData.data.activeLoan);
      }
      if (historyRes.ok && historyData.success) {
        setHistory(historyData.data);
      }
    } catch (error) {
      console.error("Error loading capital dashboard:", error);
      toast.error("Failed to load Pazimo Capital");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEverything();
  }, [fetchEverything]);

  const handleRequestLoan = async () => {
    const amount = Number(requestAmount);
    if (!(amount > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    if (metrics && amount > metrics.borrowingLimit) {
      toast.error(`Amount cannot exceed your borrowing limit of ${formatCompactMoney(metrics.borrowingLimit, metrics.currency)}`);
      return;
    }
    const { token } = getAuth();
    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/capital/organizer/loans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to submit loan request");
      toast.success("Loan request submitted");
      setRequestDialogOpen(false);
      setRequestAmount("");
      fetchEverything();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit loan request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black min-h-screen">
        <Card className="max-w-lg mx-auto mt-16 border-gray-200 dark:border-gray-800">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Pazimo Capital isn&apos;t available yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Organizers are made eligible for loans by the Pazimo team based on their
              event history. Keep running successful events — you&apos;ll be notified if you become
              eligible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const repaymentPercent =
    activeLoan && activeLoan.totalRepayable
      ? Math.min(100, Math.round(((activeLoan.totalRepaid || 0) / activeLoan.totalRepayable) * 100))
      : 0;

  const requestedAmountNumber = Number(requestAmount) || 0;
  const overLimit = !!metrics && requestedAmountNumber > metrics.borrowingLimit;
  const estimatedFee = Math.round(requestedAmountNumber * STANDARD_FEE_RATE * 100) / 100;
  const estimatedTotalRepayable = Math.round((requestedAmountNumber + estimatedFee) * 100) / 100;
  const quickPicks =
    metrics && metrics.borrowingLimit > 0
      ? [25, 50, 75, 100].map((pct) => ({
          label: pct === 100 ? "Max" : `${pct}%`,
          value: Math.max(0, Math.floor(metrics.borrowingLimit * (pct / 100))),
        }))
      : [];

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black min-h-screen">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold dark:text-gray-100">Pazimo Capital</h1>
        <p className="text-muted-foreground dark:text-gray-400 text-sm sm:text-base mt-1">
          Loans against your ticket sales
        </p>
      </div>

      {/* Limit + active loan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-emerald-100 dark:from-black dark:to-emerald-950/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Your borrowing limit
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {metrics ? formatCompactMoney(metrics.borrowingLimit, metrics.currency) : "—"}
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
                  Set by Pazimo based on your recent events
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <Button
              onClick={() => setRequestDialogOpen(true)}
              disabled={!!activeLoan || !metrics || metrics.borrowingLimit <= 0}
              className="w-full mt-4 bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white"
            >
              <Banknote className="h-4 w-4 mr-2" />
              {activeLoan
                ? "You have a loan in progress"
                : metrics && metrics.borrowingLimit <= 0
                  ? "No borrowing limit yet"
                  : "Request a Loan"}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-none shadow-md dark:bg-gray-900/40">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                Current loan
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            {activeLoan ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_STYLES[activeLoan.status]}>{activeLoan.status}</Badge>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {formatCompactMoney(
                      activeLoan.approvedAmount ?? activeLoan.requestedAmount,
                      activeLoan.currency
                    )}
                  </span>
                </div>
                {activeLoan.status === "active" && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          Fee rate
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {activeLoan.feeRate !== undefined
                            ? `${(activeLoan.feeRate * 100).toFixed(0)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          Total to repay
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(activeLoan.totalRepayable || 0, activeLoan.currency)}
                        </p>
                      </div>
                    </div>

                    <Progress value={repaymentPercent} />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Repaid {formatCompactMoney(activeLoan.totalRepaid || 0, activeLoan.currency)}
                      </span>
                      <span>
                        Outstanding {formatCompactMoney(activeLoan.outstandingBalance || 0, activeLoan.currency)}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5">
                      <Repeat className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
                      <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
                        60% of every ticket you sell is applied to this loan automatically until
                        it&apos;s fully repaid.
                      </p>
                    </div>
                  </div>
                )}
                {activeLoan.status === "pending" && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2.5 mt-1">
                    <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                      Waiting for Pazimo to review your request.
                    </p>
                  </div>
                )}
                {activeLoan.status === "approved" && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5 mt-1">
                    <Landmark className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
                    <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
                      Approved — funds are being added to your withdrawal balance.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Lock className="h-4 w-4" /> No active loan
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold dark:text-gray-100 mb-4">Loan history</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-800">
                  <TableHead className="dark:text-gray-300">Date</TableHead>
                  <TableHead className="dark:text-gray-300">Amount</TableHead>
                  <TableHead className="dark:text-gray-300">Status</TableHead>
                  <TableHead className="dark:text-gray-300">Outstanding</TableHead>
                  <TableHead className="dark:text-gray-300">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground dark:text-gray-400 py-8">
                      No loan requests yet
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((loan) => (
                    <TableRow key={loan._id} className="border-gray-100 dark:border-gray-800">
                      <TableCell className="text-sm dark:text-gray-300">
                        {new Date(loan.requestedAt || loan.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium dark:text-gray-100">
                        {formatCompactMoney(loan.approvedAmount ?? loan.requestedAmount, loan.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[loan.status]}>{loan.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm dark:text-gray-300">
                        {loan.status === "active"
                          ? formatCompactMoney(loan.outstandingBalance || 0, loan.currency)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                        {loan.rejectionReason || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Request dialog */}
      <Dialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) setRequestAmount("");
        }}
      >
        <DialogContent className="sm:max-w-lg dark:bg-black dark:border-gray-800">
          <DialogHeader className="sr-only">
            <DialogTitle>Request a Loan</DialogTitle>
            <DialogDescription>
              Request a Pazimo Capital loan against your recent ticket revenue.
            </DialogDescription>
          </DialogHeader>

          {/* Hero banner */}
          <div className="relative -mt-1 overflow-hidden rounded-xl bg-gradient-to-br from-[#1a2d5a] to-[#0f1c3d] p-5">
            <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-amber-400/10" />
            <div className="pointer-events-none absolute -right-10 -bottom-6 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <Landmark className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Request a Loan</h3>
                <p className="text-xs text-white/60">Funded against your ticket revenue</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 pt-3">
            {/* Amount input */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Amount requested
                </Label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Limit{" "}
                  {metrics ? formatCompactMoney(metrics.borrowingLimit, metrics.currency) : "—"}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 rounded-xl border-2 bg-gray-50 px-4 py-3 transition-colors dark:bg-gray-900/50 ${
                  overLimit
                    ? "border-red-300 dark:border-red-900"
                    : "border-gray-200 focus-within:border-[#1a2d5a] dark:border-gray-800 dark:focus-within:border-amber-600"
                }`}
              >
                <span className="text-2xl font-semibold text-gray-400 dark:text-gray-600">
                  {metrics?.currency || "ETB"}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder="0"
                  className="w-full min-w-0 flex-1 bg-transparent text-3xl font-bold text-gray-900 outline-none placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-700"
                />
              </div>
              {overLimit ? (
                <p className="mt-1.5 text-xs font-medium text-red-500">
                  Exceeds your borrowing limit of{" "}
                  {formatCompactMoney(metrics?.borrowingLimit || 0, metrics?.currency)}
                </p>
              ) : requestedAmountNumber > 0 ? (
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {requestedAmountNumber.toLocaleString()} {metrics?.currency}
                </p>
              ) : null}
            </div>

            {/* Quick picks */}
            {quickPicks.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {quickPicks.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    onClick={() => setRequestAmount(String(qp.value))}
                    className="rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#1a2d5a] hover:text-[#1a2d5a] dark:border-gray-800 dark:text-gray-300 dark:hover:border-amber-600 dark:hover:text-amber-400"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">You&apos;ll receive</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(requestedAmountNumber, metrics?.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Est. service fee ({(STANDARD_FEE_RATE * 100).toFixed(0)}%)
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCompactMoney(estimatedFee, metrics?.currency)}
                </span>
              </div>
              <div className="h-px bg-amber-200/70 dark:bg-amber-900/40" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Est. total repayable
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(estimatedTotalRepayable, metrics?.currency)}
                </span>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-400/70">
                Pazimo confirms the final rate when your request is approved. Once active, 60% of
                every ticket you sell is applied automatically until it&apos;s fully repaid — no
                manual transfers.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setRequestDialogOpen(false)}
              className="dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestLoan}
              disabled={submitting || !(requestedAmountNumber > 0) || overLimit}
              className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
