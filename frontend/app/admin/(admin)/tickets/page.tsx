"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  MapPin,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  DollarSign,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Ticket {
  _id: string;
  ticketId: string;
  event: {
    _id: string;
    title: string;
    organizer: {
      _id: string;
      name: string;
    };
  };
  user: {
    name: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  ticketType: string;
  price: number;
  status: "active" | "used" | "cancelled" | "expired" | "confirmed";
  purchaseDate: string;
  ticketCount: number;
  purchaseQuantity: number;
  isOnDoor?: boolean;
  paymentStatus?: string;
}

interface Event {
  _id: string;
  title: string;
  organizer: {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
  };
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  capacity: number;
  ticketTypes: {
    _id: string;
    name: string;
    price: number;
  }[];
}

export default function TicketsPage() {
  const { token } = useAdminAuthStore();

  // View State
  const [view, setView] = useState<"events" | "tickets">("events");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Data State
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Loading State
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Filter/Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Fetch Events on Mount
  useEffect(() => {
    const fetchEvents = async () => {
      if (!token) return;

      try {
        setLoadingEvents(true);
        // Fetching all events. Adjust limit if necessary.
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events?limit=1000&sort=-createdAt`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch events");

        const data = await response.json();
        setEvents(data.data || []);
      } catch (error) {
        console.error("Error fetching events:", error);
        toast.error("Failed to fetch events");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [token]);

  // Fetch Tickets when Event Selected
  useEffect(() => {
    const fetchTickets = async () => {
      if (!selectedEvent || !token) return;

      try {
        setLoadingTickets(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEvent._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch tickets");

        const data = await response.json();
        setTickets(data.tickets || []);
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error("Failed to fetch tickets");
      } finally {
        setLoadingTickets(false);
      }
    };

    if (view === "tickets" && selectedEvent) {
      fetchTickets();
    }
  }, [view, selectedEvent, token]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- Handlers ---

  const handleViewTickets = (event: Event) => {
    setSelectedEvent(event);
    setView("tickets");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleBackToEvents = () => {
    setView("events");
    setSelectedEvent(null);
    setTickets([]);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleCheckIn = async (ticketId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticketId}/check-in`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to check in");

      // Update local state
      setTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId
            ? {
                ...t,
                status: "used",
                ticketCount: Math.max(0, (t.ticketCount || 1) - 1),
              }
            : t
        )
      );
      toast.success("Ticket checked in successfully");
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to check in ticket");
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticketId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to delete ticket");

      setTickets((prev) => prev.filter((t) => t._id !== ticketId));
      toast.success("Ticket deleted successfully");
    } catch (error) {
      console.error("Error deleting ticket:", error);
      toast.error("Failed to delete ticket");
    }
  };

  // --- Filtering & Pagination Logic ---

  // Events View Logic
  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.organizer?.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalEventPages = Math.ceil(filteredEvents.length / itemsPerPage);

  // Tickets View Logic
  const filteredTickets = tickets.filter((ticket) => {
    const searchLower = searchQuery.toLowerCase();
    const name = ticket.user?.name || ticket.guestName || "Guest";
    const email = ticket.user?.email || ticket.guestEmail || "";
    const ticketId = ticket.ticketId || "";

    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      ticketId.toLowerCase().includes(searchLower)
    );
  });

  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalTicketPages = Math.ceil(filteredTickets.length / itemsPerPage);

  // Helper to calculate ticket quantity
  const getTicketQuantity = (ticket: Ticket) => {
    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    // Check if ticket was bought before Dec 14, 2025
    const cutoffDate = new Date("2025-12-14");
    const ticketDate = new Date(ticket.purchaseDate || "");

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

  // Revenue Calculations
  const totalRevenue = filteredTickets.reduce(
    (sum, t) => sum + (Number(t.price) || 0),
    0
  );
  const totalTicketsCount = filteredTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  const onDoorTickets = filteredTickets.filter((t) => !!t.isOnDoor);
  const onDoorRevenue = onDoorTickets.reduce(
    (sum, t) => sum + (Number(t.price) || 0),
    0
  );
  const onDoorTicketsCount = onDoorTickets.reduce(
    (sum, t) => sum + getTicketQuantity(t),
    0
  );

  // --- Render ---

  if (view === "events") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Tickets Management
            </h1>
            <p className="text-gray-600 mt-1">
              Select an event to manage tickets
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-6">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Title</TableHead>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEvents ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex justify-center items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Loading events...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedEvents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-gray-500"
                      >
                        No events found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEvents.map((event) => (
                      <TableRow key={event._id}>
                        <TableCell className="font-medium">
                          {event.title}
                        </TableCell>
                        <TableCell>
                          {event.organizer?.firstName
                            ? `${event.organizer.firstName} ${event.organizer.lastName}`
                            : event.organizer?.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {new Date(event.startDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {event.location?.city || "Online"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewTickets(event)}
                            className="gap-2"
                          >
                            See Tickets
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Events Pagination */}
            {totalEventPages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalEventPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalEventPages, p + 1))
                  }
                  disabled={currentPage === totalEventPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tickets View
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          onClick={handleBackToEvents}
          className="w-fit gap-2 pl-0 hover:pl-2 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedEvent?.title}
            </h1>
            <p className="text-gray-500">Manage tickets for this event</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {totalRevenue.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              From {totalTicketsCount} tickets
            </p>
          </div>
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">On-Door Sales</p>
            <h3 className="text-2xl font-bold text-gray-900">
              ETB {onDoorRevenue.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              From {onDoorTicketsCount} tickets
            </p>
          </div>
          <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickets List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Buyer & Ticket ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Usage (Used/Total)</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTickets ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Loading tickets...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedTickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No tickets found
                    </TableCell>
                  </TableRow>
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
                      <TableRow key={ticket._id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {ticket.isOnDoor
                                  ? "On-Door Purchase"
                                  : ticket.user?.name ||
                                    ticket.guestName ||
                                    "Guest"}
                              </span>
                              {ticket.isOnDoor && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-5 px-1"
                                >
                                  On-Door
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 font-mono mt-0.5">
                              ID: {ticket.ticketId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{ticket.ticketType}</TableCell>
                        <TableCell>
                          <span className="font-medium">{used}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-gray-500">{total}</span>
                        </TableCell>
                        <TableCell>{ticket.price.toFixed(2)} birr</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ticket.status === "active"
                                ? "default"
                                : ticket.status === "cancelled"
                                ? "destructive"
                                : ticket.status === "used"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(ticket.purchaseDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {ticket.status !== "used" &&
                              ticket.status !== "cancelled" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCheckIn(ticket._id)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Check In"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTicket(ticket._id)}
                              className="h-8 w-8 p-0"
                              title="Delete Ticket"
                            >
                              <Trash2 className="h-4 w-4" />
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

          {/* Tickets Pagination */}
          {totalTicketPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalTicketPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalTicketPages, p + 1))
                }
                disabled={currentPage === totalTicketPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
