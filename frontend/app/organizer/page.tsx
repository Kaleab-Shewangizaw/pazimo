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
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  DollarSign,
  Ticket,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  QrCode,
  Download,
  Copy,
  Plus,
  Wallet,
  CreditCard,
  Share2,
  ExternalLink,
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
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { buildEventUrl } from "@/lib/event-url";
import { downloadHighQualityQR } from "@/lib/downloadQR";
import { generateDottedQrDataUrl } from "@/lib/qrStyle";

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
  });
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETB" | "USD">(
    "ETB"
  );
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all-time");

  const [eventsPage, setEventsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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

      for (const event of events) {
        try {
          let allRawTickets: any[] = [];
          let page = 1;
          let hasMore = true;

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

          const allTickets = rawTickets.filter((t: any) => {
            return t.price && t.price > 0;
          });

          const getTicketQuantity = (ticket: any) => {
            let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

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

          const processedTickets = allTickets.map((t: any) => ({
            ...t,
            calculatedQuantity: getTicketQuantity(t),
          }));

          allTicketsMap[event._id] = processedTickets;

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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
        <span className="text-xs text-muted-foreground">
          Showing {startItem}–{endItem} of {totalItems}
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Per page</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-16 h-8 text-xs">
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
              size="icon"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-1 mx-1">
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
                    size="icon"
                    onClick={() => onPageChange(pageNum)}
                    className="h-8 w-8 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!checkedAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-[350px]">
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-[350px]">
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

  const totalEvents = events.length;
  const publishedEvents = events.filter((e) => e.status === "published").length;
  const draftEvents = events.filter((e) => e.status === "draft").length;
  const cancelledEvents = events.filter((e) => e.status === "cancelled").length;
  const completedEvents = countCompletedEvents();

  const getTicketQuantity = (ticket: any, eventId?: string) => {
    if (ticket.calculatedQuantity) return ticket.calculatedQuantity;

    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    const cutoffDate = new Date("2025-12-14");
    const ticketDate = new Date(ticket.createdAt || ticket.purchaseDate);

    if (ticketDate < cutoffDate) {
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

  const totalRevenue = currencyTickets.reduce(
    (sum, t: any) => sum + (t.price || 0),
    0
  );
  // No client-side 3% split here: commission is per event and an organizer
  // whose VAT Pazimo covers loses a further 15%. The API returns the real
  // figures — recomputing them in the browser only invents a second answer.

  const totalWithdrawn = withdrawals
    .filter((w: any) => ["approved", "completed"].includes(w.status))
    .reduce((sum, w: any) => sum + (w.amount || 0), 0);

  const pendingWithdrawals = withdrawals
    .filter((w: any) => w.status === "pending")
    .reduce((sum, w: any) => sum + (w.amount || 0), 0);

  const availableBalance = balance?.availableBalance ?? 0;

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
  const conversionRate =
    totalTicketsSold > 0 ? (totalUsedTickets / totalTicketsSold) * 100 : 0;
  const avgTicketPrice =
    totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;

  const revenueData = events.slice(0, 6).map((event) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const filteredTickets = filterTicketsBySalesPeriodAndCurrency(allTickets);

    const revenue = filteredTickets.reduce((sum, t) => sum + (t.price || 0), 0);
    return {
      event: event.title.substring(0, 15) + "...",
      revenue,
    };
  });

  const statusData = [
    { name: "Published", value: publishedEvents, color: "var(--color-success)" },
    { name: "Draft", value: draftEvents, color: "var(--color-warning)" },
    { name: "Cancelled", value: cancelledEvents, color: "var(--color-destructive)" },
    { name: "Completed", value: completedEvents, color: "var(--color-muted-foreground)" },
  ].filter((item) => item.value > 0);

  const monthlyData = events.slice(0, 12).map((event) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const filteredTickets = filterTicketsBySalesPeriodAndCurrency(allTickets);
    const periodEventTickets = filterTicketsBySalesPeriod(allTickets);

    const revenue = filteredTickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const ticketCount = periodEventTickets.reduce(
      (sum, t) => sum + getTicketQuantity(t, event._id),
      0
    );
    return {
      month: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      revenue,
      tickets: ticketCount,
    };
  });

  const paginatedEvents = getPaginatedData(events, eventsPage, itemsPerPage);
  const paginatedAnalytics = getPaginatedData(
    events,
    analyticsPage,
    itemsPerPage
  );

  const generateQRCode = async (event: any) => {
    try {
      const shareQrUrl = `${window.location.origin}${buildEventUrl(event)}`;
      const qrDataUrl = await generateDottedQrDataUrl(shareQrUrl);
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
    const shareQrUrl = `${window.location.origin}${buildEventUrl(selectedEvent)}`;
    navigator.clipboard.writeText(shareQrUrl);
    toast.success("Buy link copied");
  };

  const statusBadgeVariant = (status: string) =>
    status === "published"
      ? "success"
      : status === "draft"
      ? "warning"
      : status === "cancelled"
      ? "destructive"
      : "info";

  const metricsLoading = isLoading || withdrawalsLoading || ticketsLoading;
  const revenueLabel =
    salesPeriod === "all-time" ? "Revenue" : `${salesPeriodLabels[salesPeriod]} revenue`;
  const ticketsLabel =
    salesPeriod === "all-time"
      ? "Tickets sold"
      : `${salesPeriodLabels[salesPeriod]} tickets sold`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <PageHeader
          title="Dashboard"
          description={`Welcome back, ${user?.firstName}. Here's what's happening with your events.`}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => router.push("/organizer/withdrawals")}
              >
                <CreditCard className="h-4 w-4" />
                Withdraw
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/organizer/invitations")}
              >
                <Share2 className="h-4 w-4" />
                Invite
              </Button>
              <Button onClick={() => router.push("/organizer/events/create")}>
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Currency
            </span>
            <Select
              value={selectedCurrency}
              onValueChange={(value: "ETB" | "USD") =>
                setSelectedCurrency(value)
              }
            >
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ETB">ETB</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Period
            </span>
            <Select
              value={salesPeriod}
              onValueChange={(value: SalesPeriod) => setSalesPeriod(value)}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
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

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={revenueLabel}
            loading={metricsLoading}
            icon={DollarSign}
            value={
              showEarnings.revenue
                ? formatCompactMoney(totalRevenue, selectedCurrency)
                : "••••••"
            }
            hint={
              totalTicketsSold > 0
                ? `${formatCompactMoney(avgTicketPrice, selectedCurrency)} avg / ticket`
                : undefined
            }
            action={
              <button
                onClick={() =>
                  setShowEarnings((prev) => ({ ...prev, revenue: !prev.revenue }))
                }
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showEarnings.revenue ? "Hide revenue" : "Show revenue"}
              >
                {showEarnings.revenue ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            }
          />
          <StatCard
            label="Available balance"
            loading={metricsLoading}
            icon={Wallet}
            value={
              showEarnings["organizer-revenue"]
                ? formatCompactMoney(availableBalance, selectedCurrency)
                : "••••••"
            }
            hint={
              totalWithdrawn > 0
                ? `${formatCompactMoney(totalWithdrawn, selectedCurrency)} withdrawn to date`
                : pendingWithdrawals > 0
                ? `${formatCompactMoney(pendingWithdrawals, selectedCurrency)} pending`
                : undefined
            }
            action={
              <button
                onClick={() =>
                  setShowEarnings((prev) => ({
                    ...prev,
                    "organizer-revenue": !prev["organizer-revenue"],
                  }))
                }
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={
                  showEarnings["organizer-revenue"] ? "Hide balance" : "Show balance"
                }
              >
                {showEarnings["organizer-revenue"] ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            }
          />
          <StatCard
            label={ticketsLabel}
            loading={metricsLoading}
            icon={Ticket}
            value={totalTicketsSold.toLocaleString()}
            hint={`${totalUsedTickets.toLocaleString()} checked in`}
          />
          <StatCard
            label="Attendance rate"
            loading={metricsLoading}
            icon={CheckCircle}
            value={`${conversionRate.toFixed(1)}%`}
            hint={`${totalUsedTickets.toLocaleString()} of ${totalTicketsSold.toLocaleString()} tickets used`}
          />
        </div>

        {/* Event status summary */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            {totalEvents} event{totalEvents === 1 ? "" : "s"}
          </span>
          {publishedEvents > 0 && (
            <Badge variant="success">{publishedEvents} published</Badge>
          )}
          {draftEvents > 0 && <Badge variant="warning">{draftEvents} draft</Badge>}
          {cancelledEvents > 0 && (
            <Badge variant="destructive">{cancelledEvents} cancelled</Badge>
          )}
          {completedEvents > 0 && (
            <Badge variant="info">{completedEvents} completed</Badge>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Revenue trend
              </CardTitle>
              <CardDescription>
                {salesPeriod === "all-time"
                  ? "Ticket sales across recent events"
                  : `Ticket sales for ${salesPeriodLabels[salesPeriod].toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  revenue: {
                    label: `Revenue (${selectedCurrency})`,
                    color: "var(--chart-1)",
                  },
                }}
                className="h-[280px] w-full aspect-auto"
              >
                <AreaChart
                  data={revenueData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis
                    dataKey="event"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `${Number(value).toLocaleString()} ${selectedCurrency}`
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                    dot={{ fill: "var(--color-revenue)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                Event status
              </CardTitle>
              <CardDescription>Overview of all your events</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No events yet"
                  description="Create your first event to see a status breakdown here."
                  className="h-[280px] justify-center"
                />
              ) : (
                <ChartContainer
                  config={{
                    published: { label: "Published", color: "var(--color-success)" },
                    draft: { label: "Draft", color: "var(--color-warning)" },
                    cancelled: { label: "Cancelled", color: "var(--color-destructive)" },
                    completed: { label: "Completed", color: "var(--color-muted-foreground)" },
                  }}
                  className="h-[280px] w-full aspect-auto"
                >
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      className="text-3xl font-semibold fill-foreground"
                    >
                      {totalEvents}
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      className="text-xs fill-muted-foreground"
                    >
                      Total events
                    </text>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Monthly performance
              </CardTitle>
              <CardDescription>
                {salesPeriod === "all-time"
                  ? "Revenue vs. tickets sold"
                  : `Revenue vs. tickets sold (${salesPeriodLabels[salesPeriod]})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  revenue: {
                    label: `Revenue (${selectedCurrency})`,
                    color: "var(--chart-1)",
                  },
                  tickets: { label: "Tickets sold", color: "var(--chart-2)" },
                }}
                className="h-[280px] w-full aspect-auto"
              >
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="tickets"
                    fill="var(--color-tickets)"
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Event Analytics Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Event analytics
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Live data
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Online</TableHead>
                    <TableHead className="text-right">On-door</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAnalytics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState icon={BarChart3} title="No events found" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAnalytics.map((event) => {
                      const tickets = allTicketsByEvent[event._id] || [];
                      const periodTicketsForEvent = filterTicketsBySalesPeriod(tickets);

                      const getQuantity = (t: any) => {
                        if (t.calculatedQuantity) return t.calculatedQuantity;

                        let quantity = t.purchaseQuantity || t.ticketCount || 1;

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

                      const totalTickets = periodTicketsForEvent.reduce(
                        (sum, t) => sum + getQuantity(t),
                        0
                      );
                      const activeTickets = periodTicketsForEvent
                        .filter((t: any) => t.status === "active")
                        .reduce((sum, t) => sum + getQuantity(t), 0);
                      const usedTickets = periodTicketsForEvent
                        .filter((t: any) => t.status === "used")
                        .reduce((sum, t) => sum + getQuantity(t), 0);
                      const onDoorTickets = periodTicketsForEvent
                        .filter((t: any) => t.isOnDoor === true)
                        .reduce((sum, t) => sum + getQuantity(t), 0);

                      const onlineTickets = totalTickets - onDoorTickets;

                      const revenue = periodTicketsForEvent
                        .filter((t: any) => matchesSelectedCurrency(t))
                        .reduce((sum, t) => sum + (t.price || 0), 0);

                      return (
                        <TableRow key={event._id}>
                          <TableCell className="max-w-[140px] truncate font-medium">
                            {event.title}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {onlineTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {onDoorTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {activeTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {usedTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totalTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">My events</CardTitle>
              <Button
                onClick={() => router.push("/organizer/events")}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No events found"
                description="Create your first event to get started."
                action={
                  <Button onClick={() => router.push("/organizer/events/create")}>
                    <Plus className="h-4 w-4" />
                    Create event
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start date</TableHead>
                        <TableHead>End date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEvents.map((event) => (
                        <TableRow key={event._id}>
                          <TableCell className="max-w-[180px] truncate font-medium">
                            {event.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(event.status)}>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.startDate
                              ? new Date(event.startDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.endDate
                              ? new Date(event.endDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => generateQRCode(event)}
                                className="h-8 w-8"
                                title="Generate QR code"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(`/organizer/events/${event._id}`)
                                }
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Event QR code</CardTitle>
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
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button onClick={copyBuyLink} variant="outline" className="flex-1">
                    <Copy className="h-4 w-4" />
                    Copy link
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
