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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
}

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
  });
  
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
          setStatistics(data.statistics || {
            totalRevenue: 0,
            totalTickets: 0,
            onDoorRevenue: 0,
            onDoorTickets: 0,
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
  }, [selectedEventId, searchQuery]);

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

  // Filter paid tickets only (exclude free/invitation)
  const filteredTickets = tickets.filter((ticket) => {
    if (!ticket.price || ticket.price <= 0) return false;

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

  // Group tickets by type, ondoor/online, and single ticket price
  type TicketGroup = {
    ticketType: string;
    isOnDoor: boolean;
    pricePerTicket: number;
    totalSold: number;
  };
  const ticketGroups: TicketGroup[] = [];
  const groupMap = new Map<string, TicketGroup>();
  filteredTickets.forEach((ticket) => {
    const quantity = getTicketQuantity(ticket);
    // Calculate price per single ticket
    const pricePerTicket =
      ticket.price && quantity > 0 ? ticket.price / quantity : 0;
    const key = `${ticket.ticketType}|${
      ticket.isOnDoor ? "ondoor" : "online"
    }|${pricePerTicket}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        ticketType: ticket.ticketType,
        isOnDoor: !!ticket.isOnDoor,
        pricePerTicket,
        totalSold: 0,
      });
    }
    groupMap.get(key)!.totalSold += quantity;
  });
  ticketGroups.push(...groupMap.values());

  // On-door sales
  const onDoorTickets = filteredTickets.filter((t) => !!t.isOnDoor);
  const onDoorRevenue = onDoorTickets.reduce((sum, t) => sum + t.price, 0);
  const onDoorTicketsCount = onDoorTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  // Totals
  const totalRevenue = filteredTickets.reduce((sum, t) => sum + t.price, 0);
  const totalTicketsCount = filteredTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  
  // Only use client-side pagination when searching
  const isSearching = searchQuery.trim().length > 0;
  const paginatedTickets = isSearching
    ? filteredTickets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )
    : filteredTickets;

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
      </div>

      {/* Filters & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {statistics.totalRevenue.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              From {statistics.totalTickets} tickets
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
                {group.ticketType} {group.isOnDoor ? "On-Door" : "Online"} @ ETB{" "}
                {group.pricePerTicket.toLocaleString()}
              </p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {group.totalSold} tickets
              </p>
            </div>
          </div>
        ))}

        {/* On-Door Sales */}
        {statistics.onDoorTickets > 0 && (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">On-Door Sales</p>
              <h3 className="text-2xl font-bold text-gray-900">
                ETB {statistics.onDoorRevenue.toLocaleString()}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                From {statistics.onDoorTickets} tickets
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        )}
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Ticket Sales ({filteredTickets.length})
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
                          ETB {ticket.price.toLocaleString()}
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
              {Math.min(currentPage * itemsPerPage, filteredTickets.length)} of{" "}
              {filteredTickets.length} tickets
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
