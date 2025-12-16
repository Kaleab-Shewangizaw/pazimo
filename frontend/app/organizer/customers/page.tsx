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
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch Events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) return;

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

          // Select the first event by default if available
          if (allEvents.length > 0) {
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

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets || []);
        } else {
          // If 401/403, it might be because the user is not the organizer (shouldn't happen if logic is correct)
          console.error("Failed to fetch tickets");
          setTickets([]);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error("Error loading customers");
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [selectedEventId]);

  // Reset pagination when event or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEventId, searchQuery]);

  // Filter tickets based on search
  const filteredTickets = tickets.filter((ticket) => {
    // Match admin/tickets page logic: Include all tickets with price > 0
    // This aligns with the Gross Revenue calculation
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

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  // Helper to calculate ticket quantity
  const getTicketQuantity = (ticket: Ticket) => {
    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    // Check if ticket was bought before Dec 14, 2025
    const cutoffDate = new Date("2025-12-14");
    const ticketDate = new Date(ticket.createdAt || ticket.purchaseDate || "");

    if (ticketDate < cutoffDate) {
      if (selectedEvent?.ticketTypes && ticket.price > 0) {
        const type = selectedEvent.ticketTypes.find(
          (t) =>
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

    return quantity;
  };

  const onDoorTickets = filteredTickets.filter((t) => !!t.isOnDoor);
  const onDoorRevenue = onDoorTickets.reduce(
    (sum, t) => sum + (Number(t.price) || 0),
    0
  );
  const onDoorTicketsCount = onDoorTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  const totalRevenue = filteredTickets.reduce(
    (sum, ticket) => sum + (Number(ticket.price) || 0),
    0
  );
  const totalTicketsCount = filteredTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Event Selector */}
        <div className="flex-1 w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <Select
            value={selectedEventId}
            onValueChange={(value) => setSelectedEventId(value)}
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

        {/* Revenue Card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4 min-w-[250px]">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {totalRevenue.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              From {totalTicketsCount} tickets
            </p>
          </div>
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
        </div>

        {/* On-Door Revenue Card */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4 min-w-[250px]">
          <div>
            <p className="text-sm font-medium text-gray-500">On-Door Sales</p>
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {onDoorRevenue.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              From {onDoorTicketsCount} tickets
            </p>
          </div>
          <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Ticket Sales
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
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
                  Usage (Used/Total)
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
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p>Loading customers...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {selectedEventId
                      ? "No tickets found for this event."
                      : "Select an event to view customers."}
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket) => {
                  const total = getTicketQuantity(ticket);
                  // If status is 'used', assume fully used regardless of ticketCount
                  // Otherwise use ticketCount as remaining
                  const remaining =
                    ticket.status === "used"
                      ? 0
                      : ticket.ticketCount !== undefined
                      ? ticket.ticketCount
                      : 1;
                  const used = total - remaining;

                  return (
                    <tr key={ticket._id} className="hover:bg-gray-50">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 text-xs">
                            {(
                              ticket.user?.firstName?.[0] ||
                              ticket.guestName?.[0] ||
                              "G"
                            ).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {ticket.isOnDoor
                                ? "On-Door Purchase"
                                : ticket.user
                                ? `${ticket.user.firstName} ${ticket.user.lastName}`
                                : ticket.guestName || "Guest"}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              ID: {ticket.ticketId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ticket.ticketType}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">
                          {used} <span className="text-gray-400">/</span>{" "}
                          {total}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ETB {ticket.price?.toLocaleString() || "0"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ticket.paymentStatus}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(ticket.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
        {filteredTickets.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredTickets.length)} of{" "}
              {filteredTickets.length} results
            </div>
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
        )}
      </div>
    </div>
  );
}
