"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { UsherAccessDialog } from "@/components/events/usher-access-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import Link from "next/link";
import { buildEventUrl } from "@/lib/event-url";
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
  ScanLine,
  Download,
  Copy,
  Loader2,
  Ban,
  CheckCircle2,
  Beer,
} from "lucide-react";
import Image from "next/image";
import { generateDottedQrDataUrl } from "@/lib/qrStyle";
import { downloadHighQualityQR } from "@/lib/downloadQR";

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
    toggleSoldOut,
  } = useEventStore();
  const { token: organizerToken } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isTogglingSoldOut, setIsTogglingSoldOut] = useState<string | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any>(null);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [qrEvent, setQrEvent] = useState<any>(null);
  // Organizers who were never granted beverage selling should not see the
  // button at all. This is presentation only — every line-up endpoint is
  // gated by requireBeverageEligible on the server.
  const [beverageEligible, setBeverageEligible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("auth-storage");
    if (!stored) return;
    let token = "";
    try {
      token = JSON.parse(stored)?.state?.token || "";
    } catch {
      return;
    }
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/beverages/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBeverageEligible(data?.data?.eligibility === "eligible"))
      .catch(() => setBeverageEligible(false));
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(events.length / itemsPerPage);

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return events.slice(startIndex, endIndex);
  };

  useEffect(() => {
    const checkAuth = () => {
      const authState = localStorage.getItem("auth-storage");
      if (!authState) {
        router.push("/organizer/sign-in");
        return false;
      }

      try {
        const { state } = JSON.parse(authState);
        const { user, token, isAuthenticated } = state;

        if (!isAuthenticated || !token || user.role !== "organizer") {
          router.push("/organizer/sign-in");
          return false;
        }

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
    setShowEventDetailsModal(false);
    setSelectedEventDetails(null);
  };

  const handleViewEventDetails = async (event: any) => {
    try {
      setSelectedEvent(event);
      setSelectedEventDetails({
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
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
        category: event.category,
      });
      setShowEventDetailsModal(true);

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
    }
  };

  const generateQRCode = async (event: any) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
      const shareQrUrl = `${baseUrl}${buildEventUrl(event)}`;
      const qrDataUrl = await generateDottedQrDataUrl(shareQrUrl);
      setShareQrDataUrl(qrDataUrl);
      setQrEvent(event);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!shareQrDataUrl || !qrEvent) return;
    downloadHighQualityQR(shareQrDataUrl, `buy-${qrEvent._id}-ticket.png`);
  };

  const copyBuyLink = () => {
    if (!qrEvent) return;
    const baseUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
    const shareQrUrl = `${baseUrl}${buildEventUrl(qrEvent)}`;
    navigator.clipboard.writeText(shareQrUrl);
    toast.success("Buy link copied");
  };

  // Check authentication
  const authState = localStorage.getItem("auth-storage");
  if (!authState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-[350px]">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to view your events</CardDescription>
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
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Card className="w-full max-w-[350px]">
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-[350px]">
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

  const statusBadgeVariant = (status: string) =>
    status === "published"
      ? "success"
      : status === "draft"
      ? "warning"
      : status === "cancelled"
      ? "destructive"
      : "info";

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <PageHeader
          title="My Events"
          actions={
            <Button onClick={() => router.push("/organizer/events/create")}>
              <PlusCircle className="h-4 w-4" />
              Create Event
            </Button>
          }
        />

        {events.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={Calendar}
                title="No events found"
                description="You haven't created any events yet."
                action={
                  <Button onClick={() => router.push("/organizer/events/create")}>
                    <PlusCircle className="h-4 w-4" />
                    Create your first event
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getCurrentPageItems().map((event) => (
                  <TableRow
                    key={event._id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(event)}
                  >
                    <TableCell className="font-medium max-w-[160px] truncate">
                      {event.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.startDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {event.location?.address || "No address"},{" "}
                        {event.location?.city || "No city"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {event.category?.name || "Uncategorized"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {event.capacity || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={statusBadgeVariant(event.status)}>
                          {event.status}
                        </Badge>
                        {event.isSoldOut && (
                          <Badge variant="destructive">Sold out</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/organizer/events/edit/${event._id}`);
                          }}
                          className="h-8 w-8"
                          title="Edit event"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <UsherAccessDialog
                          eventId={event._id}
                          eventTitle={event.title}
                          token={organizerToken || ""}
                          triggerVariant="outline"
                        />
                        {beverageEligible && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/organizer/events/${event._id}/beverages`);
                            }}
                            className="h-8 w-8"
                            title="Beverage sales"
                          >
                            <Beer className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/organizer/qr-scanner?mode=ticket&eventId=${event._id}`);
                          }}
                          className="h-8 w-8"
                          title="Open scoped scanner"
                        >
                          <ScanLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateQRCode(event);
                          }}
                          className="h-8 w-8"
                          title="Generate QR code"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setIsTogglingSoldOut(event._id);
                            await toggleSoldOut(event._id, !event.isSoldOut);
                            setIsTogglingSoldOut(null);
                          }}
                          disabled={isTogglingSoldOut === event._id}
                          className={
                            event.isSoldOut
                              ? "h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                              : "h-8 w-8"
                          }
                          title={event.isSoldOut ? "Mark as available" : "Mark as sold out"}
                        >
                          {isTogglingSoldOut === event._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : event.isSoldOut ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, events.length)}{" "}
                  of {events.length} events
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8"
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
      <Dialog open={showEventDetailsModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEventDetails && (
            <div className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Event Title
                      </p>
                      <p>{selectedEventDetails.title}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Description
                      </p>
                      <p className="text-muted-foreground">
                        {selectedEventDetails.description ||
                          "No description available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Category
                      </p>
                      <Badge variant="outline">
                        {selectedEventDetails.category?.name || "Uncategorized"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Status
                      </p>
                      <Badge variant={statusBadgeVariant(selectedEventDetails.status)}>
                        {selectedEventDetails.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Date & Time
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Start: {formatDate(selectedEventDetails.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <Calendar className="h-4 w-4" />
                        <span>End: {formatDate(selectedEventDetails.endDate)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Location
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {selectedEventDetails.location?.address || "No address"},{" "}
                          {selectedEventDetails.location?.city || "No city"},{" "}
                          {selectedEventDetails.location?.country || "No country"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Capacity
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{selectedEventDetails.capacity || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedEventDetails.tags && selectedEventDetails.tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEventDetails.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ticket Types */}
              {selectedEventDetails.ticketTypes &&
                selectedEventDetails.ticketTypes.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold">Ticket Types</h3>
                    <div className="grid gap-3">
                      {selectedEventDetails.ticketTypes.map(
                        (ticket: any, index: number) => (
                          <Card key={index} className="py-4">
                            <CardContent>
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{ticket.name}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {ticket.description}
                                  </p>
                                  {ticket.startDate && ticket.endDate && (
                                    <p className="text-xs text-muted-foreground">
                                      Available: {formatDate(ticket.startDate)}{" "}
                                      - {formatDate(ticket.endDate)}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{ticket.price} Birr</p>
                                  <p className="text-sm text-muted-foreground">
                                    Quantity: {ticket.quantity}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
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
            <CardTitle>Event QR code — {qrEvent.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0 bg-card p-4 rounded-lg border">
                <img src={shareQrDataUrl} alt="Event QR Code" className="w-48 h-48" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-semibold mb-1">Scan to buy tickets</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Open your camera or QR app to start checkout instantly for
                  this event.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button onClick={downloadQRCode}>
                    <Download className="h-4 w-4" />
                    Download QR
                  </Button>
                  <Button variant="outline" onClick={copyBuyLink}>
                    <Copy className="h-4 w-4" />
                    Copy buy link
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}