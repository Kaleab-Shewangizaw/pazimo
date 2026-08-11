"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEBT_CUT_PERCENT } from "@/lib/rates";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import {
  Banknote,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  ListChecks,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

type Currency = "ETB" | "USD";
type Eligibility = "eligible" | "not_eligible";
type LoanStatus = "pending" | "approved" | "rejected" | "active" | "repaid" | "cancelled";

interface CapitalMetrics {
  currency: Currency;
  totalEvents: number;
  totalRevenue: number;
  lastEventRevenue: number;
  lastTwoEventsRevenue: number;
  averageRecentEventRevenue: number;
  calculatedBorrowingLimit: number;
  borrowingLimit: number;
  isLimitOverridden: boolean;
  limitBasis: { eventId: string; eventTitle: string; eventDate: string; revenue: number }[];
}

interface OrganizerCapitalRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  createdAt: string;
  eligibility: Eligibility;
  metrics: CapitalMetrics;
  activeLoan: {
    _id: string;
    status: LoanStatus;
    approvedAmount?: number;
    requestedAmount: number;
    currency: Currency;
  } | null;
}

interface Loan {
  _id: string;
  referenceNumber?: string;
  organizer: { _id: string; firstName: string; lastName: string; email: string };
  requestedAmount: number;
  approvedAmount?: number;
  currency: Currency;
  status: LoanStatus;
  limitAtRequest: number;
  feeRate?: number;
  feeAmount?: number;
  totalRepayable?: number;
  outstandingBalance?: number;
  totalRepaid?: number;
  requestedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  disbursedAt?: string;
  disbursementReference?: string;
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

const StatusBadge = ({ status }: { status: LoanStatus }) => (
  <Badge className={STATUS_STYLES[status]}>{status}</Badge>
);

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CapitalPage() {
  const { token, admin } = useAdminAuthStore();
  const isPartner = admin?.role === "partner";

  const [tab, setTab] = useState("organizers");

  // Organizers tab state
  const [organizers, setOrganizers] = useState<OrganizerCapitalRow[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgPage, setOrgPage] = useState(1);
  const [orgTotalPages, setOrgTotalPages] = useState(1);
  const [currency, setCurrency] = useState<Currency>("ETB");
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [eligibilityTarget, setEligibilityTarget] = useState<OrganizerCapitalRow | null>(null);
  const [eligibilityChoice, setEligibilityChoice] = useState<Eligibility>("eligible");
  const [eligibilityNotes, setEligibilityNotes] = useState("");
  const [savingEligibility, setSavingEligibility] = useState(false);

  // Borrowing limit override dialog
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitTarget, setLimitTarget] = useState<OrganizerCapitalRow | null>(null);
  const [limitValue, setLimitValue] = useState("");
  const [limitNote, setLimitNote] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  // Loans tab state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(true);
  const [loanStatusFilter, setLoanStatusFilter] = useState<string>("pending");
  const [loanSearch, setLoanSearch] = useState("");
  const [loanPage, setLoanPage] = useState(1);
  const [loanTotalPages, setLoanTotalPages] = useState(1);
  const [loanStats, setLoanStats] = useState<Record<string, { count: number; amount: number }>>({});

