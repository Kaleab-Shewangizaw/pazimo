"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
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
  PlusCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  Eye,
  Pencil,
  Trash2,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Tag,
  Ticket,
  QrCode,
  Download,
  Copy,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";

export default function EventsPage() {
  const router = useRouter();
  const {
    events,
    isLoading,
    error,
    fetchEvents,
    deleteEvent,
    publishEvent,
    cancelEvent,
  } = useEventStore();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [qrEvent, setQrEvent] = useState<any>(null);

  // Backend now filters out invitation events automatically
  const regularEvents = events;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(regularEvents.length / itemsPerPage);

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return regularEvents.slice(startIndex, endIndex);
  };

  useEffect(() => {
    const checkAuth = () => {
      // Get auth state from localStorage
      const authState = localStorage.getItem("auth-storage");
      if (!authState) {
        router.push("/organizer/sign-in");
        return false;
      }

      try {
        const { state } = JSON.parse(authState);
        const { user, token, isAuthenticated } = state;

        if (!isAuthenticated || !token || user.role !== "organizer") {
          // console.log('Invalid auth state:', { isAuthenticated, role: user?.role });
          router.push("/organizer/sign-in");
          return false;
        }

        // Store necessary info in localStorage for easy access
        localStorage.setItem("userId", user._id);
        localStorage.setItem("userRole", user.role);
        localStorage.setItem("token", token);

        return true;
      } catch (error) {
        console.error("Error parsing auth state:", error);
        router.push("/organizer/sign-in");
        return false;
      }
    };

    if (checkAuth()) {
      const userId = localStorage.getItem("userId");
      if (userId) {
        loadEvents(userId);
      }
    }
  }, [router]);

  const loadEvents = async (userId: string) => {
    try {
      await fetchEvents(userId);
    } catch (error) {
      console.error("Failed to load events:", error);
      toast.error("Failed to load events");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(id);
      await deleteEvent(id);
      toast.success("Event deleted successfully");
      const userId = localStorage.getItem("userId");
      if (userId) {
        await loadEvents(userId);
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast.error("Failed to delete event");
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      setIsPublishing(id);
      await publishEvent(id);
      toast.success("Event published successfully");
      const userId = localStorage.getItem("userId");
      if (userId) {
        await loadEvents(userId);
      }
    } catch (error) {
      console.error("Failed to publish event:", error);
      toast.error("Failed to publish event");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setIsCancelling(id);
      await cancelEvent(id);
      toast.success("Event cancelled successfully");
      const userId = localStorage.getItem("userId");
      if (userId) {
        await loadEvents(userId);
      }
    } catch (error) {
      console.error("Failed to cancel event:", error);
      toast.error("Failed to cancel event");
    } finally {
      setIsCancelling(null);
    }
  };

  // Pagination controls
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleRowClick = (event: any) => {
    handleViewEventDetails(event);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  const handleViewEventDetails = async (event: any) => {
    try {
      // Show modal with basic event info immediately
      setSelectedEventDetails({
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: {
          address: event.location?.address,
          city: event.location?.city,
          country: event.location?.country,
        },
        status: event.status,
        eventType: event.eventType,
        capacity: event.capacity,
        ticketTypes: event.ticketTypes || [],
        tags: event.tags || [],
        ageRestriction: event.ageRestriction,
      });
      setShowEventDetailsModal(true);

      // Try to fetch detailed info from API if available
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");

        if (token && process.env.NEXT_PUBLIC_API_URL) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/${event._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            setSelectedEventDetails(data.data || data.event);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching event details:", error);
      // Still show the modal with basic info even if API fails
    }
  };

  const generateQRCode = async (event: any) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
      const shareQrUrl = `${baseUrl}/event_detail?id=${event._id}`;
      const qrDataUrl = await QRCode.toDataURL(shareQrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0D47A1",
          light: "#FFFFFF",
        },
      });
      setShareQrDataUrl(qrDataUrl);
      setQrEvent(event);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!shareQrDataUrl || !qrEvent) return;
    const link = document.createElement("a");
    link.href = shareQrDataUrl;
    link.download = `buy-${qrEvent._id}-ticket.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyBuyLink = () => {
    if (!qrEvent) return;
    const baseUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
    const shareQrUrl = `${baseUrl}/event_detail?id=${qrEvent._id}`;
    navigator.clipboard.writeText(shareQrUrl);
    toast.success("Buy link copied");
  };

  // Check authentication
  const authState = localStorage.getItem("auth-storage");
  if (!authState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to view your events
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/organizer/sign-in")}
              className="w-full"
            >
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  try {
    const { state } = JSON.parse(authState);
    const { user, token, isAuthenticated } = state;

    if (!isAuthenticated || !token || user.role !== "organizer") {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                Please sign in as an organizer to view your events
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                onClick={() => router.push("/organizer/sign-in")}
                className="w-full"
              >
                Sign In
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }
  } catch (error) {
    console.error("Error parsing auth state:", error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              There was an error loading your authentication state
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/organizer/sign-in")}
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
        <div className="text-center flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-gray-500">Loading events...</p>
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
                  loadEvents(userId);
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

  return (
    <div className="container mx-auto py-8 p-5">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Events</h1>
        <Button
          onClick={() => router.push("/organizer/events/create")}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Create New Event
        </Button>
      </div>

      {regularEvents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Events Found</CardTitle>
            <CardDescription>
              You haven't created any events yet
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/organizer/events/create")}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Your First Event
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="font-semibold">Event Title</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Capacity</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getCurrentPageItems().map((event) => (
                  <TableRow
                    key={event._id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(event)}
                  >
                    <TableCell>
                      <span className="font-medium text-gray-900">
                        {event.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.startDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {event.location?.address || "No address"},{" "}
                        {event.location?.city || "No city"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-gray-50 text-gray-700 border-gray-200"
                      >
                        {event.category?.name || "Uncategorized"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="h-4 w-4" />
                        {event.capacity || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${
                          event.status === "published"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : event.status === "draft"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : event.status === "cancelled"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateQRCode(event);
                          }}
                          className="text-green-600 hover:text-green-700"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <div className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, regularEvents.length)}{" "}
                  of {regularEvents.length} events
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Details Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center justify-between">
              <span>Event Details</span>
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Event Title
                      </p>
                      <p className="text-gray-900">{selectedEvent.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Description
                      </p>
                      <p className="text-gray-600">
                        {selectedEvent.description ||
                          "No description available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Category
                      </p>
                      <Badge
                        variant="outline"
                        className="bg-gray-50 text-gray-700 border-gray-200"
                      >
                        {selectedEvent.category?.name || "Uncategorized"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Status
                      </p>
                      <Badge
                        variant="outline"
                        className={`
                          selectedEvent.status === "published"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : selectedEvent.status === "draft"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : selectedEvent.status === "cancelled"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {selectedEvent.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Date & Time
                      </p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Start: {formatDate(selectedEvent.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 mt-1">
                        <Calendar className="h-4 w-4" />
                        <span>End: {formatDate(selectedEvent.endDate)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Location
                      </p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {selectedEvent.location?.address || "No address"},{" "}
                          {selectedEvent.location?.city || "No city"},{" "}
                          {selectedEvent.location?.country || "No country"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Capacity
                      </p>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>{selectedEvent.capacity || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.tags.map((tag: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ticket Types */}
              {selectedEvent.ticketTypes &&
                selectedEvent.ticketTypes.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Ticket Types</h3>
                    <div className="grid gap-4">
                      {selectedEvent.ticketTypes.map(
                        (ticket: any, index: number) => (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-gray-500" />
                                    <span className="font-medium">
                                      {ticket.name}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {ticket.description}
                                  </p>
                                  {ticket.startDate && ticket.endDate && (
                                    <p className="text-xs text-gray-400">
                                      Available: {formatDate(ticket.startDate)}{" "}
                                      - {formatDate(ticket.endDate)}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">
                                    {ticket.price} Birr
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Quantity: {ticket.quantity}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Available: {ticket.available ? "Yes" : "No"}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Section */}
      {shareQrDataUrl && qrEvent && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Event QR Code - {qrEvent.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img
                    src={shareQrDataUrl}
                    alt="Event QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Scan to Buy Tickets
                </h3>
                <p className="text-gray-600 mb-4">
                  Open your camera or QR app to start checkout instantly for
                  this event.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    onClick={downloadQRCode}
                    className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                  <Button variant="outline" onClick={copyBuyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Buy Link
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
