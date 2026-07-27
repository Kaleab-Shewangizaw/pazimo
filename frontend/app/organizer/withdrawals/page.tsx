"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DollarSign, Wallet, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Withdrawal {
  _id: string;
  amount: number;
  currency?: "ETB" | "USD";
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
  processedAt?: string;
  notes?: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
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
  const [withdrawNotes, setWithdrawNotes] = useState("");
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}&currency=${selectedCurrency}`,
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
        notes: withdrawNotes,
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
        setWithdrawNotes("");
        setBankDetails({
          accountName: "",
          accountNumber: "",
          bankName: "",
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

  const SkeletonCard = () => (
    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-black relative">
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
      <CardContent className="p-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent animate-shimmer" />
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold dark:text-gray-100">Withdrawals</h1>
        <p className="text-muted-foreground dark:text-gray-400 text-sm sm:text-base mt-1">
          Manage your earnings and withdrawal requests
        </p>
        <div className="mt-3 w-full sm:w-[180px]">
          <Select
            value={selectedCurrency}
            onValueChange={(value: "ETB" | "USD") => {
              setSelectedCurrency(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-sm dark:bg-black dark:border-gray-700 dark:text-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-black dark:border-gray-700">
              <SelectItem value="ETB" className="dark:text-gray-200">ETB</SelectItem>
              <SelectItem value="USD" className="dark:text-gray-200">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-emerald-100 hover:from-emerald-100 hover:to-white dark:from-black dark:to-emerald-950/30 dark:hover:from-emerald-950/40 dark:hover:to-black">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Available Balance
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {balance?.availableBalance.toFixed(2) || "0.00"} {selectedCurrency}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
                      After 3% commission
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shadow-sm">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-orange-100 hover:from-orange-100 hover:to-white dark:from-black dark:to-orange-950/30 dark:hover:from-orange-950/40 dark:hover:to-black">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Pending Withdrawals
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {balance?.pendingWithdrawals.toFixed(2) || "0.00"} {selectedCurrency}
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 shadow-sm">
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-green-100 hover:from-green-100 hover:to-white dark:from-black dark:to-green-950/30 dark:hover:from-green-950/40 dark:hover:to-black">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Approved Withdrawals
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {balance?.approvedWithdrawals.toFixed(2) || "0.00"} {selectedCurrency}
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-green-100 dark:bg-green-900/30 shadow-sm">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

          </>
        )}
      </div>

      {/* Withdrawal Request Button */}
      <div className="mb-6 sm:mb-8">
        <Button
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={!balance || balance.availableBalance <= 0}
          className="w-full sm:w-auto bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 dark:bg-[#1a2d5a] dark:hover:bg-[#1a2d5a]/80 text-sm sm:text-base py-2 sm:py-2.5 px-4 sm:px-5 text-white"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Request Withdrawal
        </Button>
      </div>

      {/* Withdrawals Table */}
      <Card className="dark:bg-black dark:border-gray-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
            <h2 className="text-lg sm:text-xl font-semibold dark:text-gray-100">
              Withdrawal History
            </h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm sm:text-base dark:bg-black dark:border-gray-700 dark:text-gray-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="dark:bg-black dark:border-gray-700">
                <SelectItem value="all" className="dark:text-gray-200">All Status</SelectItem>
                <SelectItem value="pending" className="dark:text-gray-200">Pending</SelectItem>
                <SelectItem value="completed" className="dark:text-gray-200">Completed</SelectItem>
                <SelectItem value="rejected" className="dark:text-gray-200">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-800">
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">Date</TableHead>
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">Amount</TableHead>
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">
                    Transaction ID
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">Notes</TableHead>
                  <TableHead className="text-xs sm:text-sm dark:text-gray-300">
                    Processed By
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground dark:text-gray-400 text-sm py-8"
                    >
                      No withdrawal requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal._id} className="border-gray-100 dark:border-gray-800">
                      <TableCell className="text-xs sm:text-sm dark:text-gray-300">
                        {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm dark:text-gray-100">
                        {withdrawal.amount.toFixed(2)} {withdrawal.currency || selectedCurrency}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge
                          variant="outline"
                          className={`px-2 py-0.5 sm:px-3 sm:py-1 text-xs ${
                            withdrawal.status === "completed" || withdrawal.status === "approved"
                              ? "bg-green-500 text-white dark:bg-green-600"
                              : withdrawal.status === "pending"
                              ? "bg-yellow-500 text-white dark:bg-yellow-600"
                              : "bg-red-500 text-white dark:bg-red-600"
                          }`}
                        >
                          {withdrawal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm dark:text-gray-300">
                        {withdrawal.transactionId || "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] sm:max-w-[200px] truncate text-xs sm:text-sm dark:text-gray-300">
                        {withdrawal.notes}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm dark:text-gray-300">
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
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Rows per page:
                </span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8 sm:w-20 sm:h-9 border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200 text-xs sm:text-sm">
                    <SelectValue placeholder="5" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-black dark:border-gray-700">
                    <SelectItem value="5" className="dark:text-gray-200">5</SelectItem>
                    <SelectItem value="10" className="dark:text-gray-200">10</SelectItem>
                    <SelectItem value="20" className="dark:text-gray-200">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-black dark:text-gray-300"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 dark:bg-[#1a2d5a] dark:hover:bg-[#1a2d5a]/80 text-white"
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
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 dark:bg-black dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl dark:text-gray-100">
              Request Withdrawal
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base dark:text-gray-400">
              Enter the amount you wish to withdraw from your available balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount" className="text-sm dark:text-gray-300">
                Amount ({selectedCurrency})
              </Label>
              <Input
                id="withdraw-amount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.01"
                className="text-sm dark:bg-black dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method" className="text-sm dark:text-gray-300">
                Payment Method
              </Label>
              <Select
                value={bankDetails.bankName}
                onValueChange={(value) =>
                  setBankDetails((prev) => ({
                    ...prev,
                    bankName: value,
                    accountName: "",
                    accountNumber: "",
                  }))
                }
              >
                <SelectTrigger id="payment-method" className="text-sm dark:bg-black dark:border-gray-700 dark:text-gray-200">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent className="dark:bg-black dark:border-gray-700">
                  <SelectItem value="telebirr" className="dark:text-gray-200">Telebirr</SelectItem>
                  <SelectItem value="mpesa" className="dark:text-gray-200">M-Pesa</SelectItem>
                  <SelectItem value="bank" className="dark:text-gray-200">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankDetails.bankName === "telebirr" && (
              <div className="space-y-2">
                <Label htmlFor="telebirr-phone" className="text-sm dark:text-gray-300">
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
                  className="text-sm dark:bg-black dark:border-gray-700 dark:text-gray-100"
                />
              </div>
            )}
            {bankDetails.bankName === "mpesa" && (
              <div className="space-y-2">
                <Label htmlFor="mpesa-phone" className="text-sm dark:text-gray-300">
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
                  className="text-sm dark:bg-black dark:border-gray-700 dark:text-gray-100"
                />
              </div>
            )}

            {bankDetails.bankName === "bank" && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Bank Name</Label>
                  <Select
                    value={bankDetails.accountName}
                    onValueChange={(value) =>
                      setBankDetails((prev) => ({
                        ...prev,
                        accountName: value,
                      }))
                    }
                  >
                    <SelectTrigger className="border-gray-300 dark:border-gray-700 dark:bg-black dark:text-gray-200">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-black dark:border-gray-700">
                      <SelectItem value="Commercial Bank of Ethiopia" className="dark:text-gray-200">
                        Commercial Bank of Ethiopia
                      </SelectItem>
                      <SelectItem value="Awash International Bank" className="dark:text-gray-200">
                        Awash International Bank
                      </SelectItem>
                      <SelectItem value="Bank of Abyssinia" className="dark:text-gray-200">
                        Bank of Abyssinia
                      </SelectItem>
                      <SelectItem value="Dashen Bank" className="dark:text-gray-200">Dashen Bank</SelectItem>
                      <SelectItem value="Hibret Bank" className="dark:text-gray-200">Hibret Bank</SelectItem>
                      <SelectItem value="Nib International Bank" className="dark:text-gray-200">
                        Nib International Bank
                      </SelectItem>
                      <SelectItem value="Cooperative Bank of Oromia" className="dark:text-gray-200">
                        Cooperative Bank of Oromia
                      </SelectItem>
                      <SelectItem value="Lion International Bank" className="dark:text-gray-200">
                        Lion International Bank
                      </SelectItem>
                      <SelectItem value="Wegagen Bank" className="dark:text-gray-200">Wegagen Bank</SelectItem>
                      <SelectItem value="Zemen Bank" className="dark:text-gray-200">Zemen Bank</SelectItem>
                      <SelectItem value="Oromia International Bank" className="dark:text-gray-200">
                        Oromia International Bank
                      </SelectItem>
                      <SelectItem value="Global Bank Ethiopia" className="dark:text-gray-200">
                        Global Bank Ethiopia
                      </SelectItem>
                      <SelectItem value="Enat Bank" className="dark:text-gray-200">Enat Bank</SelectItem>
                      <SelectItem value="Addis International Bank" className="dark:text-gray-200">
                        Addis International Bank
                      </SelectItem>
                      <SelectItem value="Abay Bank" className="dark:text-gray-200">Abay Bank</SelectItem>
                      <SelectItem value="Berhan International Bank" className="dark:text-gray-200">
                        Berhan International Bank
                      </SelectItem>
                      <SelectItem value="Bunna International Bank" className="dark:text-gray-200">
                        Bunna International Bank
                      </SelectItem>
                      <SelectItem value="ZamZam Bank" className="dark:text-gray-200">ZamZam Bank</SelectItem>
                      <SelectItem value="Shabelle Bank" className="dark:text-gray-200">Shabelle Bank</SelectItem>
                      <SelectItem value="Hijra Bank" className="dark:text-gray-200">Hijra Bank</SelectItem>
                      <SelectItem value="Siinqee Bank" className="dark:text-gray-200">Siinqee Bank</SelectItem>
                      <SelectItem value="Ahadu Bank" className="dark:text-gray-200">Ahadu Bank</SelectItem>
                      <SelectItem value="Goh Betoch Bank" className="dark:text-gray-200">Goh Betoch Bank</SelectItem>
                      <SelectItem value="Tsedey Bank" className="dark:text-gray-200">Tsedey Bank</SelectItem>
                      <SelectItem value="Tsehay Bank" className="dark:text-gray-200">Tsehay Bank</SelectItem>
                      <SelectItem value="Gadaa Bank" className="dark:text-gray-200">Gadaa Bank</SelectItem>
                      <SelectItem value="Amhara Bank" className="dark:text-gray-200">Amhara Bank</SelectItem>
                      <SelectItem value="Rammis Bank" className="dark:text-gray-200">Rammis Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Bank Account Number</Label>
                  <Input
                    value={bankDetails.accountNumber}
                    onChange={(e) =>
                      setBankDetails((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter account number"
                    className="border-gray-300 dark:border-gray-700 dark:bg-black dark:text-gray-100"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm dark:text-gray-300">
                Notes (optional)
              </Label>
              <Textarea
                id="notes"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="Add any notes about this withdrawal request"
                rows={3}
                className="text-sm dark:bg-black dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
            <div className="p-3 bg-muted/50 dark:bg-gray-900/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Available Balance:{" "}
                  {(balance?.availableBalance ?? 0).toFixed(2)} {selectedCurrency}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setWithdrawDialogOpen(false)}
              className="w-full sm:w-auto text-sm dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                ((bankDetails.bankName === "telebirr" ||
                  bankDetails.bankName === "mpesa") &&
                  !bankDetails.accountNumber) ||
                (bankDetails.bankName === "bank" &&
                  (!bankDetails.accountName || !bankDetails.accountNumber))
              }
              className="w-full sm:w-auto bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 dark:bg-[#1a2d5a] dark:hover:bg-[#1a2d5a]/80 text-white text-sm"
            >
              {isSubmittingWithdraw ? "Processing..." : "Request Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}