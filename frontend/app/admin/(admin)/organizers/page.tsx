"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  Users,
  Eye,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Banknote,
  Search,
  RefreshCw,
  DollarSign,
  Building2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface OrganizerData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  events: EventData[];
  createdAt: string;
  totalRevenue?: number;
  organizerRevenue?: number;
  availableBalance?: number;
  pazimoCommission?: number;
}

interface EventData {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  status: string;
  ticketTypes: TicketType[];
  tickets: TicketData[];
  capacity: number;
}

interface TicketType {
  name: string;
  price: number;
  quantity: number;
  description: string;
  available: boolean;
  startDate?: string;
  endDate?: string;
  _id?: string;
}

interface TicketData {
  purchaseDate: string;
  _id: string;
  event: string | EventData;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  ticketType: string;
  price: number;
  status: string;
  createdAt: string;
  isOnDoor?: boolean;
  paymentStatus?: string;
  purchaseQuantity?: number;
  ticketCount?: number;
  currency?: "ETB" | "USD";
}

interface RevenueBreakdown {
  eventId: string;
  eventTitle: string;
  totalRevenue: number;
  ticketTypeBreakdown: {
    ticketType: string;
    isOnDoor: boolean;
    pricePerTicket: number;
    totalSold: number;
    totalRevenue: number;
  }[];
  totalTicketsSold: number;
  onDoorTicketsSold: number;
  onDoorRevenue: number;
  onlineTicketsSold: number;
  onlineRevenue: number;
}

interface OrganizerBalance {
  totalRevenue: number;
  organizerRevenue: number;
  pazimoCommission: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  availableBalance: number;
  revenueBreakdown: RevenueBreakdown[];
  summary: {
    totalEvents: number;
    totalTicketsSold: number;
    averageTicketPrice: number;
  };
}

type PaymentMethod = "telebirr" | "mpesa" | "bank";

const getTicketQuantity = (ticket: TicketData, event: EventData) => {
  let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

  const cutoffDate = new Date("2025-12-14");
  const ticketDate = new Date(ticket.createdAt || ticket.purchaseDate || "");

  if (ticketDate < cutoffDate) {
    if (event && event.ticketTypes) {
      const type = event.ticketTypes.find(
        (tt) =>
          tt.name === ticket.ticketType ||
          (tt._id && tt._id === ticket.ticketType) ||
          (tt.name &&
            ticket.ticketType &&
            tt.name.toLowerCase() === ticket.ticketType.toLowerCase())
      );

      if (type && type.price > 0 && ticket.price > 0) {
        const expectedPrice = quantity * type.price;
        if (Math.abs(expectedPrice - ticket.price) > 1) {
          const calculatedQty = Math.round(ticket.price / type.price);
          if (calculatedQty > 0) return calculatedQty;
        }
      }
    }
  }
  return quantity;
};

