"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCompactMoney } from "@/lib/utils";

interface Event {
  _id: string;
  title: string;
  startDate: string;
  status: string;
  ticketTypes: {
    _id: string;
    name: string;
    price: number;
  }[];
}

interface Ticket {
  _id: string;
  ticketId: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  ticketType: string;
  ticketCount: number;
  price: number;
  status: string;
  createdAt: string;
  paymentStatus: string;
  isInvitation?: boolean;
  isOnDoor?: boolean;
  purchaseQuantity?: number;
  currency?: "ETB" | "USD";
}

type CurrencyFilter = "ALL" | "ETB" | "USD";

export default function CustomersPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  // Statistics State
  const [statistics, setStatistics] = useState({
    totalRevenue: 0,
    totalTickets: 0,
    onDoorRevenue: 0,
    onDoorTickets: 0,
    onlineRevenue: 0,
    onlineTickets: 0,
    totalRevenueByCurrency: { ETB: 0, USD: 0 },
    totalTicketsByCurrency: { ETB: 0, USD: 0 },
    onDoorByCurrency: {
      revenue: { ETB: 0, USD: 0 },
      tickets: { ETB: 0, USD: 0 },
    },
    ticketTypeBreakdown: [] as TicketTypeBreakdown[],
  });
  
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Server-side pagination state
  const [serverPage, setServerPage] = useState(1);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [totalTicketCount, setTotalTicketCount] = useState(0);

  // Fetch Events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) {
          toast.error("Authentication required");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const allEvents = data.events || data.data || [];
          setEvents(allEvents);

          if (allEvents.length > 0 && !selectedEventId) {
            setSelectedEventId(allEvents[0]._id);
          }
        } else {
          toast.error("Failed to load events");
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        toast.error("Error loading events");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  // Fetch Tickets when Event Changes
  useEffect(() => {
    const fetchTickets = async () => {
      if (!selectedEventId) {
        setTickets([]);
        return;
      }

      setIsLoadingTickets(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        // Reset pagination and fetch first page
        setServerPage(1);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}?page=1&limit=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets || []);
          const defaultStats = {
            totalRevenue: 0,
            totalTickets: 0,
            onDoorRevenue: 0,
            onDoorTickets: 0,
            onlineRevenue: 0,
            onlineTickets: 0,
            totalRevenueByCurrency: { ETB: 0, USD: 0 },
            totalTicketsByCurrency: { ETB: 0, USD: 0 },
            onDoorByCurrency: {
              revenue: { ETB: 0, USD: 0 },
              tickets: { ETB: 0, USD: 0 },
            },
            ticketTypeBreakdown: [],
          };
          const incomingStats = data.statistics || {};
          setStatistics({
            ...defaultStats,
            ...incomingStats,
            ticketTypeBreakdown: incomingStats.ticketTypeBreakdown || [],
          });
          setHasMoreTickets(data.hasMore || false);
          setTotalTicketCount(data.totalCount || 0);
        } else {
          toast.error("Failed to load tickets");
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error("Error loading customers");
        setTickets([]);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [selectedEventId]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEventId, searchQuery, currencyFilter]);

  const handleLoadMore = async () => {
    if (!selectedEventId || !hasMoreTickets || isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const nextPage = serverPage + 1;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}?page=${nextPage}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTickets((prev) => [...prev, ...(data.tickets || [])]);
        setHasMoreTickets(data.hasMore || false);
        setServerPage(nextPage);
      } else {
        toast.error("Failed to load more tickets");
      }
    } catch (error) {
      console.error("Error loading more tickets:", error);
      toast.error("Error loading more customers");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  const getTicketCurrency = (ticket: Ticket): "ETB" | "USD" =>
    ticket.currency === "USD" ? "USD" : "ETB";

  // Calculate correct ticket quantity (handles old price changes before Dec 14, 2025)
  const getTicketQuantity = (ticket: Ticket): number => {
    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    const cutoffDate = new Date("2025-12-14T00:00:00Z");
    const ticketDate = new Date(ticket.createdAt);

    if (
      ticketDate < cutoffDate &&
      selectedEvent?.ticketTypes &&
      ticket.price > 0
    ) {
      const type = selectedEvent.ticketTypes.find(
        (t) => t.name.toLowerCase() === ticket.ticketType.toLowerCase()
      );

      if (type && type.price > 0) {
        const expectedTotal = quantity * type.price;
        if (Math.abs(expectedTotal - ticket.price) > 1) {
          const calculated = Math.round(ticket.price / type.price);
          if (calculated > 0) return calculated;
        }
      }
    }

    return quantity;
  };

  // Special handling for event 69850bb726e5a027f6b03279
  const SPECIAL_EVENT_ID = "69850bb726e5a027f6b03279";
  const CUSTOM_ONDOOR_AMOUNT = 793000;
  const isSpecialEvent = selectedEventId === SPECIAL_EVENT_ID;

  // Filter paid tickets only (exclude free/invitation)
  const filteredTickets = tickets.filter((ticket) => {
    if (!ticket.price || ticket.price <= 0) return false;

    // For special event, hide the manual ondoor sales entry from the table
    if (isSpecialEvent && ticket.isOnDoor && ticket.price === CUSTOM_ONDOOR_AMOUNT) {
      return false;
    }

    const searchLower = searchQuery.toLowerCase();
    const name = ticket.user
      ? `${ticket.user.firstName} ${ticket.user.lastName}`
      : ticket.guestName || "Guest";
    const email = ticket.user?.email || ticket.guestEmail || "";
    const ticketId = ticket.ticketId || "";

    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      ticketId.toLowerCase().includes(searchLower)
    );
  });

  const currencyFilteredTickets = filteredTickets.filter((ticket) => {
    if (currencyFilter === "ALL") return true;
    return getTicketCurrency(ticket) === currencyFilter;
  });

  // Group tickets by type, currency, ondoor/online, and single ticket price
  type TicketTypeBreakdown = {
    ticketType: string;
    currency: "ETB" | "USD";
    isOnDoor: boolean;
    pricePerTicket: number;
    totalSold: number;
    totalRevenue: number;
  };

  const ticketGroupsFromStats = (statistics.ticketTypeBreakdown || [])
    .map((group) => ({
      ...group,
      currency: (group.currency === "USD" ? "USD" : "ETB") as "ETB" | "USD",
    }))
    .filter((group) =>
      currencyFilter === "ALL" ? true : group.currency === currencyFilter,
    );

  const ticketGroupsFromLoadedTickets =
    currencyFilteredTickets.reduce<TicketTypeBreakdown[]>((groups, ticket) => {
      const quantity = getTicketQuantity(ticket);
      const pricePerTicket = quantity > 0 ? ticket.price / quantity : 0;
      const currency = getTicketCurrency(ticket);
      const key = `${ticket.ticketType}|${currency}|${ticket.isOnDoor ? "ondoor" : "online"}|${pricePerTicket}`;
      const existing = groups.find(
        (group) =>
          `${group.ticketType}|${group.currency}|${group.isOnDoor ? "ondoor" : "online"}|${group.pricePerTicket}` === key,
      );

      if (existing) {
        existing.totalSold += quantity;
        existing.totalRevenue += ticket.price || 0;
      } else {
        groups.push({
          ticketType: ticket.ticketType,
          currency,
          isOnDoor: !!ticket.isOnDoor,
          pricePerTicket,
          totalSold: quantity,
          totalRevenue: ticket.price || 0,
        });
      }

      return groups;
    }, []);

  const ticketGroups =
    ticketGroupsFromStats.length > 0
      ? ticketGroupsFromStats
      : ticketGroupsFromLoadedTickets;

  const fallbackTotalRevenueByCurrency = filteredTickets.reduce(
    (acc, ticket) => {
      const currency = getTicketCurrency(ticket);
      acc[currency] += ticket.price || 0;
      return acc;
    },
    { ETB: 0, USD: 0 },
  );

  const fallbackTotalTicketsByCurrency = filteredTickets.reduce(
    (acc, ticket) => {
      const currency = getTicketCurrency(ticket);
      acc[currency] += getTicketQuantity(ticket);
      return acc;
    },
    { ETB: 0, USD: 0 },
  );

  const fallbackOnDoorByCurrency = filteredTickets
    .filter((ticket) => ticket.isOnDoor)
    .reduce(
      (acc, ticket) => {
        const currency = getTicketCurrency(ticket);
        acc.revenue[currency] += ticket.price || 0;
        acc.tickets[currency] += getTicketQuantity(ticket);
        return acc;
      },
      {
        revenue: { ETB: 0, USD: 0 },
        tickets: { ETB: 0, USD: 0 },
      },
    );

  const totalRevenueByCurrency =
    (statistics.totalRevenueByCurrency.ETB || statistics.totalRevenueByCurrency.USD)
      ? statistics.totalRevenueByCurrency
      : fallbackTotalRevenueByCurrency;

  const totalTicketsByCurrency =
    (statistics.totalTicketsByCurrency.ETB || statistics.totalTicketsByCurrency.USD)
      ? statistics.totalTicketsByCurrency
      : fallbackTotalTicketsByCurrency;

  const onDoorByCurrency =
    (statistics.onDoorByCurrency.revenue.ETB ||
      statistics.onDoorByCurrency.revenue.USD ||
      statistics.onDoorByCurrency.tickets.ETB ||
      statistics.onDoorByCurrency.tickets.USD)
      ? statistics.onDoorByCurrency
      : fallbackOnDoorByCurrency;

  const totalPages = Math.ceil(currencyFilteredTickets.length / itemsPerPage);
  
  // Only use client-side pagination when searching
  const isSearching = searchQuery.trim().length > 0;
  const paginatedTickets = isSearching
    ? currencyFilteredTickets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )
    : currencyFilteredTickets;

  // Export to Excel logic
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      if (!selectedEventId) {
        toast.error("No event selected");
        return;
      }
      if (!filteredTickets.length) {
        toast.error("No tickets to export");
        return;
      }
      const data = filteredTickets.map((ticket) => {
        const buyerName = ticket.isOnDoor
          ? "On-Door Purchase"
          : ticket.user
          ? `${ticket.user.firstName} ${ticket.user.lastName}`
          : ticket.guestName || "Guest";

        // Email logic: blank if contains 'pazimo' or starts with 'customerpazimo'
        let email = ticket.user?.email || ticket.guestEmail || "";
        if (
          !email ||
          email.toLowerCase().includes("pazimo") ||
          email.toLowerCase().startsWith("customerpazimo")
        ) {
          email = "";
        }

        // Phone logic: only use real phone, else blank
        let buyerPhone = ticket.user?.phone || ticket.guestPhone || ticket.guestPhoneNumber || ticket.phone || "";
        if (!buyerPhone) {
          buyerPhone = "";
        }

        const ticketType = ticket.ticketType;
        const quantity = getTicketQuantity(ticket);
        const total = quantity;
        const used = Math.max(0, total - (ticket.ticketCount || 0));
        const usage = `${used}/${total}`;
        const status = ticket.status ? (ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)) : "";
        const totalPrice = ticket.price;
        const dateTime = `${new Date(ticket.createdAt).toLocaleDateString()} ${new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        return {
          "Buyer Name": buyerName,
          "Email": email,
          "Phone Number": buyerPhone,
          "Ticket Type": ticketType,
          "Quantity": quantity,
          "Usage": usage,
          "Total Price": totalPrice,
          "Date & Time": dateTime,
          "Status": status,
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
      XLSX.writeFile(workbook, `event-tickets-${selectedEventId}.xlsx`);
      toast.success("Excel file exported!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Error exporting tickets");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500">
            Manage your event attendees and ticket sales
          </p>
        </div>
        {/* Export to Excel Button */}
        <div>
          <Button onClick={handleExportExcel} variant="outline" disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export to Excel"
            )}
          </Button>
        </div>
      </div>

      {/* Filters & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <Select
            value={currencyFilter}
            onValueChange={(value: CurrencyFilter) => setCurrencyFilter(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All currencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ETB">ETB</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Event Selector */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <Select
            value={selectedEventId}
            onValueChange={setSelectedEventId}
            disabled={isLoadingEvents}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingEvents ? (
                <SelectItem value="loading" disabled>
                  Loading events...
                </SelectItem>
              ) : events.length === 0 ? (
                <SelectItem value="no-events" disabled>
                  No events found
                </SelectItem>
              ) : (
                events.map((event) => (
                  <SelectItem key={event._id} value={event._id}>
                    {event.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <h3 className="text-lg font-bold text-gray-900">ETB {formatCompactMoney(totalRevenueByCurrency.ETB, "ETB")}</h3>
            <h3 className="text-lg font-bold text-gray-900">USD {formatCompactMoney(totalRevenueByCurrency.USD, "USD")}</h3>
            <p className="text-xs text-gray-500 mt-1">
              ETB tickets: {totalTicketsByCurrency.ETB} • USD tickets: {totalTicketsByCurrency.USD}
            </p>
          </div>
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
        </div>

        {/* Tickets Sold at Different Prices (Grouped) */}
        {ticketGroups.map((group, idx) => (
          <div
            key={group.ticketType + group.isOnDoor + group.pricePerTicket + idx}
            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">
                {group.ticketType} {group.isOnDoor ? "On-Door" : "Online"} @ {group.currency}{" "}
                {group.pricePerTicket.toLocaleString()}
              </p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {group.totalSold} tickets
              </p>
            </div>
          </div>
        ))}

        {/* On-Door Sales */}
        {isSpecialEvent ? (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-2">Ondoor Sales</p>
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {CUSTOM_ONDOOR_AMOUNT.toLocaleString()}
            </h3>
          </div>
        ) : statistics.onDoorTickets > 0 ? (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">On-Door Sales</p>
              <h3 className="text-lg font-bold text-gray-900">ETB {formatCompactMoney(onDoorByCurrency.revenue.ETB, "ETB")}</h3>
              <h3 className="text-lg font-bold text-gray-900">USD {formatCompactMoney(onDoorByCurrency.revenue.USD, "USD")}</h3>
              <p className="text-xs text-gray-500 mt-1">
                ETB tickets: {onDoorByCurrency.tickets.ETB} • USD tickets: {onDoorByCurrency.tickets.USD}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Tickets Summary */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-lg font-semibold text-gray-900">Summary</div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="text-sm text-gray-700">
            <span className="font-medium">Total Tickets Sold:</span> {filteredTickets.reduce((sum, t) => sum + getTicketQuantity(t), 0)}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">Total Revenue:</span> {filteredTickets.reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Ticket Sales ({currencyFilteredTickets.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by name, email, or ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Buyer & Ticket ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingTickets ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="text-gray-500">Loading tickets...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {selectedEventId
                      ? "No paid tickets found for this event."
                      : "Please select an event to view customers."}
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket) => {
                  const total = getTicketQuantity(ticket);
                  const used = Math.max(0, total - (ticket.ticketCount || 0));
                  const remaining = ticket.ticketCount || 0;

                  return (
                    <tr
                      key={ticket._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {(
                              ticket.user?.firstName?.[0] ||
                              ticket.guestName?.[0] ||
                              "G"
                            ).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {ticket.isOnDoor
                                ? "On-Door Purchase"
                                : ticket.user
                                ? `${ticket.user.firstName} ${ticket.user.lastName}`
                                : ticket.guestName || "Guest"}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              ID: {ticket.ticketId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {ticket.ticketType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium">
                          {used} <span className="text-gray-400">/</span>{" "}
                          {total}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">
                          {getTicketCurrency(ticket)} {ticket.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ticket.paymentStatus}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(ticket.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            ticket.status === "active" ||
                            ticket.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : ticket.status === "used"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {ticket.status.charAt(0).toUpperCase() +
                            ticket.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {/* Pagination or Load More */}
        {isSearching && totalPages > 1 ? (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, currencyFilteredTickets.length)} of{" "}
              {currencyFilteredTickets.length} tickets
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : !isSearching && hasMoreTickets ? (
          <div className="px-6 py-6 border-t border-gray-200 flex flex-col items-center gap-3 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {tickets.length} of {totalTicketCount} rows
            </p>
            <Button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full max-w-xs"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                "Load More Tickets"
              )}
            </Button>
          </div>
        ) : !isSearching && tickets.length > 0 ? (
          <div className="px-6 py-4 border-t border-gray-200 text-center bg-gray-50">
            <p className="text-sm text-gray-600">
              All {tickets.length} tickets loaded
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