  // Loan review dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewLoan, setReviewLoan] = useState<Loan | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [feeRatePercent, setFeeRatePercent] = useState("15");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOrganizers = useCallback(async () => {
    try {
      setOrgLoading(true);
      const params = new URLSearchParams({
        page: String(orgPage),
        limit: "10",
        currency,
        ...(orgSearch ? { search: orgSearch } : {}),
        // The "Eligible" tab reuses this table, restricted to eligible organizers.
        ...(tab === "eligible" ? { eligibility: "eligible" } : {}),
      });
      const res = await fetch(`${API_URL}/api/capital/admin/organizers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load organizers");
      setOrganizers(data.data);
      setOrgTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load organizers");
    } finally {
      setOrgLoading(false);
    }
  }, [orgPage, orgSearch, currency, token, tab]);

  const fetchLoans = useCallback(async () => {
    try {
      setLoansLoading(true);
      const params = new URLSearchParams({
        page: String(loanPage),
        limit: "10",
        ...(loanStatusFilter !== "all" ? { status: loanStatusFilter } : {}),
        ...(loanSearch ? { search: loanSearch } : {}),
      });
      const res = await fetch(`${API_URL}/api/capital/admin/loans?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load loan requests");
      setLoans(data.data);
      setLoanTotalPages(data.pagination?.pages || 1);
      setLoanStats(data.stats || {});
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load loan requests");
    } finally {
      setLoansLoading(false);
    }
  }, [loanPage, loanStatusFilter, loanSearch, token]);

  useEffect(() => {
    if (!token) return;
    if (tab === "organizers" || tab === "eligible") fetchOrganizers();
  }, [token, tab, fetchOrganizers]);

  useEffect(() => {
    if (!token) return;
    if (tab === "loans") fetchLoans();
  }, [token, tab, fetchLoans]);

  const openEligibilityDialog = (organizer: OrganizerCapitalRow) => {
    setEligibilityTarget(organizer);
    setEligibilityChoice(organizer.eligibility === "eligible" ? "not_eligible" : "eligible");
    setEligibilityNotes("");
    setEligibilityDialogOpen(true);
  };

  const handleSaveEligibility = async () => {
    if (!eligibilityTarget) return;
    try {
      setSavingEligibility(true);
      const res = await fetch(
        `${API_URL}/api/capital/admin/organizers/${eligibilityTarget._id}/eligibility`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ eligibility: eligibilityChoice, notes: eligibilityNotes }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update eligibility");
      toast.success(
        eligibilityChoice === "eligible"
          ? "Organizer marked eligible for Pazimo Capital"
          : "Organizer marked not eligible"
      );
      setEligibilityDialogOpen(false);
      fetchOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update eligibility");
    } finally {
      setSavingEligibility(false);
    }
  };

  const openLimitDialog = (organizer: OrganizerCapitalRow) => {
    setLimitTarget(organizer);
    setLimitValue(String(organizer.metrics.borrowingLimit));
    setLimitNote("");
    setLimitDialogOpen(true);
  };

  const saveBorrowingLimit = async (value: number | null) => {
    if (!limitTarget) return;
    try {
      setSavingLimit(true);
      const res = await fetch(
        `${API_URL}/api/capital/admin/organizers/${limitTarget._id}/borrowing-limit`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            borrowingLimitOverride: value,
            note: limitNote,
            currency,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update borrowing limit");
      toast.success(
        value === null ? "Reverted to the calculated limit" : "Custom borrowing limit saved"
      );
      setLimitDialogOpen(false);
      fetchOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update borrowing limit");
    } finally {
      setSavingLimit(false);
    }
  };

  const handleSaveLimit = () => {
    const value = Number(limitValue);
    if (!(value >= 0)) {
      toast.error("Enter a valid, non-negative limit");
      return;
    }
    saveBorrowingLimit(value);
  };

  const handleResetLimit = () => saveBorrowingLimit(null);

  const openReviewDialog = async (loan: Loan) => {
    setReviewLoan(loan);
    setApprovedAmount(String(loan.approvedAmount ?? loan.requestedAmount));
    setFeeRatePercent(String((loan.feeRate ?? 0.15) * 100));
    setRejectReason("");
    setReviewDialogOpen(true);
    try {
      const res = await fetch(`${API_URL}/api/capital/admin/loans/${loan._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReviewLoan(data.data.loan);
      }
    } catch (error) {
      console.error("Failed to load loan detail", error);
    }
  };

  const refreshReviewLoan = async () => {
    if (!reviewLoan) return;
    const res = await fetch(`${API_URL}/api/capital/admin/loans/${reviewLoan._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setReviewLoan(data.data.loan);
    }
  };

  const runAction = async (
    url: string,
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!reviewLoan) return;
    try {
      setSubmitting(true);
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Action failed");
      toast.success(successMessage);
      await refreshReviewLoan();
      fetchLoans();
      fetchOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () =>
    runAction(
      `${API_URL}/api/capital/admin/loans/${reviewLoan?._id}/approve`,
      "PATCH",
      { approvedAmount: Number(approvedAmount), feeRate: Number(feeRatePercent) / 100 },
      "Loan approved"
    );

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("A rejection reason is required");
      return;
    }
    runAction(
      `${API_URL}/api/capital/admin/loans/${reviewLoan?._id}/reject`,
      "PATCH",
      { reason: rejectReason },
      "Loan rejected"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="container mx-auto py-10 p-10 max-w-7xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pazimo Capital</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage organizer eligibility and review loan requests
            </p>
          </div>
          <Select value={currency} onValueChange={(v: Currency) => setCurrency(v)}>
            <SelectTrigger className="w-full sm:w-[120px] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
              <SelectItem value="ETB" className="dark:text-gray-200">ETB</SelectItem>
              <SelectItem value="USD" className="dark:text-gray-200">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setOrgPage(1);
          }}
        >
          <TabsList className="mb-6">
            <TabsTrigger value="organizers">
              <Building2 className="h-4 w-4 mr-1.5" /> Organizers
            </TabsTrigger>
            <TabsTrigger value="eligible">
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Eligible
            </TabsTrigger>
            <TabsTrigger value="loans">
              <ListChecks className="h-4 w-4 mr-1.5" /> Loan Requests
              {loanStats.pending?.count ? (
                <Badge className="ml-1.5 bg-yellow-500 text-white">{loanStats.pending.count}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Organizers / Eligible tab ----------------
              One panel serves both tabs: its value tracks whichever of the two
              is active, so the table renders for "organizers" and "eligible"
              (the latter fetches with an eligibility=eligible filter). */}
          <TabsContent value={tab === "eligible" ? "eligible" : "organizers"}>
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg border-t-4 border-t-emerald-600 dark:bg-gray-800">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                    <Input
                      placeholder="Search organizers..."
                      value={orgSearch}
                      onChange={(e) => {
                        setOrgSearch(e.target.value);
                        setOrgPage(1);
                      }}
                      className="pl-10 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
                    />
                  </div>
                  <Button onClick={fetchOrganizers} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="dark:text-gray-300">Organizer</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Events</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Total Revenue</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Last Event</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Avg (Last 2)</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Borrowing Limit</TableHead>
                        <TableHead className="dark:text-gray-300">Eligibility</TableHead>
                        <TableHead className="dark:text-gray-300">Active Loan</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Loading organizers...
                          </TableCell>
                        </TableRow>
                      ) : organizers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Building2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                            No organizers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        organizers.map((org) => (
                          <TableRow key={org._id} className="border-gray-100 dark:border-gray-700">
                            <TableCell>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {org.firstName} {org.lastName}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{org.email}</p>
                            </TableCell>
                            <TableCell className="text-right text-gray-700 dark:text-gray-300">
                              {org.metrics.totalEvents}
                            </TableCell>
                            <TableCell className="text-right text-gray-700 dark:text-gray-300">
                              {formatCompactMoney(org.metrics.totalRevenue, org.metrics.currency)}
                            </TableCell>
                            <TableCell className="text-right text-gray-700 dark:text-gray-300">
                              {formatCompactMoney(org.metrics.lastEventRevenue, org.metrics.currency)}
                            </TableCell>
                            <TableCell className="text-right text-gray-700 dark:text-gray-300">
                              {formatCompactMoney(org.metrics.averageRecentEventRevenue, org.metrics.currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  {formatCompactMoney(org.metrics.borrowingLimit, org.metrics.currency)}
                                </span>
                                {org.metrics.isLimitOverridden && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 text-[10px] px-1.5 py-0"
                                  >
                                    Custom
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  org.eligibility === "eligible"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                                    : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                }
                              >
                                {org.eligibility === "eligible" ? "Eligible" : "Not eligible"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {org.activeLoan ? (
                                <StatusBadge status={org.activeLoan.status} />
                              ) : (
                                <span className="text-sm text-gray-400 dark:text-gray-500">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isPartner && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openLimitDialog(org)}
                                    className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                  >
                                    <SlidersHorizontal className="h-4 w-4 mr-1" />
                                    Limit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEligibilityDialog(org)}
                                    className={
                                      org.eligibility === "eligible"
                                        ? "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                                        : "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                    }
                                  >
                                    {org.eligibility === "eligible" ? (
                                      <ShieldOff className="h-4 w-4 mr-1" />
                                    ) : (
                                      <ShieldCheck className="h-4 w-4 mr-1" />
                                    )}
                                    {org.eligibility === "eligible" ? "Revoke" : "Mark eligible"}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {orgPage} of {orgTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.max(p - 1, 1))}
                      disabled={orgPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.min(p + 1, orgTotalPages))}
                      disabled={orgPage === orgTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- Loans tab ---------------- */}
          <TabsContent value="loans">
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg border-t-4 border-t-blue-600 dark:bg-gray-800">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-[220px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                      <Input
                        placeholder="Search by reference..."
                        value={loanSearch}
                        onChange={(e) => {
                          setLoanSearch(e.target.value);
                          setLoanPage(1);
                        }}
                        className="pl-10 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
                      />
                    </div>
                    <Select
                      value={loanStatusFilter}
                      onValueChange={(v) => {
                        setLoanStatusFilter(v);
                        setLoanPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[200px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="repaid">Repaid</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={fetchLoans} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="dark:text-gray-300">Reference</TableHead>
                        <TableHead className="dark:text-gray-300">Organizer</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Requested</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Limit at Request</TableHead>
                        <TableHead className="dark:text-gray-300">Status</TableHead>
                        <TableHead className="dark:text-gray-300">Requested</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loansLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Loading loan requests...
                          </TableCell>
                        </TableRow>
                      ) : loans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Banknote className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                            No loan requests found
                          </TableCell>
                        </TableRow>
                      ) : (
                        loans.map((loan) => (
                          <TableRow key={loan._id} className="border-gray-100 dark:border-gray-700">
                            <TableCell>
                              <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                                {loan.referenceNumber || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {loan.organizer.firstName} {loan.organizer.lastName}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{loan.organizer.email}</p>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                              {formatCompactMoney(loan.requestedAmount, loan.currency)}
                            </TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">
                              {formatCompactMoney(loan.limitAtRequest, loan.currency)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={loan.status} />
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {new Date(loan.requestedAt || loan.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReviewDialog(loan)}
                                className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {loanPage} of {loanTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLoanPage((p) => Math.max(p - 1, 1))}
                      disabled={loanPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLoanPage((p) => Math.min(p + 1, loanTotalPages))}
                      disabled={loanPage === loanTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Eligibility Dialog */}
        <Dialog open={eligibilityDialogOpen} onOpenChange={setEligibilityDialogOpen}>
          <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                {eligibilityChoice === "eligible" ? "Mark eligible" : "Revoke eligibility"}
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                {eligibilityTarget?.firstName} {eligibilityTarget?.lastName} —{" "}
                {eligibilityChoice === "eligible"
                  ? "will be able to view their limit and request a loan."
                  : "will no longer be able to request a new loan. Any active loan continues as normal."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="dark:text-gray-300">Notes (optional)</Label>
              <Textarea
                value={eligibilityNotes}
                onChange={(e) => setEligibilityNotes(e.target.value)}
                placeholder="Reason for this decision"
                rows={3}
                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEligibilityDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEligibility}
                disabled={savingEligibility}
                className={
                  eligibilityChoice === "eligible"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {savingEligibility ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Borrowing Limit Dialog */}
        <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <DialogContent className="sm:max-w-lg dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">Borrowing limit</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                {limitTarget?.firstName} {limitTarget?.lastName}
              </DialogDescription>
            </DialogHeader>

            {limitTarget && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    Last 2 events used for this calculation
                  </p>
                  {limitTarget.metrics.limitBasis.length > 0 ? (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="dark:text-gray-300">Event</TableHead>
                            <TableHead className="dark:text-gray-300">Date</TableHead>
                            <TableHead className="dark:text-gray-300 text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {limitTarget.metrics.limitBasis.map((event) => (
                            <TableRow key={event.eventId} className="border-gray-100 dark:border-gray-700">
                              <TableCell className="text-gray-900 dark:text-gray-100">
                                {event.eventTitle}
                              </TableCell>
                              <TableCell className="text-gray-600 dark:text-gray-400">
                                {new Date(event.eventDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right text-gray-900 dark:text-gray-100">
                                {formatCompactMoney(event.revenue, limitTarget.metrics.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No past events yet — nothing to base a limit on.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Average revenue</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCompactMoney(limitTarget.metrics.averageRecentEventRevenue, limitTarget.metrics.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Calculated limit (30%)</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCompactMoney(limitTarget.metrics.calculatedBorrowingLimit, limitTarget.metrics.currency)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="dark:text-gray-300">
                    Effective limit ({limitTarget.metrics.currency})
                  </Label>
                  <Input
                    type="number"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  />
                  {limitTarget.metrics.isLimitOverridden && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      This organizer currently has a custom limit set by an admin.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="dark:text-gray-300">Note (optional)</Label>
                  <Textarea
                    value={limitNote}
                    onChange={(e) => setLimitNote(e.target.value)}
                    placeholder="Reason for a custom limit, e.g. upcoming event looks strong"
                    rows={2}
                    className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              {limitTarget?.metrics.isLimitOverridden ? (
                <Button
                  variant="outline"
                  onClick={handleResetLimit}
                  disabled={savingLimit}
                  className="border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Reset to calculated
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveLimit}
                  disabled={savingLimit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {savingLimit ? "Saving..." : "Save limit"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Loan Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                Loan Request — {reviewLoan?.organizer.firstName} {reviewLoan?.organizer.lastName}
              </DialogTitle>
              {reviewLoan && (
                <DialogDescription className="flex items-center gap-2 dark:text-gray-400">
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {reviewLoan.referenceNumber || "—"}
                  </span>
                  <StatusBadge status={reviewLoan.status} />
                </DialogDescription>
              )}
            </DialogHeader>

            {reviewLoan && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Requested amount</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCompactMoney(reviewLoan.requestedAmount, reviewLoan.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Limit at request</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCompactMoney(reviewLoan.limitAtRequest, reviewLoan.currency)}
                    </p>
                  </div>
                  {reviewLoan.approvedAmount !== undefined && reviewLoan.status !== "pending" && (
                    <>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Approved amount</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(reviewLoan.approvedAmount || 0, reviewLoan.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Fee ({((reviewLoan.feeRate ?? 0.15) * 100).toFixed(0)}%) / Total repayable
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(reviewLoan.feeAmount || 0, reviewLoan.currency)} /{" "}
                          {formatCompactMoney(reviewLoan.totalRepayable || 0, reviewLoan.currency)}
                        </p>
                      </div>
                    </>
                  )}
                  {(reviewLoan.status === "active" || reviewLoan.status === "repaid") && (
                    <>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Outstanding balance</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatCompactMoney(reviewLoan.outstandingBalance || 0, reviewLoan.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Total repaid</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(reviewLoan.totalRepaid || 0, reviewLoan.currency)}
                        </p>
                      </div>
                    </>
                  )}
                  {reviewLoan.rejectionReason && (
                    <div className="col-span-2">
                      <p className="text-gray-500 dark:text-gray-400">Rejection reason</p>
                      <p className="text-gray-900 dark:text-gray-100">{reviewLoan.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {!isPartner && reviewLoan.status === "pending" && (
                  <div className="space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Review request</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="dark:text-gray-300">Approved amount ({reviewLoan.currency})</Label>
                        <Input
                          type="number"
                          value={approvedAmount}
                          onChange={(e) => setApprovedAmount(e.target.value)}
                          className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="dark:text-gray-300">Interest / fee rate (%)</Label>
                        <Input
                          type="number"
                          value={feeRatePercent}
                          onChange={(e) => setFeeRatePercent(e.target.value)}
                          className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Approving credits{" "}
                      {formatCompactMoney(Number(approvedAmount) || 0, reviewLoan.currency)} to the
                      organizer&apos;s withdrawal balance immediately. With a {feeRatePercent || 0}% fee they
                      repay{" "}
                      {formatCompactMoney(
                        Math.round((Number(approvedAmount) || 0) * (1 + (Number(feeRatePercent) || 0) / 100) * 100) / 100,
                        reviewLoan.currency
                      )}
                      , taken automatically as {DEBT_CUT_PERCENT}% of their ticket sales — no
                      manual repayment needed.
                    </p>
                    <Button
                      onClick={handleApprove}
                      disabled={submitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Approve &amp; credit balance
                    </Button>
                    <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Label className="dark:text-gray-300">Rejection reason</Label>
                      <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <Button
                      onClick={handleReject}
                      disabled={submitting}
                      variant="outline"
                      className="w-full border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Reject loan
                    </Button>
                  </div>
                )}

               
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