const EventCardWithStats = ({
  event,
  token,
  selectedCurrency,
}: {
  event: EventData;
  token: string | null;
  selectedCurrency: "ETB" | "USD";
}) => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!token) return;
      try {
        let allTickets: TicketData[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${event._id}?page=${page}&limit=500`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            allTickets = [...allTickets, ...(data.tickets || [])];
            hasMore = data.hasMore || false;
            page++;
          } else {
            hasMore = false;
          }
        }

        setTickets(allTickets);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [event._id, token]);

  const calculateRevenue = (tickets: TicketData[]) => {
    const validTickets = tickets.filter(
      (t: any) =>
        t.paymentStatus === "completed" &&
        !["cancelled", "pending", "expired"].includes(t.status) &&
        (selectedCurrency === "USD"
          ? t.currency === "USD"
          : !t.currency || t.currency === "ETB")
    );
    return validTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  };

  const ticketsSold = tickets.reduce(
    (sum, t) => sum + getTicketQuantity(t, event),
    0
  );
  const revenue = calculateRevenue(tickets);

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <h5 className="font-medium text-gray-900 dark:text-gray-100">{event.title}</h5>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {event.location.address}, {event.location.city}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              className={
                event.status === "published"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800"
                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
              }
            >
              {event.status}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(event.startDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="flex items-center justify-end gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tickets Sold</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{ticketsSold}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Revenue: {revenue.toFixed(2)} {selectedCurrency}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function OrganizersPage() {
  const router = useRouter();
  const { token, admin } = useAdminAuthStore();
  const isPartner = admin?.role === "partner";
  const [organizers, setOrganizers] = useState<OrganizerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [organizerPage, setOrganizerPage] = useState(1);
  const [organizerTotalPages, setOrganizerTotalPages] = useState(1);
  const [organizerItemsPerPage, setOrganizerItemsPerPage] = useState(10);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETB" | "USD">("ETB");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [stats, setStats] = useState({
    totalOrganizers: 0,
    totalEvents: 0,
    totalRevenue: 0,
    organizerRevenue: 0,
    pazimoCommission: 0,
    activeEvents: 0,
  });
  const [selectedOrganizer, setSelectedOrganizer] =
    useState<OrganizerData | null>(null);
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  });
  const [organizerBalance, setOrganizerBalance] =
    useState<OrganizerBalance | null>(null);
  const [selectedOrganizerForBalance, setSelectedOrganizerForBalance] =
    useState<OrganizerData | null>(null);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [organizerDetailsDialogOpen, setOrganizerDetailsDialogOpen] =
    useState(false);

  useEffect(() => {
    fetchOrganizers();
  }, [organizerPage, organizerItemsPerPage, selectedCurrency]);

  const fetchOrganizers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=organizer&page=${organizerPage}&limit=${organizerItemsPerPage}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch organizers");
      }

      const data = await response.json();
      const organizersArray = data.data?.users || [];

      const organizersWithEvents = await Promise.all(
        organizersArray.map(async (organizer: OrganizerData) => {
          const eventsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${organizer._id}`,
            {
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const events = eventsData.events || [];

            const eventsWithTickets = await Promise.all(
              events.map(async (event: EventData) => {
                const tickets = await fetchEventTickets(event._id);
                return {
                  ...event,
                  tickets: tickets || [],
                };
              })
            );

            return {
              ...organizer,
              events: eventsWithTickets,
            };
          }
          return organizer;
        })
      );

      const organizersWithRevenue = await Promise.all(
        organizersWithEvents.map(async (organizer: OrganizerData) => {
          try {
            const balanceResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${organizer._id}/balance?currency=${selectedCurrency}`,
              {
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json();
              return {
                ...organizer,
                totalRevenue: balanceData.data?.totalRevenue || 0,
                organizerRevenue: balanceData.data?.organizerRevenue || 0,
                availableBalance: balanceData.data?.availableBalance || 0,
                pazimoCommission: balanceData.data?.pazimoCommission || 0,
              };
            }
            return organizer;
          } catch (error) {
            console.error(
              `Error fetching revenue for organizer ${organizer._id}:`,
              error
            );
            return organizer;
          }
        })
      );

      const totalEvents = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) => sum + (org.events?.length || 0),
        0
      );
      const activeEvents = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) =>
          sum +
          (org.events?.filter(
            (event: EventData) => event.status === "published"
          )?.length || 0),
        0
      );
      const totalRevenue = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) => sum + (org.totalRevenue || 0),
        0
      );
      const organizerRevenue = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) => sum + (org.organizerRevenue || 0),
        0
      );
      const pazimoCommission = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) =>
          sum + (org.pazimoCommission || (org.totalRevenue || 0) * 0.03),
        0
      );

      setStats({
        totalOrganizers: data.data?.total || 0,
        totalEvents,
        totalRevenue,
        organizerRevenue,
        pazimoCommission,
        activeEvents,
      });

      setOrganizers(organizersWithRevenue);
      if (data.data?.total) {
        setOrganizerTotalPages(
          Math.ceil(data.data.total / organizerItemsPerPage)
        );
      }
    } catch (error) {
      console.error("Error fetching organizers:", error);
      toast.error("Failed to fetch organizers");
    } finally {
      setLoading(false);
    }
  };

  const fetchEventTickets = async (eventId: string) => {
    try {
      let allTickets: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${eventId}?page=${page}&limit=500`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          console.warn(
            `Failed to fetch tickets for event ${eventId}: ${response.status}`
          );
          return allTickets.length > 0 ? allTickets : [];
        }

        const data = await response.json();
        allTickets = [...allTickets, ...(data.tickets || [])];
        hasMore = data.hasMore || false;
        page++;
      }

      return allTickets;
    } catch (error) {
      console.warn(`Error fetching tickets for event ${eventId}:`, error);
      return [];
    }
  };

  const handleViewEvent = async (event: EventData) => {
    const tickets = await fetchEventTickets(event._id);
    router.push(`/admin/organizers/${event._id}`);
  };

  const handleWithdraw = async () => {
    if (!selectedOrganizer) return;

    try {
      setIsSubmittingWithdraw(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizerId: selectedOrganizer._id,
            amount: Number.parseFloat(withdrawAmount),
            currency: selectedCurrency,
            notes: withdrawNotes,
            bankDetails,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to process withdrawal");
      }

      toast.success("Withdrawal request created successfully");
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      setBankDetails({
        accountName: "",
        accountNumber: "",
        bankName: "",
      });
      fetchOrganizers();
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast.error("Failed to process withdrawal");
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const fetchOrganizerBalance = async (organizerId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${organizerId}/balance?currency=${selectedCurrency}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch organizer balance");
      }

      const data = await response.json();
      if (data.success) {
        const balanceData: OrganizerBalance = data.data;

        const organizer = organizers.find((o) => o._id === organizerId);
        if (organizer && organizer.events && organizer.events.length > 0) {
          const enhancedBreakdown = balanceData.revenueBreakdown.map(
            (eventBreakdown) => {
              const event = organizer.events.find(
                (e) => e._id === eventBreakdown.eventId
              );

              if (!event || !event.tickets || event.tickets.length === 0) {
                return eventBreakdown;
              }

              const paidTickets = event.tickets.filter((ticket) => {
                const matchesCurrency =
                  selectedCurrency === "USD"
                    ? ticket.currency === "USD"
                    : !ticket.currency || ticket.currency === "ETB";
                return !!ticket.price && ticket.price > 0 && matchesCurrency;
              });

              const getQuantity = (ticket: TicketData) =>
                getTicketQuantity(ticket, event);

              type TicketGroup = {
                ticketType: string;
                isOnDoor: boolean;
                pricePerTicket: number;
                totalSold: number;
                totalRevenue: number;
              };

              const groupMap = new Map<string, TicketGroup>();

              paidTickets.forEach((ticket) => {
                const quantity = getQuantity(ticket);
                const pricePerTicket =
                  ticket.price && quantity > 0 ? ticket.price / quantity : 0;
                const key = `${ticket.ticketType}|$${
                  ticket.isOnDoor ? "ondoor" : "online"
                }|${pricePerTicket}`;

                if (!groupMap.has(key)) {
                  groupMap.set(key, {
                    ticketType: ticket.ticketType,
                    isOnDoor: !!ticket.isOnDoor,
                    pricePerTicket,
                    totalSold: 0,
                    totalRevenue: 0,
                  });
                }

                const group = groupMap.get(key)!;
                group.totalSold += quantity;
                group.totalRevenue += ticket.price || 0;
              });

              const ticketTypeBreakdown = Array.from(groupMap.values());

              return {
                ...eventBreakdown,
                ticketTypeBreakdown,
              };
            }
          );

          setOrganizerBalance({
            ...balanceData,
            revenueBreakdown: enhancedBreakdown,
          });
        } else {
          setOrganizerBalance(balanceData);
        }
      } else {
        throw new Error(data.message || "Failed to fetch organizer balance");
      }
    } catch (error) {
      console.error("Error fetching organizer balance:", error);
      toast.error("Failed to fetch organizer balance");
    }
  };

  const handleViewBalance = async (organizer: OrganizerData) => {
    setSelectedOrganizerForBalance(organizer);
    await fetchOrganizerBalance(organizer._id);
    setBalanceDialogOpen(true);
  };

  const handleViewOrganizerDetails = (organizer: OrganizerData) => {
    setSelectedOrganizer(organizer);
    setOrganizerDetailsDialogOpen(true);
  };

  const calculateRevenue = (
    tickets: TicketData[],
    currency: "ETB" | "USD" = selectedCurrency
  ) => {
    if (!tickets || tickets.length === 0) return 0;

    return tickets
      .filter((ticket: any) =>
        currency === "USD"
          ? ticket.currency === "USD"
          : !ticket.currency || ticket.currency === "ETB"
      )
      .reduce((sum, ticket) => {
      return sum + (ticket.price || 0);
    }, 0);
  };

  const calculateRevenueByStatus = (tickets: TicketData[], status: string) => {
    if (!tickets || tickets.length === 0) return 0;
    return tickets.reduce((sum, ticket) => {
      if (ticket.status === status) {
        return sum + (ticket.price || 0);
      }
      return sum;
    }, 0);
  };

  const filteredOrganizers = organizers.filter((organizer) => {
    const fullName =
      `${organizer.firstName} ${organizer.lastName}`.toLowerCase();
    const email = organizer.email.toLowerCase();
    const phone = organizer.phoneNumber?.toLowerCase() || "";
    const searchLower = searchQuery.toLowerCase();

    return (
      fullName.includes(searchLower) ||
      email.includes(searchLower) ||
      phone.includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
            Loading organizers...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="container mx-auto py-10 p-10 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Event Organizers
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage organizers and their events
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <Select
              value={selectedCurrency}
              onValueChange={(value: "ETB" | "USD") => setSelectedCurrency(value)}
            >
              <SelectTrigger className="w-full sm:w-[120px] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                <SelectItem value="ETB" className="dark:text-gray-200">ETB</SelectItem>
                <SelectItem value="USD" className="dark:text-gray-200">USD</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
              <Input
                placeholder="Search organizers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-[300px] dark:bg-gray-black dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
              />
            </div>
            <Select
              value={organizerItemsPerPage.toString()}
              onValueChange={(value) => {
                setOrganizerItemsPerPage(Number(value));
                setOrganizerPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                <SelectValue placeholder="Items per page" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                <SelectItem value="5" className="dark:text-gray-200">5 per page</SelectItem>
                <SelectItem value="10" className="dark:text-gray-200">10 per page</SelectItem>
                <SelectItem value="15" className="dark:text-gray-200">15 per page</SelectItem>
                <SelectItem value="20" className="dark:text-gray-200">20 per page</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={fetchOrganizers}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Total Organizers
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalOrganizers}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-indigo-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Total Events
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalEvents}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Active Events
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.activeEvents}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-emerald-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Total Revenue
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(stats.totalRevenue || 0, selectedCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Organizer Revenue (97%)
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(stats.organizerRevenue || 0, selectedCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-red-600 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Pazimo Commission (3%)
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(stats.pazimoCommission || 0, selectedCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizers Directory Table */}
        <Card className="border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl mb-8 border-t-4 border-t-blue-600 dark:bg-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Organizers Directory
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Manage all event organizers and their activities
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Email
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Phone
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Events
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Active Events
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">
                      Joined
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-gray-500 dark:text-gray-400 py-12"
                      >
                        <Building2 className="h-8 w-8 text-blue-400 dark:text-blue-600 mx-auto mb-3" />
                        <p className="font-medium">No organizers found</p>
                        <p className="text-sm">
                          Organizers will appear here once registered
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrganizers.map((organizer) => {
                      const activeEvents =
                        organizer.events?.filter(
                          (event: EventData) => event.status === "published"
                        )?.length || 0;

                      return (
                        <TableRow
                          key={organizer._id}
                          className="cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors border-gray-100 dark:border-gray-700"
                        >
                          <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                            {organizer.firstName} {organizer.lastName}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">
                            {organizer.email}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">
                            {organizer.phoneNumber}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                            >
                              {organizer.events?.length || 0} Events
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800">
                              {activeEvents} Active
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">
                            {new Date(organizer.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBalance(organizer)}
                                className="border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                              >
                                <Wallet className="h-4 w-4 mr-1" />
                                Balance
                              </Button>
                              {!isPartner && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrganizer(organizer);
                                    setWithdrawDialogOpen(true);
                                  }}
                                  className="border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                                >
                                  <Banknote className="h-4 w-4 mr-1" />
                                  Withdraw
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleViewOrganizerDetails(organizer)
                                }
                                className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              >
                                <Eye className="h-4 w-4" />
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

            {/* Organizers Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(organizerPage - 1) * organizerItemsPerPage + 1} to{" "}
                {Math.min(
                  organizerPage * organizerItemsPerPage,
                  organizerTotalPages * organizerItemsPerPage
                )}{" "}
                of {organizerTotalPages * organizerItemsPerPage} organizers
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOrganizerPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={organizerPage === 1}
                  className="border-gray-300 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: organizerTotalPages },
                    (_, i) => i + 1
                  ).map((page) => (
                    <Button
                      key={page}
                      variant={organizerPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOrganizerPage(page)}
                      className={
                        organizerPage === page
                          ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                          : "border-gray-300 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOrganizerPage((prev) =>
                      Math.min(prev + 1, organizerTotalPages)
                    )
                  }
                  disabled={organizerPage === organizerTotalPages}
                  className="border-gray-300 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Dialog */}
        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                Process Withdrawal
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Create a withdrawal request for {selectedOrganizer?.firstName}{" "}
                {selectedOrganizer?.lastName}
              </DialogDescription>
            </DialogHeader>
            {selectedOrganizer && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCompactMoney(selectedOrganizer.totalRevenue || 0, selectedCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Organizer Revenue (97%)</p>
                    <p className="font-semibold text-purple-600 dark:text-purple-400">
                      {formatCompactMoney(selectedOrganizer.organizerRevenue || 0, selectedCurrency)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600 dark:text-gray-400">Available Balance</p>
                    <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                      {formatCompactMoney(selectedOrganizer.availableBalance || 0, selectedCurrency)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Amount ({selectedCurrency})</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Payment Method</Label>
                <Select
                  value={bankDetails.bankName}
                  onValueChange={(value: PaymentMethod) =>
                    setBankDetails((prev) => ({ ...prev, bankName: value }))
                  }
                >
                  <SelectTrigger className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="telebirr" className="dark:text-gray-200">Telebirr</SelectItem>
                    <SelectItem value="mpesa" className="dark:text-gray-200">M-Pesa</SelectItem>
                    <SelectItem value="bank" className="dark:text-gray-200">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bankDetails.bankName === "telebirr" && (
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Telebirr Phone Number</Label>
                  <Input
                    value={bankDetails.accountNumber}
                    onChange={(e) =>
                      setBankDetails((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter Telebirr phone number"
                    className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  />
                </div>
              )}

              {bankDetails.bankName === "mpesa" && (
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">M-Pesa Phone Number</Label>
                  <Input
                    value={bankDetails.accountNumber}
                    onChange={(e) =>
                      setBankDetails((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter M-Pesa phone number"
                    className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
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
                      <SelectTrigger className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
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
                      className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Notes</Label>
                <Textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Add any notes about this withdrawal"
                  rows={3}
                  className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setWithdrawDialogOpen(false)}
                className="border-gray-300 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={
                  !withdrawAmount ||
                  isSubmittingWithdraw ||
                  !bankDetails.bankName ||
                  !bankDetails.accountNumber
                }
                className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white"
              >
                {isSubmittingWithdraw ? "Processing..." : "Create Withdrawal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Balance Dialog */}
        <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
          <DialogContent className="max-w-7xl max-h-[80vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                Revenue Details for {selectedOrganizerForBalance?.firstName}{" "}
                {selectedOrganizerForBalance?.lastName}
              </DialogTitle>
            </DialogHeader>

            {organizerBalance && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Revenue
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                        {organizerBalance.totalRevenue.toFixed(2)} {selectedCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Organizer Revenue (97%)
                      </div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {(
                          organizerBalance.organizerRevenue ||
                          organizerBalance.totalRevenue * 0.97
                        ).toFixed(2)}{" "}
                        {selectedCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Pazimo Commission (3%)
                      </div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                        {(
                          organizerBalance.pazimoCommission ||
                          organizerBalance.totalRevenue * 0.03
                        ).toFixed(2)}{" "}
                        {selectedCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Withdrawn
                      </div>
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">
                        {(organizerBalance.approvedWithdrawals || 0).toFixed(2)}{" "}
                        {selectedCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Available Balance
                      </div>
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">
                        {organizerBalance.availableBalance.toFixed(2)} {selectedCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Tickets Sold
                      </div>
                      <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                        {organizerBalance.summary.totalTicketsSold}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Event Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Event Breakdown
                  </h3>
                  {organizerBalance.revenueBreakdown.map((event) => (
                    <Card
                      key={event.eventId}
                      className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800"
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {event.eventTitle}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {event.totalTicketsSold} tickets sold
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              {event.totalRevenue.toFixed(2)} {selectedCurrency}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Total Revenue
                            </div>
                          </div>
                        </div>

                        {/* Sales Channel Breakdown */}
                        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Online Sales
                            </div>
                            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                              {event.onlineRevenue?.toFixed(2) || "0.00"} {selectedCurrency}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {event.onlineTicketsSold || 0} tickets
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              On-Door Sales
                            </div>
                            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                              {event.onDoorRevenue?.toFixed(2) || "0.00"} {selectedCurrency}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {event.onDoorTicketsSold || 0} tickets
                            </div>
                          </div>
                        </div>

                        {/* Ticket Type Breakdown */}
                        <div className="mt-4">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ticket Type Breakdown
                          </h5>
                          <div className="space-y-2">
                            {event.ticketTypeBreakdown.map((type, idx) => (
                              <div
                                key={`${type.ticketType}-${type.isOnDoor}-${type.pricePerTicket}-${idx}`}
                                className="flex justify-between items-center text-sm"
                              >
                                <div>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {type.ticketType}{" "}
                                    {type.isOnDoor ? "(On-Door)" : "(Online)"}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                                    ({type.totalSold} sold)
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-green-600 dark:text-green-400 font-medium">
                                    {type.totalRevenue.toFixed(2)} {selectedCurrency}
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    {type.pricePerTicket.toFixed(2)} {selectedCurrency} each
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pending Withdrawals */}
                {organizerBalance.pendingWithdrawals > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400">
                      Pending Withdrawals
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-400">
                      {organizerBalance.pendingWithdrawals.toFixed(2)} {selectedCurrency}
                      pending
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Organizer Details Dialog */}
        <Dialog
          open={organizerDetailsDialogOpen}
          onOpenChange={setOrganizerDetailsDialogOpen}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                Organizer Details
              </DialogTitle>
            </DialogHeader>

            {selectedOrganizer && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Full Name
                        </p>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedOrganizer.firstName}{" "}
                          {selectedOrganizer.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Email
                        </p>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedOrganizer.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Phone Number
                        </p>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedOrganizer.phoneNumber || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Joined Date
                        </p>
                        <p className="text-gray-900 dark:text-gray-100">
                          {new Date(
                            selectedOrganizer.createdAt
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Events Overview */}
                <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Events Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          Total Events
                        </p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {selectedOrganizer.events?.length || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Active Events
                        </p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {selectedOrganizer.events?.filter(
                            (event) => event.status === "published"
                          )?.length || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          Total Revenue
                        </p>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                          {selectedOrganizer.events
                            .reduce(
                              (sum, event) =>
                                sum + calculateRevenue(event.tickets || [], selectedCurrency),
                              0
                            )
                            .toFixed(2)}{" "}
                          {selectedCurrency}
                        </p>
                      </div>
                    </div>

                    {/* Events List */}
                    <div className="mt-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Recent Events
                      </h4>
                      <div className="space-y-3">
                        {selectedOrganizer.events?.slice(0, 5).map((event) => (
                          <EventCardWithStats
                            key={event._id}
                            event={event}
                            token={token}
                            selectedCurrency={selectedCurrency}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ticket Statistics */}
                <Card className="border border-gray-200 dark:border-gray-700 shadow-md dark:bg-gray-800">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Ticket Statistics
                    </h3>
                    <div className="space-y-4">
                      {selectedOrganizer.events?.map((event) => (
                        <div
                          key={event._id}
                          className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
                        >
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                            {event.title}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {event.ticketTypes?.map((type) => {
                              const soldCount = event.tickets
                                ? event.tickets
                                    .filter(
                                      (t) =>
                                        t.ticketType === type.name ||
                                        (type._id &&
                                          t.ticketType === type._id) ||
                                        (t.ticketType &&
                                          type.name &&
                                          t.ticketType.toLowerCase() ===
                                            type.name.toLowerCase())
                                    )
                                    .reduce(
                                      (sum, t) =>
                                        sum + getTicketQuantity(t, event),
                                      0
                                    )
                                : 0;

                              return (
                                <div
                                  key={type.name}
                                  className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                                >
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {type.name}
                                  </p>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {type.quantity} available
                                    </span>
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                      {type.price.toFixed(2)} {selectedCurrency}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    {soldCount} sold
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}