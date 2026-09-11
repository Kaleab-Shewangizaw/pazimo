"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import {
  DollarSign,
  Wallet,
  AlertCircle,
  Smartphone,
  Landmark,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { io, type Socket } from "socket.io-client";
import { cn } from "@/lib/utils";

const PAYOUT_METHODS: {
  id: "telebirr" | "mpesa" | "bank";
  label: string;
  icon: typeof Smartphone;
}[] = [
  { id: "telebirr", label: "Telebirr", icon: Smartphone },
  { id: "mpesa", label: "M-Pesa", icon: Smartphone },
  { id: "bank", label: "Bank", icon: Landmark },
];

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface Withdrawal {
  _id: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  currency?: "ETB" | "USD";
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
  processedAt?: string;
  notes?: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    accountHolderName?: string;
  };
  transactionId?: string;
  processedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface LoanInfo {
  currency?: "ETB" | "USD";
  principalCredited: number;
  totalRepaidFromTickets: number;
  outstandingDebt: number;
  activeLoan?: {
    _id: string;
    feeRate?: number;
    totalRepayable?: number;
    totalRepaid?: number;
    outstandingBalance?: number;
  } | null;
}

interface BalanceData {
  currency?: "ETB" | "USD";
  totalRevenue: number;
  pazimoCommission: number;
  vatOnCommission: number;
  // VAT withheld and remitted to the government for organizers who have no
  // licence of their own. Zero for everyone else.
  organizerVat: number;
  effectiveCommissionRate: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  availableBalance: number;
  loan?: LoanInfo;
  revenueBreakdown: Array<{
    eventId: string;
    eventTitle: string;
    totalRevenue: number;
    ticketTypeBreakdown: Array<{
      name: string;
      price: number;
      quantitySold: number;
      revenue: number;
    }>;
    totalTicketsSold: number;
  }>;
  summary: {
    totalEvents: number;
    totalTicketsSold: number;
    averageTicketPrice: number;
  };
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETB" | "USD">("ETB");
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    accountHolderName: "",
  });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchWithdrawals();
    fetchBalance();

    const storedAuth = localStorage.getItem("auth-storage");
    let token = "";
    let userId = "";
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth);
        token = parsedAuth.state?.token;
        userId = parsedAuth.state?.user?._id;
      } catch {}
    }

    if (!token || !userId) return;

    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
        auth: { token },
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        // console.log("Socket connected (withdrawals page):", socketRef.current?.id)
      });

      socketRef.current.on("disconnect", () => {
        // console.log("Socket disconnected (withdrawals page)")
      });
    }

    socketRef.current.emit("joinOrganizerRoom", userId);

    socketRef.current.on("withdrawalStatusUpdated", (data) => {
      toast.success(
        `Your withdrawal of ${data.amount} ${data.currency || selectedCurrency} has been ${data.status}.`
      );
      fetchWithdrawals();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("withdrawalStatusUpdated");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentPage, itemsPerPage, statusFilter, selectedCurrency]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const storedAuth = localStorage.getItem("auth-storage");
      let token = "";
      let userId = "";
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          token = parsedAuth.state?.token;
          userId = parsedAuth.state?.user?._id;
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to view withdrawals");
        return;
      }

      const response = await fetch(
        // `stream=tickets` keeps bar takings out of this history — those are
        // requested and listed on the beverages dashboard instead.
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}&currency=${selectedCurrency}&stream=tickets`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch withdrawals");
      }

      const data = await response.json();

      console.log("Withdrawal fetch response:", data);
      if (data.success) {
        setWithdrawals(data.data || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        throw new Error(data.message || "Failed to fetch withdrawals");
      }
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch withdrawals"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const storedAuth = localStorage.getItem("auth-storage");
      let token = "";
      let userId = "";
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          token = parsedAuth.state?.token;
          userId = parsedAuth.state?.user?._id;
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to view balance");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/balance?currency=${selectedCurrency}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch balance");
      }

      const data = await response.json();
      if (data.success) {
        setBalance(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch balance");
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch balance"
      );
    }
  };

  const handleWithdraw = async () => {
    const availableBalance = balance?.availableBalance ?? 0;

    if (!withdrawAmount || Number.parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number.parseFloat(withdrawAmount) > availableBalance || !balance) {
      toast.error("Withdrawal amount cannot exceed available balance");
      return;
    }
    if (!bankDetails.bankName) {
      toast.error("Please select a payment method");
      return;
    }
    if (!bankDetails.accountHolderName.trim()) {
      toast.error("Please enter the full name of the account holder");
      return;
    }
    if (
      (bankDetails.bankName === "telebirr" ||
        bankDetails.bankName === "mpesa") &&
      !bankDetails.accountNumber
    ) {
      toast.error(
        "Please provide the phone number for the selected payment method"
      );
      return;
    }
    if (
      bankDetails.bankName === "bank" &&
      (!bankDetails.accountName || !bankDetails.accountNumber)
    ) {
      toast.error("Please provide all bank account details");
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      const storedAuth = localStorage.getItem("auth-storage");
      let token = "";
      let userId = "";
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          token = parsedAuth.state?.token;
          userId = parsedAuth.state?.user?._id;
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to request withdrawal");
        return;
      }

      const requestBody = {
        amount: Number.parseFloat(withdrawAmount),
        currency: selectedCurrency,
        // Draws the ticket pool. Beverage requests are posted from the
        // beverages dashboard with stream: "beverages".
        stream: "tickets",
        bankDetails,
      };

      console.log("Sending withdrawal request:", requestBody);
      console.log(
        "API URL:",
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to request withdrawal");
      }

      const data = await response.json();
      console.log("Withdrawal request response:", data);
      if (data.success) {
        toast.success("Withdrawal request submitted successfully");
        setWithdrawDialogOpen(false);
        setWithdrawAmount("");
        setBankDetails({
          accountName: "",
          accountNumber: "",
          bankName: "",
          accountHolderName: "",
        });
        fetchWithdrawals();
        fetchBalance();
      } else {
        throw new Error(data.message || "Failed to request withdrawal");
      }
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        toast.error(error.message);
      } else {
        console.error("Unknown error:", error);
        toast.error("Failed to request withdrawal");
      }
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const TELEBIRR_FEE_RATE = 0.02;
  const parsedWithdrawAmount = Number.parseFloat(withdrawAmount || "0");
  const telebirrNetAmount =
    parsedWithdrawAmount > 0
      ? parsedWithdrawAmount * (1 - TELEBIRR_FEE_RATE)
      : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <PageHeader
          title="Ticket Withdrawals"
          description={
            <>
              Your ticket revenue and the payouts drawn from it. Bar takings are
              a separate balance — settle those on your{" "}
              <Link
                href="/organizer/beverages"
                className="font-medium text-primary hover:underline"
              >
                beverages dashboard
              </Link>
              .
            </>
          }
          actions={
            <>
              <Select
                value={selectedCurrency}
                onValueChange={(value: "ETB" | "USD") => {
                  setSelectedCurrency(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[110px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={!balance || balance.availableBalance <= 0}
              >
                <DollarSign className="h-4 w-4" />
                Request Withdrawal
              </Button>
            </>
          }
        />

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            loading={loading}
            label="Available balance"
            icon={Wallet}
            value={`${balance?.availableBalance.toFixed(2) || "0.00"} ${selectedCurrency}`}
            // Driven by what was actually deducted, not a fixed 3%: rates
            // vary per event, and an organizer whose VAT Pazimo covers loses
            // a further 15% on top.
            hint={
              balance && balance.organizerVat > 0
                ? `After ${((balance.effectiveCommissionRate ?? 0) * 100).toFixed(2)}% commission and ${formatAmount(balance.organizerVat)} ${selectedCurrency} VAT paid for you`
                : balance && balance.totalRevenue > 0
                  ? `After ${((balance.effectiveCommissionRate ?? 0) * 100).toFixed(2)}% commission and VAT`
                  : "After commission and VAT"
            }
          />
          <StatCard
            loading={loading}
            label="Pending withdrawals"
            icon={AlertCircle}
            value={`${balance?.pendingWithdrawals.toFixed(2) || "0.00"} ${selectedCurrency}`}
          />
          <StatCard
            loading={loading}
            label="Approved withdrawals"
            icon={DollarSign}
            value={`${balance?.approvedWithdrawals.toFixed(2) || "0.00"} ${selectedCurrency}`}
          />
        </div>

      {/* Withdrawals Table */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
            <h2 className="text-base font-semibold">Withdrawal History</h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Processed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState icon={Wallet} title="No withdrawal requests found" />
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal._id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          {withdrawal.amount.toFixed(2)} {withdrawal.currency || selectedCurrency}
                        </div>
                        {!!withdrawal.feeAmount && withdrawal.feeAmount > 0 && (
                          <div className="text-[11px] font-normal text-warning mt-0.5">
                            -{withdrawal.feeAmount.toFixed(2)} fee &middot; you get{" "}
                            {(withdrawal.netAmount ?? withdrawal.amount - withdrawal.feeAmount).toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            withdrawal.status === "completed" || withdrawal.status === "approved"
                              ? "success"
                              : withdrawal.status === "pending"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {withdrawal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {withdrawal.transactionId || "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] sm:max-w-[200px] truncate text-muted-foreground">
                        {withdrawal.notes}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {withdrawal.processedBy?.firstName || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8 text-xs">
                    <SelectValue placeholder="5" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Request Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Request Withdrawal</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm mt-0.5">
                  Funds are sent to the payout account you specify below.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 space-y-5">
            {/* Available balance */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3.5 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Available Balance
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatAmount(balance?.availableBalance ?? 0)} {selectedCurrency}
              </span>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="withdraw-amount" className="text-sm">
                  Amount to withdraw
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setWithdrawAmount(
                      (balance?.availableBalance ?? 0).toFixed(2)
                    )
                  }
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Withdraw max
                </button>
              </div>
              <div className="relative">
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="h-12 pr-16 text-xl font-semibold tabular-nums"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {selectedCurrency}
                </span>
              </div>
              {Number.parseFloat(withdrawAmount || "0") >
                (balance?.availableBalance ?? 0) && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Amount exceeds your available balance
                </p>
              )}
            </div>

            {/* Payout method */}
            <div className="space-y-2">
              <Label className="text-sm">Payout Method</Label>
              <RadioGroup
                value={bankDetails.bankName}
                onValueChange={(value) =>
                  setBankDetails((prev) => ({
                    ...prev,
                    bankName: value,
                    accountName: "",
                    accountNumber: "",
                  }))
                }
                className="grid grid-cols-3 gap-2"
              >
                {PAYOUT_METHODS.map((method) => {
                  const checked = bankDetails.bankName === method.id;
                  const Icon = method.icon;
                  return (
                    <div key={method.id} className="relative">
                      <RadioGroupItem
                        value={method.id}
                        id={`payout-${method.id}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`payout-${method.id}`}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center cursor-pointer transition-colors",
                          checked
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-foreground/30"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            checked ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs font-medium",
                            checked ? "text-primary" : "text-foreground"
                          )}
                        >
                          {method.label}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {bankDetails.bankName === "telebirr" && (
                <Alert className="rounded-lg border-warning/30 bg-warning/10 px-3.5 py-3">
                  <Info className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-xs leading-relaxed">
                    Telebirr charges a 2% fee on withdrawals, which will be
                    deducted from this request.
                    {parsedWithdrawAmount > 0 && (
                      <>
                        {" "}
                        You&apos;ll receive{" "}
                        <span className="font-semibold">
                          {formatAmount(telebirrNetAmount)} {selectedCurrency}
                        </span>{" "}
                        after the fee.
                      </>
                    )}{" "}
                    Choose <span className="font-medium">Bank</span> to avoid
                    this deduction and receive the full amount.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Method-specific account details */}
            {(bankDetails.bankName === "telebirr" ||
              bankDetails.bankName === "mpesa" ||
              bankDetails.bankName === "bank") && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payout Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="account-holder-name" className="text-sm">
                    Full Name of the Account Holder
                  </Label>
                  <Input
                    id="account-holder-name"
                    value={bankDetails.accountHolderName}
                    onChange={(e) =>
                      setBankDetails((prev) => ({
                        ...prev,
                        accountHolderName: e.target.value,
                      }))
                    }
                    placeholder="Enter the full name as it appears on the account"
                    className="text-sm"
                  />
                </div>
                {bankDetails.bankName === "telebirr" && (
                  <div className="space-y-2">
                    <Label htmlFor="telebirr-phone" className="text-sm">
                      Telebirr Phone Number
                    </Label>
                    <Input
                      id="telebirr-phone"
                      value={bankDetails.accountNumber}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          accountNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter Telebirr phone number"
                      className="text-sm"
                    />
                  </div>
                )}
                {bankDetails.bankName === "mpesa" && (
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-phone" className="text-sm">
                      M-Pesa Phone Number
                    </Label>
                    <Input
                      id="mpesa-phone"
                      value={bankDetails.accountNumber}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          accountNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter M-Pesa phone number"
                      className="text-sm"
                    />
                  </div>
                )}
                {bankDetails.bankName === "bank" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm">Bank Name</Label>
                      <Select
                        value={bankDetails.accountName}
                        onValueChange={(value) =>
                          setBankDetails((prev) => ({
                            ...prev,
                            accountName: value,
                          }))
                        }
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Commercial Bank of Ethiopia">
                            Commercial Bank of Ethiopia
                          </SelectItem>
                          <SelectItem value="Awash International Bank">
                            Awash International Bank
                          </SelectItem>
                          <SelectItem value="Bank of Abyssinia">
                            Bank of Abyssinia
                          </SelectItem>
                          <SelectItem value="Dashen Bank">Dashen Bank</SelectItem>
                          <SelectItem value="Hibret Bank">Hibret Bank</SelectItem>
                          <SelectItem value="Zemen Bank">Zemen Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Bank Account Number</Label>
                      <Input
                        value={bankDetails.accountNumber}
                        onChange={(e) =>
                          setBankDetails((prev) => ({
                            ...prev,
                            accountNumber: e.target.value,
                          }))
                        }
                        placeholder="Enter account number"
                        className="text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2 px-5 sm:px-6 py-4 border-t bg-muted/30">
            <Button
              variant="outline"
              onClick={() => setWithdrawDialogOpen(false)}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                isSubmittingWithdraw ||
                Number.parseFloat(withdrawAmount) <= 0 ||
                Number.parseFloat(withdrawAmount) > (balance?.availableBalance ?? 0) ||
                !bankDetails.bankName ||
                !bankDetails.accountHolderName.trim() ||
                ((bankDetails.bankName === "telebirr" ||
                  bankDetails.bankName === "mpesa") &&
                  !bankDetails.accountNumber) ||
                (bankDetails.bankName === "bank" &&
                  (!bankDetails.accountName || !bankDetails.accountNumber))
              }
              className="w-full sm:w-auto text-sm"
            >
              {isSubmittingWithdraw ? "Processing..." : "Request Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}