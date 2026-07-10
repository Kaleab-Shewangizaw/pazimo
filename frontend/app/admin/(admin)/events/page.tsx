"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Search,
  Trash2,
  MapPin,
  Users,
  Eye,
  EyeOff,
  Info,
  Star,
  Signal,
  Ticket,
  Pencil,
  Loader2,
  Check,
  Copy,
  Flame,
  Sparkles,
} from "lucide-react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IoMdCloseCircle } from "react-icons/io";

interface Event {
  _id: string;
  title: string;
  description: string;
  category: {
    _id: string;
    name: string;
    description: string;
  };
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  status: string;
  capacity: number;
  bannerStatus: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  ticketTypes: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  coverImage: string;
  organizer: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  ticketsSold?: number;
}

export default function EventsPage() {
  const router = useRouter();
  const { token, admin } = useAdminAuthStore();
  const isPartner = admin?.role === "partner";
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [publishFilter, setPublishFilter] = useState("All");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isGenerateTicketDialogOpen, setIsGenerateTicketDialogOpen] =
    useState(false);
  const [selectedEventForTicket, setSelectedEventForTicket] =
    useState<Event | null>(null);
  const [ticketFormData, setTicketFormData] = useState({
    ticketTypeId: "",
    quantity: 1,
  });
  const [generatedTicket, setGeneratedTicket] = useState<any | null>(null);
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const [checkInCount, setCheckInCount] = useState(1);

  const fetchEvents = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events?detailed=true&limit=10000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      const regularEvents = (data.data || []).filter(
        (event: any) => !event.isInvitationEvent
      );
      setEvents(regularEvents);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch events"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const overviewStats = useMemo(() => {
    const liveEvents = events.filter(
      (event) => event.status === "published"
    ).length;
    const bannerEvents = events.filter((event) => event.bannerStatus).length;
    const totalTicketsSold = events.reduce(
      (acc, event) => acc + (event.ticketsSold || 0),
      0
    );
    return { liveEvents, bannerEvents, totalTicketsSold };
  }, [events]);

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.address
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      event.location.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || event.status === statusFilter;
    const matchesCategory =
      categoryFilter === "All" || event.category?.name === categoryFilter;
    const matchesPublish =
      publishFilter === "All" ||
      (publishFilter === "Published" && event.status === "published") ||
      (publishFilter === "Unpublished" && event.status !== "published");
    return matchesSearch && matchesStatus && matchesCategory && matchesPublish;
  });

  const totalEvents = filteredEvents.length;
  const totalPages = Math.ceil(totalEvents / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, publishFilter]);

  const handleDelete = (eventId: string) => {
    setEventToDelete(eventId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventToDelete}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      toast.success("Event deleted successfully");
      fetchEvents();
    } catch (error) {
      toast.error("Failed to delete event");
    } finally {
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const handleTogglePublish = async (
    eventId: string,
    currentStatus: boolean
  ) => {
    try {
      const newStatus = currentStatus ? "draft" : "published";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/publish`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update event status");
      }

      toast.success(
        `Event ${
          newStatus === "published" ? "published" : "unpublished"
        } successfully`
      );
      fetchEvents();
    } catch (error) {
      toast.error("Failed to update event status");
    }
  };

  const handleToggleBanner = async (
    eventId: string,
    currentStatus: boolean
  ) => {
    try {
      const newBannerStatus = !currentStatus;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/banner`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bannerStatus: newBannerStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update banner status");
      }

      toast.success(
        `Event ${
          newBannerStatus ? "added to" : "removed from"
        } banner successfully`
      );

      setEvents(
        events.map((event) =>
          event._id === eventId
            ? { ...event, bannerStatus: newBannerStatus }
            : event
        )
      );
    } catch (error) {
      toast.error("Failed to update banner status");
    }
  };

  const handleToggleFeatured = async (
    eventId: string,
    currentStatus: boolean | undefined
  ) => {
    try {
      const newStatus = !currentStatus;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/featured`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isFeatured: newStatus }),
        }
      );

      if (!response.ok) throw new Error("Failed to update featured status");

      toast.success(
        `Event ${newStatus ? "marked as featured" : "removed from featured"}`
      );

      setEvents(
        events.map((event) =>
          event._id === eventId ? { ...event, isFeatured: newStatus } : event
        )
      );
    } catch (error) {
      toast.error("Failed to update featured status");
    }
  };

  const handleToggleTrending = async (
    eventId: string,
    currentStatus: boolean | undefined
  ) => {
    try {
      const newStatus = !currentStatus;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/trending`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isTrending: newStatus }),
        }
      );

      if (!response.ok) throw new Error("Failed to update trending status");

      toast.success(
        `Event ${newStatus ? "marked as trending" : "removed from trending"}`
      );

      setEvents(
        events.map((event) =>
          event._id === eventId ? { ...event, isTrending: newStatus } : event
        )
      );
    } catch (error) {
      toast.error("Failed to update trending status");
    }
  };

  const handleCancelEvent = async (eventId: string, currentStatus: string) => {
    try {
      const newStatus =
        currentStatus === "draft" || currentStatus === "published"
          ? "cancelled"
          : "draft";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/publish`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update event status");
      }

      toast.success(
        `Event ${
          newStatus === "cancelled" ? "cancelled" : "restored to draft"
        } successfully`
      );
      fetchEvents();
    } catch (error) {
      toast.error("Failed to update event status");
    }
  };

  const handleViewEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleOpenGenerateTicket = (event: Event) => {
    setSelectedEventForTicket(event);
    setTicketFormData({ ticketTypeId: "", quantity: 1 });
    setGeneratedTicket(null);
    setCheckInCount(1);
    setIsGenerateTicketDialogOpen(true);
  };

  const handleGenerateTicket = async () => {
    if (!selectedEventForTicket || !ticketFormData.ticketTypeId) return;

    try {
      setIsGeneratingTicket(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/on-door`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId: selectedEventForTicket._id,
            ticketTypeId: ticketFormData.ticketTypeId,
            quantity: ticketFormData.quantity,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate ticket");
      }

      setGeneratedTicket(data.data.ticket);
      setCheckInCount(data.data.ticket.ticketCount);
      toast.success("Ticket generated successfully");
      fetchEvents();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate ticket"
      );
    } finally {
      setIsGeneratingTicket(false);
    }
  };

  const handleMarkAsUsed = async () => {
    if (!generatedTicket) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${generatedTicket.ticketId}/check-in`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ count: checkInCount }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark ticket as used");
      }

      toast.success(`Marked ${checkInCount} ticket(s) as used`);
      setIsGenerateTicketDialogOpen(false);
    } catch (error) {
      toast.error("Failed to mark ticket as used");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">All Events</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage and view all events in the system
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <Card className="dark:bg-black dark:border-gray-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <Signal className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Live Events</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {overviewStats.liveEvents}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-black dark:border-gray-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-full">
              <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Banner Events</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {overviewStats.bannerEvents}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-none shadow-sm dark:bg-black dark:border dark:border-gray-800 mb-6">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full md:w-[300px] border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="dark:bg-black dark:border-gray-700">
              <SelectItem value="All" className="dark:text-gray-200">All Status</SelectItem>
              <SelectItem value="draft" className="dark:text-gray-200">Draft</SelectItem>
              <SelectItem value="published" className="dark:text-gray-200">Published</SelectItem>
              <SelectItem value="cancelled" className="dark:text-gray-200">Cancelled</SelectItem>
              <SelectItem value="completed" className="dark:text-gray-200">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent className="dark:bg-black dark:border-gray-700">
              <SelectItem value="All" className="dark:text-gray-200">All Categories</SelectItem>
              <SelectItem value="conference" className="dark:text-gray-200">Conference</SelectItem>
              <SelectItem value="seminar" className="dark:text-gray-200">Seminar</SelectItem>
              <SelectItem value="workshop" className="dark:text-gray-200">Workshop</SelectItem>
              <SelectItem value="concert" className="dark:text-gray-200">Concert</SelectItem>
              <SelectItem value="exhibition" className="dark:text-gray-200">Exhibition</SelectItem>
              <SelectItem value="sports" className="dark:text-gray-200">Sports</SelectItem>
              <SelectItem value="other" className="dark:text-gray-200">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={publishFilter} onValueChange={setPublishFilter}>
            <SelectTrigger className="w-[180px] border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200">
              <SelectValue placeholder="Filter by visibility" />
            </SelectTrigger>
            <SelectContent className="dark:bg-black dark:border-gray-700">
              <SelectItem value="All" className="dark:text-gray-200">All Visibility</SelectItem>
              <SelectItem value="Published" className="dark:text-gray-200">Published</SelectItem>
              <SelectItem value="Unpublished" className="dark:text-gray-200">Unpublished</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Events Table */}
      <Card className="border-none shadow-sm dark:bg-black dark:border dark:border-gray-800">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 dark:bg-gray-900/50">
                <TableHead className="font-semibold dark:text-gray-300">Event Title</TableHead>
                <TableHead className="font-semibold dark:text-gray-300">Date</TableHead>
                <TableHead className="font-semibold dark:text-gray-300">Location</TableHead>
                <TableHead className="font-semibold dark:text-gray-300">Category</TableHead>
                <TableHead className="font-semibold dark:text-gray-300">Capacity</TableHead>
                <TableHead className="font-semibold dark:text-gray-300">Status</TableHead>
                <TableHead className="font-semibold dark:text-gray-300 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvents.map((event) => (
                <TableRow
                  key={event._id}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors border-gray-100 dark:border-gray-800"
                >
                  <TableCell>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {event.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      {event.location.address}, {event.location.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                    >
                      {event.category?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Users className="h-4 w-4" />
                      {event.capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${
                        event.status === "published"
                          ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                          : event.status === "draft"
                          ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                          : event.status === "cancelled"
                          ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                          : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        onClick={() => handleViewEvent(event)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                        onClick={() => handleOpenGenerateTicket(event)}
                        title="Generate On-Door Ticket"
                      >
                        <Ticket className="h-4 w-4" />
                      </Button>
                      {!isPartner && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            onClick={() =>
                              router.push(`/admin/events/edit/${event._id}`)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300"
                            onClick={() =>
                              handleToggleBanner(event._id, event.bannerStatus)
                            }
                          >
                            <Star
                              className={`h-4 w-4 ${
                                event.bannerStatus ? "fill-current" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                            onClick={() =>
                              handleToggleFeatured(event._id, event.isFeatured)
                            }
                          >
                            <Sparkles
                              className={`h-4 w-4 ${
                                event.isFeatured ? "fill-current" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                            onClick={() =>
                              handleToggleTrending(event._id, event.isTrending)
                            }
                          >
                            <Flame
                              className={`h-4 w-4 ${
                                event.isTrending ? "fill-current" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              event.status === "published"
                                ? "text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            }
                            onClick={() =>
                              handleTogglePublish(
                                event._id,
                                event.status === "published"
                              )
                            }
                          >
                            {event.status === "published" ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            onClick={() => handleCancelEvent(event._id, event.status)}
                          >
                            {event.status !== "cancelled" ? (
                              <IoMdCloseCircle className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            onClick={() => handleDelete(event._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {startIndex + 1} to {Math.min(endIndex, totalEvents)} of{" "}
              {totalEvents} events
            </span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px] border-gray-200 dark:border-gray-700 dark:bg-black dark:text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-black dark:border-gray-700">
                <SelectItem value="5" className="dark:text-gray-200">5</SelectItem>
                <SelectItem value="10" className="dark:text-gray-200">10</SelectItem>
                <SelectItem value="20" className="dark:text-gray-200">20</SelectItem>
                <SelectItem value="50" className="dark:text-gray-200">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600 dark:text-gray-400">per page</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={
                      currentPage === pageNumber 
                        ? "" 
                        : "border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="border-gray-200 dark:border-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Event Details Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto dark:bg-black dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Event Details
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-8 pr-2">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedEvent.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                      >
                        {selectedEvent.category?.name}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`${
                          selectedEvent.status === "published"
                            ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                            : selectedEvent.status === "draft"
                            ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                            : selectedEvent.status === "cancelled"
                            ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                        }`}
                      >
                        {selectedEvent.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedEvent.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Date
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(
                            selectedEvent.startDate
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Time
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(
                            selectedEvent.startDate
                          ).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Location
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedEvent.location.address}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {selectedEvent.location.city},{" "}
                        {selectedEvent.location.country}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Capacity
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedEvent.capacity} attendees
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Organizer
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {selectedEvent.organizer?.firstName &&
                          selectedEvent.organizer?.lastName
                            ? `${selectedEvent.organizer.firstName} ${selectedEvent.organizer.lastName}`
                            : "Unknown Organizer"}
                        </p>
                      </div>
                    </div>
                    {selectedEvent.organizer?.email && (
                      <div className="ml-10">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedEvent.organizer.email}
                        </p>
                      </div>
                    )}
                    {selectedEvent.organizer?.phone && (
                      <div className="ml-10">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedEvent.organizer.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Available Ticket Types
                  </h4>
                </div>
                <div className="grid gap-3">
                  {selectedEvent.ticketTypes.map((type, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {type.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Available: {type.quantity} tickets
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {type.price.toFixed(2)} birr
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">per ticket</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate On-Door Ticket Dialog */}
      <Dialog
        open={isGenerateTicketDialogOpen}
        onOpenChange={setIsGenerateTicketDialogOpen}
      >
        <DialogContent className="sm:max-w-md dark:bg-black dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Generate On-Door Ticket</DialogTitle>
          </DialogHeader>

          {!generatedTicket ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-200">Ticket Type</label>
                <Select
                  value={ticketFormData.ticketTypeId}
                  onValueChange={(value) =>
                    setTicketFormData({
                      ...ticketFormData,
                      ticketTypeId: value,
                    })
                  }
                >
                  <SelectTrigger className="dark:bg-black dark:border-gray-700 dark:text-gray-200">
                    <SelectValue placeholder="Select ticket type" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-black dark:border-gray-700">
                    {selectedEventForTicket?.ticketTypes.map((type) => (
                      <SelectItem key={type.name} value={type.name} className="dark:text-gray-200">
                        {type.name} ({type.quantity} available) - {type.price}{" "}
                        ETB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-200">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  max={
                    selectedEventForTicket?.ticketTypes.find(
                      (t) => t.name === ticketFormData.ticketTypeId
                    )?.quantity || 1
                  }
                  value={ticketFormData.quantity}
                  onChange={(e) =>
                    setTicketFormData({
                      ...ticketFormData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="dark:bg-black dark:border-gray-700 dark:text-gray-200"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Max available:{" "}
                  {selectedEventForTicket?.ticketTypes.find(
                    (t) => t.name === ticketFormData.ticketTypeId
                  )?.quantity || 0}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleGenerateTicket}
                disabled={!ticketFormData.ticketTypeId || isGeneratingTicket}
              >
                {isGeneratingTicket ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Ticket"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-4 flex flex-col items-center text-center">
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-full">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg dark:text-gray-100">Ticket Generated!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Share this QR code with the customer
                </p>
              </div>

              {generatedTicket.qrCode && (
                <div className="border p-4 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700">
                  <img
                    src={generatedTicket.qrCode}
                    alt="Ticket QR Code"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              )}

              <div className="w-full space-y-2">
                <Button
                  variant="outline"
                  className="w-full dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  onClick={() => {
                    setGeneratedTicket(null);
                    setTicketFormData({ ticketTypeId: "", quantity: 1 });
                  }}
                >
                  Generate Another
                </Button>

                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Check-in Count
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={generatedTicket.ticketCount}
                      value={checkInCount}
                      onChange={(e) =>
                        setCheckInCount(parseInt(e.target.value) || 1)
                      }
                      className="dark:bg-black dark:border-gray-700 dark:text-gray-200"
                    />
                  </div>
                  <Button
                    className="flex-1"
                    onClick={handleMarkAsUsed}
                    disabled={
                      checkInCount > generatedTicket.ticketCount ||
                      checkInCount < 1
                    }
                  >
                    Mark as Used
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-black dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              This action cannot be undone. This will permanently delete the
              event and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}