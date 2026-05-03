"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  Ticket,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  BarChart3,
  QrCode,
  Download,
  Copy,
  Plus,
  Users,
  Activity,
  Bell,
  Settings,
  CreditCard,
  Share2,
  ExternalLink,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { formatCompactMoney } from "@/lib/utils";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import QRCode from "qrcode";
import { toast } from "sonner";
import { downloadHighQualityQR } from "@/lib/downloadQR";

const SkeletonCard = () => (
  <Card className="overflow-hidden border-none shadow-md bg-white relative">
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
    <CardContent className="p-2 sm:p-3 lg:p-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-6 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
      </div>
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
    </CardContent>
  </Card>
);

export default function OrganizerDashboard() {
  type SalesPeriod = "daily" | "weekly" | "monthly" | "all-time";

  const router = useRouter();
  const { events, isLoading, error, fetchEvents } = useEventStore();
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [activeTicketsByEvent, setActiveTicketsByEvent] = useState<{
    [eventId: string]: any[];
  }>({});
  const [allTicketsByEvent, setAllTicketsByEvent] = useState<{
    [eventId: string]: any[];
  }>({});
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [showEarnings, setShowEarnings] = useState<{ [key: string]: boolean }>({
    revenue: true,
    "organizer-revenue": true,
    "pazimo-commission": true,
    "total-withdrawn": true,
  });
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETB" | "USD">(
    "ETB"
  );
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all-time");

  // Pagination states
  const [eventsPage, setEventsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  //this function counts the number of events that are completed or which end date is already passed.

  const countCompletedEvents = () => {
    const now = new Date();
    return events.filter((event) => new Date(event.endDate) < now).length;
  };

  useEffect(() => {
    const authState = localStorage.getItem("auth-storage");
    if (!authState) {
      setCheckedAuth(true);
      return;
    }
    try {
      const { state } = JSON.parse(authState);
      const { user, token, isAuthenticated } = state;
      if (!isAuthenticated || !token || user.role !== "organizer") {
        setCheckedAuth(true);
        return;
      }
      setUser(user);
      localStorage.setItem("userId", user._id);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("token", token);
      fetchEvents(user._id);
      setCheckedAuth(true);
    } catch (error) {
      setCheckedAuth(true);
    }
  }, [fetchEvents]);

  useEffect(() => {
    const fetchTickets = async () => {
      if (isLoading) return;
      if (!user) return;

      if (events.length === 0) {
        setTicketsLoading(false);
        return;
      }

      setTicketsLoading(true);
      const token = localStorage.getItem("token");
      const ticketsMap: { [eventId: string]: any[] } = {};
      const allTicketsMap: { [eventId: string]: any[] } = {};

      // Fetch all tickets for each event to show comprehensive analytics
      // including both active and used tickets

      for (const event of events) {
        try {
          let allRawTickets: any[] = [];
          let page = 1;
          let hasMore = true;

          // Fetch all pages for this event
          while (hasMore) {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${event._id}?page=${page}&limit=500`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (res.ok) {
              const data = await res.json();
              allRawTickets = [...allRawTickets, ...(data.tickets || [])];
              hasMore = data.hasMore || false;
              page++;
            } else {
              hasMore = false;
            }
          }

          const rawTickets = allRawTickets;

          // Filter to match admin/tickets page logic
          // Include all tickets that have a price > 0, regardless of status
          const allTickets = rawTickets.filter((t: any) => {
            return t.price && t.price > 0;
          });

          // Helper to calculate ticket quantity
          const getTicketQuantity = (ticket: any) => {
            let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

            // Check if ticket was bought before Dec 14, 2025
            const cutoffDate = new Date("2025-12-14");
            const ticketDate = new Date(
              ticket.createdAt || ticket.purchaseDate
            );

            if (ticketDate < cutoffDate) {
              if (event.ticketTypes && ticket.price > 0) {
                const type = event.ticketTypes.find(
                  (t: any) =>
                    t.name === ticket.ticketType ||
                    (t.name &&
                      ticket.ticketType &&
                      t.name.toLowerCase() ===
                        ticket.ticketType.toLowerCase())
                );
                if (type && type.price > 0) {
                  const expectedPrice = quantity * type.price;
                  if (Math.abs(expectedPrice - ticket.price) > 1) {
                    const calculated = Math.round(ticket.price / type.price);
                    if (calculated > 0) return calculated;
                  }
                }
              }
            }

            return quantity;
          };

          // Map tickets to include calculated quantity
          const processedTickets = allTickets.map((t: any) => ({
            ...t,
            calculatedQuantity: getTicketQuantity(t),
          }));

          console.log(`Event ${event.title} tickets:`, processedTickets);

          // Store all tickets (for analytics and total counts)
          allTicketsMap[event._id] = processedTickets;

          // Filter for active tickets only (for revenue calculations)
          const activeTickets = processedTickets.filter(
            (t: any) => t.status === "active"
          );
          ticketsMap[event._id] = activeTickets;
        } catch (error) {
          console.error(
            `Error fetching tickets for event ${event.title}:`,
            error
          );
          ticketsMap[event._id] = [];
          allTicketsMap[event._id] = [];
        }
      }
      setActiveTicketsByEvent(ticketsMap);
      setAllTicketsByEvent(allTicketsMap);
      setTicketsLoading(false);
    };

    fetchTickets();
  }, [user, events, isLoading]);

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
    }
  };

  useEffect(() => {
    const fetchWithdrawals = async () => {
      setWithdrawalsLoading(true);
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
        setWithdrawals([]);
        setWithdrawalsLoading(false);
        return;
      }
      // Fetch withdrawals
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals?currency=${selectedCurrency}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          setWithdrawals(data.data || []);
        } else {
          setWithdrawals([]);
        }
      } catch {
        setWithdrawals([]);
      }
      setWithdrawalsLoading(false);
    };

    fetchWithdrawals();
    fetchBalance();
  }, [user, selectedCurrency]);

  // Pagination helper functions
  const getPaginatedData = (
    data: any[],
    page: number,
    itemsPerPage: number
  ) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
    totalItems: number;
  }) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 mt-4 p-2 sm:p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
          <span>
            Showing {startItem} to {endItem} of {totalItems} results
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-600">
              Items per page:
            </span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-16 sm:w-20 h-7 sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>

            <div className="flex items-center gap-1 mx-1 sm:mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!checkedAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in as an organizer to view your dashboard
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => (window.location.href = "/organizer/sign-in")}
              className="w-full"
            >
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          {/* spinner div */}
          <div className="border-t-2 rounded-full p-10 spinner border-blue-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => {
                const userId = localStorage.getItem("userId");
                if (userId) {
                  fetchEvents(userId);
                }
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Stat Calculations ---
  const totalEvents = events.length;
  const publishedEvents = events.filter((e) => e.status === "published").length;
  const draftEvents = events.filter((e) => e.status === "draft").length;
  const cancelledEvents = events.filter((e) => e.status === "cancelled").length;
  const completedEvents = events.filter((e) => e.status === "completed").length;

  // Helper to calculate quantity for a ticket (reused for totals)
  // Calculate totals from actual ticket data
  // Helper to calculate ticket quantity (redefined here for render scope)
  const getTicketQuantity = (ticket: any, eventId?: string) => {
    // If we already calculated it during fetch, use it
    if (ticket.calculatedQuantity) return ticket.calculatedQuantity;

    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    // Check if ticket was bought before Dec 14, 2025
    const cutoffDate = new Date("2025-12-14");
    const ticketDate = new Date(ticket.createdAt || ticket.purchaseDate);

    if (ticketDate < cutoffDate) {
      // Fallback if we have event data
      if (eventId) {
        const event = events.find((e) => e._id === eventId);
        if (event && event.ticketTypes && ticket.price > 0) {
          const type = event.ticketTypes.find(
            (t: any) =>
              t.name === ticket.ticketType ||
              (t.name &&
                ticket.ticketType &&
                t.name.toLowerCase() === ticket.ticketType.toLowerCase())
          );
          if (type && type.price > 0) {
            const expectedPrice = quantity * type.price;
            if (Math.abs(expectedPrice - ticket.price) > 1) {
              const calculated = Math.round(ticket.price / type.price);
              if (calculated > 0) return calculated;
            }
          }
        }
      }
    }

    return quantity;
  };

  // --- Client-Side Revenue Calculation ---
  // We calculate these values directly from the fetched tickets and withdrawals
  // to ensure perfect consistency with the data displayed to the user.

  const salesPeriodLabels: Record<SalesPeriod, string> = {
    daily: "Today",
    weekly: "This Week",
    monthly: "This Month",
    "all-time": "All Time",
  };

  const getSalesPeriodStartDate = (period: SalesPeriod) => {
    const now = new Date();

    if (period === "daily") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (period === "weekly") {
      const start = new Date(now);
      const day = start.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (period === "monthly") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return null;
  };

  const isInSelectedSalesPeriod = (ticket: any) => {
    if (salesPeriod === "all-time") return true;

    const startDate = getSalesPeriodStartDate(salesPeriod);
    if (!startDate) return true;

    const sourceDate = ticket.createdAt || ticket.purchaseDate || ticket.updatedAt;
    if (!sourceDate) return false;

    const ticketDate = new Date(sourceDate);
    if (Number.isNaN(ticketDate.getTime())) return false;

    return ticketDate >= startDate;
  };

  const matchesSelectedCurrency = (ticket: any) =>
    selectedCurrency === "USD"
      ? ticket.currency === "USD"
      : !ticket.currency || ticket.currency === "ETB";

  const filterTicketsBySalesPeriod = (tickets: any[]) =>
    tickets.filter((ticket) => isInSelectedSalesPeriod(ticket));

  const filterTicketsBySalesPeriodAndCurrency = (tickets: any[]) =>
    tickets.filter(
      (ticket) => isInSelectedSalesPeriod(ticket) && matchesSelectedCurrency(ticket)
    );

  const allTicketsFlat = Object.values(allTicketsByEvent).flat();
  const periodTickets = filterTicketsBySalesPeriod(allTicketsFlat as any[]);
  const currencyTickets = filterTicketsBySalesPeriodAndCurrency(
    allTicketsFlat as any[]
  );

  // Use ALL tickets for revenue calculation as requested by user to match the table
  const totalRevenue = currencyTickets.reduce(
    (sum, t: any) => sum + (t.price || 0),
    0
  );
  const organizerRevenue = totalRevenue * 0.97;
  const pazimoCommission = totalRevenue * 0.03;

  const totalWithdrawn = withdrawals
    .filter((w: any) => ["approved", "completed"].includes(w.status))
    .reduce((sum, w: any) => sum + (w.amount || 0), 0);

  const pendingWithdrawals = withdrawals
    .filter((w: any) => w.status === "pending")
    .reduce((sum, w: any) => sum + (w.amount || 0), 0);

  // Available Balance = (Total Revenue * 0.97) - (Approved Withdrawals) - (Pending Withdrawals)
  const availableBalance = balance?.availableBalance ?? 0;

  // --- Chart Data Preparation ---

  const totalTicketsSold = periodTickets.reduce(
    (sum, t: any) => sum + getTicketQuantity(t, t.event?._id || t.event),
    0
  );
  const totalUsedTickets = periodTickets
    .filter((t: any) => t.status === "used")
    .reduce(
      (sum, t: any) => sum + getTicketQuantity(t, t.event?._id || t.event),
      0
    );
  // Revenue trend data (last 6 months)
  const revenueData = events.slice(0, 6).map((event) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const filteredTickets = filterTicketsBySalesPeriodAndCurrency(allTickets);
    const periodEventTickets = filterTicketsBySalesPeriod(allTickets);

    const revenue = filteredTickets
      .reduce((sum, t) => sum + (t.price || 0), 0);
    const ticketCount = periodEventTickets.reduce(
      (sum, t) => sum + getTicketQuantity(t, event._id),
      0
    );
    return {
      month: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
      }),
      revenue: revenue,
      tickets: ticketCount,
      event: event.title.substring(0, 15) + "...",
    };
  });

  // Event status distribution for pie chart
  const statusData = [
    { name: "Published", value: publishedEvents, color: "#0d47a1" },
    { name: "Draft", value: draftEvents, color: "#F59E0B" },
    { name: "Cancelled", value: cancelledEvents, color: "#EF4444" },
    { name: "Completed", value: countCompletedEvents(), color: "#3B82F6" },
  ].filter((item) => item.value > 0);

  // Monthly performance data
  const monthlyData = events.slice(0, 12).map((event, index) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const filteredTickets = filterTicketsBySalesPeriodAndCurrency(allTickets);
    const periodEventTickets = filterTicketsBySalesPeriod(allTickets);

    const revenue = filteredTickets
      .reduce((sum, t) => sum + (t.price || 0), 0);
    const ticketCount = periodEventTickets.reduce(
      (sum, t) => sum + getTicketQuantity(t, event._id),
      0
    );
    return {
      month: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      events: 1,
      revenue: revenue,
      tickets: ticketCount,
      event: event.title,
    };
  });

  // Top performing events
  const topEvents = events
    .map((event) => {
      const allTickets = allTicketsByEvent[event._id] || [];
      const filteredTickets = filterTicketsBySalesPeriodAndCurrency(allTickets);
      const periodEventTickets = filterTicketsBySalesPeriod(allTickets);

      const revenue = filteredTickets
        .reduce((sum, t) => sum + (t.price || 0), 0);
      const ticketCount = periodEventTickets.reduce(
        (sum, t) => sum + getTicketQuantity(t, event._id),
        0
      );
      return {
        name: event.title.substring(0, 20) + "...",
        revenue: revenue,
        tickets: ticketCount,
        status: event.status,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // --- Stat Cards Data (Top Row) ---
  const statCards = [
    {
      id: "revenue",
      title:
        salesPeriod === "all-time"
          ? "Total Revenue"
          : `${salesPeriodLabels[salesPeriod]} Revenue`,
      value: totalRevenue,
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      borderColor: "border-l-green-600",
      isMoney: true,
    },
    {
      id: "organizer-revenue",
      title: "Available balance",
      value: availableBalance,
      icon: DollarSign,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      borderColor: "border-l-emerald-600",
      isMoney: true,
    },
    {
      id: "total-withdrawn",
      title: "Total Withdrawn",
      value: totalWithdrawn,
      icon: CreditCard,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      borderColor: "border-l-orange-600",
      isMoney: true,
    },
    {
      id: "tickets",
      title:
        salesPeriod === "all-time"
          ? "Total Tickets Sold"
          : `${salesPeriodLabels[salesPeriod]} Tickets Sold`,
      value: totalTicketsSold,
      icon: Ticket,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      borderColor: "border-l-blue-600",
      isMoney: false,
    },
    {
      id: "used-tickets",
      title:
        salesPeriod === "all-time"
          ? "Used Tickets"
          : `${salesPeriodLabels[salesPeriod]} Used Tickets`,
      value: totalUsedTickets,
      icon: CheckCircle,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      borderColor: "border-l-purple-600",
      isMoney: false,
    },
  ];

  // --- Event Status Cards (Second Row) ---
  const statusCards = [
    {
      id: "published",
      title: "Published Events",
      value: publishedEvents,
      icon: CheckCircle,
      iconBg: "bg-green-50",
      iconColor: "text-green-400",
    },
    {
      id: "draft",
      title: "Draft Events",
      value: draftEvents,
      icon: FileText,
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-400",
    },
    {
      id: "cancelled",
      title: "Cancelled Events",
      value: cancelledEvents,
      icon: XCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-400",
    },
    {
      id: "completed",
      title: "Completed Events",
      value: countCompletedEvents(),
      icon: Calendar,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-400",
    },
  ];

  // Paginated data
  const paginatedEvents = getPaginatedData(events, eventsPage, itemsPerPage);
  const paginatedWithdrawals = getPaginatedData(
    withdrawals,
    withdrawalsPage,
    itemsPerPage
  );
  const paginatedAnalytics = getPaginatedData(
    events,
    analyticsPage,
    itemsPerPage
  );

  // QR Code functionality
  const generateQRCode = async (event: any) => {
    try {
      const shareQrUrl = `${window.location.origin}/events/${event._id}`;
      const qrDataUrl = await QRCode.toDataURL(shareQrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0D47A1",
          light: "#FFFFFF",
        },
      });
      setShareQrDataUrl(qrDataUrl);
      setSelectedEvent(event);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!shareQrDataUrl || !selectedEvent) return;
    downloadHighQualityQR(
      shareQrDataUrl,
      `buy-${selectedEvent._id}-ticket.png`
    );
  };

  const copyBuyLink = () => {
    if (!selectedEvent) return;
    const shareQrUrl = `${window.location.origin}/events/${selectedEvent._id}`;
    navigator.clipboard.writeText(shareQrUrl);
    toast.success("Buy link copied");
  };

  return (
    <div className="p-1 sm:p-2 lg:p-4 bg-gradient-to-br from-blue-50 to-white min-h-screen">
      <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 max-w-full sm:max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-[#06283D] to-[#1A5D8C] rounded-lg p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                Welcome back, {user?.firstName}! 👋
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                Here's what's happening with your events today
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/organizer/events/create")}
                className="bg-white text-[#06283D] hover:bg-white cursor-pointer font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
        </div>

     

        {/* Quick Actions */}
        <Card className="border border-gray-200 shadow-md">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base font-semibold">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-blue-50"
                onClick={() => router.push("/organizer/events/create")}
              >
                <Plus className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-medium">New Event</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-green-50"
                onClick={() => router.push("/organizer/withdrawals")}
              >
                <CreditCard className="h-5 w-5 text-green-600" />
                <span className="text-xs font-medium">Withdraw</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-purple-50"
                onClick={() => router.push("/organizer/invitations")}
              >
                <Share2 className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-medium">Invite</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-orange-50"
                onClick={() => router.push("/organizer/account")}
              >
                <Settings className="h-5 w-5 text-orange-600" />
                <span className="text-xs font-medium">Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Stat Cards (Top Row) */}
        <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium text-gray-700">
                Currency
              </span>
              <Select
                value={selectedCurrency}
                onValueChange={(value: "ETB" | "USD") =>
                  setSelectedCurrency(value)
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium text-gray-700 sm:ml-4">
                Sales Period
              </span>
              <Select
                value={salesPeriod}
                onValueChange={(value: SalesPeriod) => setSalesPeriod(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="all-time">All Time</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-6 mb-4">
          {isLoading || withdrawalsLoading || ticketsLoading
            ? Array(5)
                .fill(0)
                .map((_, i) => <SkeletonCard key={i} />)
            : statCards.map((stat) => {
                const displayAmount = formatCompactMoney(stat.value, selectedCurrency);
                const hasLongAmount = displayAmount.length > 14;

                return (
                  <Card
                    key={stat.id}
                    className={`overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-blue-100 hover:from-blue-100 hover:to-white`}
                  >
                    <CardContent className="p-2 sm:p-3 lg:p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-medium text-gray-500 mb-1 truncate">
                            {stat.title}
                          </h3>
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            {stat.isMoney ? (
                              <>
                                <p
                                  className={`font-bold text-gray-800 truncate ${
                                    hasLongAmount
                                      ? "text-xs sm:text-sm lg:text-base"
                                      : "text-sm sm:text-lg lg:text-xl"
                                  }`}
                                >
                                  {showEarnings[stat.id] ? displayAmount : "••••••"}
                                </p>
                                <button
                                  onClick={() =>
                                    setShowEarnings((prev) => ({
                                      ...prev,
                                      [stat.id]: !prev[stat.id],
                                    }))
                                  }
                                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                  aria-label={
                                    showEarnings[stat.id]
                                      ? "Hide earnings"
                                      : "Show earnings"
                                  }
                                >
                                  {showEarnings[stat.id] ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800">
                                {stat.value}
                              </p>
                            )}
                          </div>
                        </div>
                        <div
                          className={`${stat.iconBg} p-1.5 sm:p-2 rounded-lg shadow-sm flex-shrink-0`}
                        >
                          <stat.icon
                            className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Event Status Cards (Second Row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {statusCards.map((stat) => (
            <Card
              key={stat.id}
              className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-white"
            >
              <CardContent className="p-2 sm:p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-medium text-gray-500 mb-1 truncate">
                      {stat.title}
                    </h3>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`${stat.iconBg} p-1.5 sm:p-2 rounded-lg shadow-sm flex-shrink-0`}
                  >
                    <stat.icon
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform Performance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalTicketsSold > 0
                      ? ((totalUsedTickets / totalTicketsSold) * 100).toFixed(1)
                      : "0"}
                    %
                  </p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Avg. Ticket Price
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalTicketsSold > 0
                      ? (totalRevenue / totalTicketsSold).toFixed(0)
                      : "0"}{" "}
                    {selectedCurrency}
                  </p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Active Events</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {publishedEvents}
                  </p>
                </div>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Attendees</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalUsedTickets}
                  </p>
                </div>
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section - Compact 2x2 Grid */}
        {/* Premium & Simple Charts Section - Inspired by the Behance Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend - Smooth Gradient Area Chart */}
          <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 text-gray-800">
                <TrendingUp className="h-5 w-5 text-[#0D47A1]" />
                Revenue Trend
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {salesPeriod === "all-time"
                  ? "Ticket sales over recent events"
                  : `Ticket sales for ${salesPeriodLabels[salesPeriod].toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{
                  revenue: {
                    label: `Revenue (${selectedCurrency})`,
                    color: "#0D47A1",
                  },
                }}
                className="h-[300px] w-full aspect-auto"
              >
                <AreaChart
                  data={revenueData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#0D47A1" stopOpacity={0.7} />
                      <stop
                        offset="95%"
                        stopColor="#0D47A1"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="event"
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    }}
                    labelStyle={{ color: "#0D47A1", fontWeight: "bold" }}
                    formatter={(value: number) =>
                      `${value.toLocaleString()} ${selectedCurrency}`
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0D47A1"
                    strokeWidth={3}
                    fill="url(#revenueGradient)"
                    dot={{ fill: "#0D47A1", r: 5 }}
                    activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Event Status Distribution - Clean Donut Chart with Center Total */}
          <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 text-gray-800">
                <PieChart className="h-5 w-5 text-[#0D47A1]" />
                Event Status Distribution
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Overview of all your events
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{
                  published: { label: "Published", color: "#0d47a1" },
                  draft: { label: "Draft", color: "#F59E0B" },
                  cancelled: { label: "Cancelled", color: "#0d47a1" },
                  completed: { label: "Completed", color: "#3B82F6" },
                }}
                className="h-[300px] w-full aspect-auto"
              >
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={80}
                    cornerRadius={10}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.95)",
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    }}
                  />
                  {/* Center Total */}
                  <text
                    x="50%"
                    y="45%"
                    textAnchor="middle"
                    className="text-4xl font-bold fill-[#0D47A1]"
                  >
                    {totalEvents}
                  </text>
                  <text
                    x="50%"
                    y="55%"
                    textAnchor="middle"
                    className="text-sm fill-gray-600"
                  >
                    Total Events
                  </text>
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Monthly Performance - Dual Rounded Bar Chart */}
          <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 text-gray-800">
                <BarChart3 className="h-5 w-5 text-[#0D47A1]" />
                Monthly Performance
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {salesPeriod === "all-time"
                  ? "Revenue vs Tickets Sold"
                  : `Revenue vs Tickets Sold (${salesPeriodLabels[salesPeriod]})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{
                  revenue: {
                    label: `Revenue (${selectedCurrency})`,
                    color: "#0D47A1",
                  },
                  tickets: { label: "Tickets Sold", color: "#42A5F5" },
                }}
                className="h-[300px] w-full aspect-auto"
              >
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f5f5f5" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.95)",
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill="#0D47A1"
                    radius={[10, 10, 0, 0]}
                    barSize={35}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="tickets"
                    fill="#42A5F5"
                    radius={[10, 10, 0, 0]}
                    barSize={35}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top Performing Events - Fully Fixed Horizontal Bar Chart */}
          {/* DEBUG */}

          <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 text-gray-800">
                <TrendingUp className="h-5 w-5 text-[#0D47A1]" />
                Top Performing Events
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {salesPeriod === "all-time"
                  ? "Highest revenue generators"
                  : `Highest revenue generators (${salesPeriodLabels[salesPeriod]})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Fallback when no data */}
              {topEvents.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm">No revenue data yet</p>
                    <p className="text-xs mt-1">
                      Events with sales will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    revenue: {
                      label: `Revenue (${selectedCurrency})`,
                      color: "#0D47A1",
                    },
                  }}
                  className="h-[300px] w-full aspect-auto"
                >
                  <BarChart data={topEvents} layout="vertical">
                    <CartesianGrid strokeDasharray="4 4" stroke="#f5f5f5" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => {
                        if (value >= 1000000)
                          return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000)
                          return `${Math.round(value / 1000)}k`;
                        return `${value}`;
                      }}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#666" }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11, fill: "#444" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      formatter={(value: number) =>
                        `${value.toLocaleString()} ${selectedCurrency}`
                      }
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                      }}
                      labelStyle={{ fontWeight: "bold", color: "#0D47A1" }}
                    />
                    <defs>
                      <linearGradient
                        id="topBarGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#0D47A1" />
                        <stop offset="100%" stopColor="#1976D2" />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="revenue"
                      fill="url(#topBarGradient)"
                      radius={[0, 10, 10, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        

        {/* Event Analytics Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-6 sm:mb-8">
          <CardHeader className="p-3 sm:p-4 lg:p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base lg:text-lg xl:text-xl">
                Event Analytics & Ticket Status
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Live Data
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Online Sales</TableHead>
                    <TableHead className="text-xs">On-Door</TableHead>
                    <TableHead className="text-xs">Active</TableHead>
                    <TableHead className="text-xs">Used</TableHead>
                    <TableHead className="text-xs">Total</TableHead>
                    <TableHead className="text-xs">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAnalytics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs">
                        No events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAnalytics.map((event) => {
                      const tickets = allTicketsByEvent[event._id] || [];
                      const periodTickets = filterTicketsBySalesPeriod(tickets);

                      // Helper to calculate quantity for a ticket
                      const getQuantity = (t: any) => {
                        if (t.calculatedQuantity) return t.calculatedQuantity;

                        let quantity = t.purchaseQuantity || t.ticketCount || 1;

                        // Check if ticket was bought before Dec 14, 2025
                        const cutoffDate = new Date("2025-12-14");
                        const ticketDate = new Date(
                          t.createdAt || t.purchaseDate
                        );

                        if (ticketDate < cutoffDate) {
                          if (t.price && event.ticketTypes) {
                            const type = event.ticketTypes.find(
                              (type: any) =>
                                type.name === t.ticketType ||
                                type._id === t.ticketType ||
                                (type.name &&
                                  t.ticketType &&
                                  type.name.toLowerCase() ===
                                    t.ticketType.toLowerCase())
                            );
                            if (type && type.price > 0) {
                              const expectedPrice = quantity * type.price;
                              if (Math.abs(expectedPrice - t.price) > 1) {
                                const calculated = Math.round(
                                  t.price / type.price
                                );
                                if (calculated > 0) return calculated;
                              }
                            }
                          }
                        }
                        return quantity;
                      };

                      const totalTickets = periodTickets.reduce(
                        (sum, t) => sum + getQuantity(t),
                        0
                      );
                      const activeTickets = periodTickets
                        .filter((t: any) => t.status === "active")
                        .reduce((sum, t) => sum + getQuantity(t), 0);
                      const usedTickets = periodTickets
                        .filter((t: any) => t.status === "used")
                        .reduce((sum, t) => sum + getQuantity(t), 0);
                      const onDoorTickets = periodTickets
                        .filter((t: any) => t.isOnDoor === true)
                        .reduce((sum, t) => sum + getQuantity(t), 0);

                      const onlineTickets = totalTickets - onDoorTickets;

                      const revenue = periodTickets
                        .filter((t: any) => matchesSelectedCurrency(t))
                        .reduce((sum, t) => sum + (t.price || 0), 0);

                      return (
                        <TableRow key={event._id}>
                          <TableCell className="text-xs max-w-[80px] truncate">
                            {event.title}
                          </TableCell>
                          <TableCell className="text-xs">
                            {onlineTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {onDoorTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {activeTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {usedTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {totalTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {revenue.toFixed(2)} {selectedCurrency}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {events.length > 0 && (
              <PaginationControls
                currentPage={analyticsPage}
                totalPages={getTotalPages(events, itemsPerPage)}
                onPageChange={setAnalyticsPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={events.length}
              />
            )}
          </CardContent>
        </Card>

        {/* My Events Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl">
          <CardHeader className="p-4 sm:p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg md:text-xl">
                My Events
              </CardTitle>
              <Button
                onClick={() => router.push("/organizer/events")}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No events found. Create your first event to get started!
                </p>
                <Button
                  onClick={() => router.push("/organizer/events/create")}
                  className="mt-4"
                >
                  Create Event
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">
                          Event Title
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Status
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Start Date
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          End Date
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEvents.map((event) => (
                        <TableRow key={event._id} className="border-b">
                          <TableCell className="text-xs sm:text-sm font-medium max-w-[150px] truncate">
                            {event.title}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Badge
                              variant="outline"
                              className={
                                event.status === "published"
                                  ? "bg-green-100 text-green-700"
                                  : event.status === "draft"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : event.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {event.startDate
                              ? new Date(event.startDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {event.endDate
                              ? new Date(event.endDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateQRCode(event)}
                                className="h-7 w-7 p-0"
                                title="Generate QR Code"
                              >
                                <QrCode className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(`/organizer/events/${event._id}`)
                                }
                                className="h-7 px-2 text-xs"
                              >
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={eventsPage}
                  totalPages={getTotalPages(events, itemsPerPage)}
                  onPageChange={setEventsPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={events.length}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Code Modal */}
        {shareQrDataUrl && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Event QR Code</CardTitle>
                <CardDescription>
                  Share this QR code for {selectedEvent.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={shareQrDataUrl}
                    alt="Event QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadQRCode} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={copyBuyLink}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShareQrDataUrl("");
                    setSelectedEvent(null);
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
