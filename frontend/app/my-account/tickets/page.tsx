"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
// import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner";
import { Event, TicketType } from "@/types/event";

export default function TicketsPage() {
  const [visibleTickets, setVisibleTickets] = useState(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"active" | "used">("active");
  const [eventImageCache, setEventImageCache] = useState<
    Record<string, string>
  >({});

  const normalizePathSeparators = (value?: string) =>
    typeof value === "string" ? value.replace(/\\\\/g, "/") : value;

  const buildImageSrc = (pathOrUrl?: string) => {
    const normalized = normalizePathSeparators(pathOrUrl || "");
    if (!normalized) return "";
    if (normalized.startsWith("http")) return normalized;
    const withLeadingSlash = normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;
    return `${process.env.NEXT_PUBLIC_API_URL}${withLeadingSlash}`;
  };

  const getEventImageSrc = (event: Event) => {
    const images: string[] = Array.isArray(event?.coverImages)
      ? event.coverImages
      : [];
    if (images.length > 0) {
      return buildImageSrc(images[0]) || "/events/eventimg.png";
    }
    if (event?.coverImage) {
      return buildImageSrc(event.coverImage) || "/events/eventimg.png";
    }
    return "/events/eventimg.png";
  };

  const EventImage = ({
    event,
    width,
    height,
    className,
  }: {
    event: Event;
    width: number;
    height: number;
    className?: string;
  }) => {
    const [src, setSrc] = useState<string>("/events/eventimg.png");

    useEffect(() => {
      const computeLocal = () => {
        const local = getEventImageSrc(event);
        return local || "/events/eventimg.png";
      };

      const applySrc = (val: string) => {
        if (val && typeof val === "string") setSrc(val);
      };

      const localSrc = computeLocal();
      const hasLocalImage = localSrc && localSrc !== "/events/eventimg.png";

      if (hasLocalImage) {
        applySrc(localSrc);
        return;
      }

      const eventId: string | undefined = event?._id;
      if (!eventId) {
        applySrc(localSrc);
        return;
      }

      if (eventImageCache[eventId]) {
        applySrc(eventImageCache[eventId]);
        return;
      }

      // Fetch event details to resolve cover image
      (async () => {
        try {
          const r = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`
          );
          const j = await r.json();
          if (j?.data) {
            const resolved = getEventImageSrc(j.data);
            const finalSrc = resolved || "/events/eventimg.png";
            setEventImageCache((prev) => ({ ...prev, [eventId]: finalSrc }));
            applySrc(finalSrc);
          } else {
            applySrc(localSrc);
          }
        } catch (e) {
          console.warn("Failed to fetch event details for image", eventId, e);
          applySrc(localSrc);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?._id, event?.coverImages, event?.coverImage, eventImageCache]);

    return (
      <Image
        src={src}
        alt={event?.title || "Event image"}
        width={width}
        height={height}
        className={className}
        unoptimized
      />
    );
  };

  // Download QR code function
  const downloadQRCode = (
    qrCodeDataUrl: string,
    ticketId: string,
    ticketType: string,
    eventTitle: string
  ) => {
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `ticket-${ticketId}-${eventTitle}-${ticketType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`QR code for ${eventTitle} downloaded!`);
  };

  // Download all QR codes for an event
  const downloadAllEventQRCodes = (group: any) => {
    if (!group.tickets.length) return;

    try {
      group.tickets.forEach((ticket: TicketType, index: number) => {
        setTimeout(() => {
          downloadQRCode(
            ticket.qrCode,
            ticket.ticketId,
            ticket.quantity,
            ticket.eventTitle || "event",
            ticket.ticketType || "ticket",
            group.event.title
          );
        }, index * 500); // Stagger downloads
      });
      toast.success(
        `Starting download of all QR codes for ${group.event.title}...`
      );
    } catch (error) {
      toast.error("Failed to download QR codes");
    }
  };

  useEffect(() => {
    const fetchTickets = async () => {
      console.log("Starting to fetch tickets...");

      const storedAuth = localStorage.getItem("auth-storage");
      let userId;
      let token: string | undefined;

      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          userId = parsedAuth.state?.user?._id;
          token = parsedAuth.state?.token;
          console.log(
            "Auth found - User ID:",
            userId,
            "Token exists:",
            !!token
          );
        } catch (e) {
          console.error("Failed to parse auth", e);
          setLoading(false);
          return;
        }
      }

      if (!userId) {
        console.log("No user ID found, stopping fetch");
        setLoading(false);
        return;
      }

      if (!token) {
        console.log("No token found, stopping fetch");
        setLoading(false);
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          throw new Error(
            "API URL not configured. Please check NEXT_PUBLIC_API_URL environment variable."
          );
        }

        // First, test if backend is reachable
        try {
          const healthCheck = await fetch(`${apiUrl}/api/health`);
          console.log("Backend health check:", healthCheck.status);
        } catch (healthError) {
          console.warn("Backend health check failed:", healthError);
          throw new Error(
            "Backend server is not reachable. Please make sure the backend is running on port 5000."
          );
        }

        const fullUrl = `${apiUrl}/api/tickets/my-tickets`;
        console.log("Making API call to:", fullUrl);

        const res = await fetch(fullUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("API Response Status:", res.status);
        console.log("API Response OK:", res.ok);

        if (!res.ok) {
          const errorText = await res.text();
          console.log("Error response body:", errorText);
          throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log("API Response Data:", data);

        // Handle different response formats
        let allTickets: any[] = [];
        if (data?.success && Array.isArray(data?.tickets)) {
          allTickets = data.tickets;
        } else if (Array.isArray(data?.tickets)) {
          allTickets = data.tickets;
        } else if (Array.isArray(data?.data)) {
          allTickets = data.data;
        } else if (Array.isArray(data)) {
          allTickets = data;
        }

        console.log("All tickets found:", allTickets.length);

        const filteredByStatus = allTickets.filter(
          (t: any) => t.status === "active" || t.status === "used"
        );
        console.log("Filtered tickets:", filteredByStatus.length);

        // Collect event IDs for tickets missing populated event objects
        const getEventIdFromTicket = (t: any): string | undefined => {
          if (!t) return undefined;
          if (typeof t.event === "string") return t.event;
          return t.event?._id || t.eventId || t.event_id || undefined;
        };

        const missingEventIds = new Set<string>();
        for (const t of filteredByStatus) {
          const hasEventObject = !!(
            t.event &&
            typeof t.event === "object" &&
            t.event._id
          );
          if (!hasEventObject) {
            const id = getEventIdFromTicket(t);
            if (id) missingEventIds.add(id);
          }
        }

        let eventIdToEvent: Record<string, any> = {};
        if (missingEventIds.size > 0) {
          console.log(
            "Fetching missing event details for IDs:",
            Array.from(missingEventIds)
          );
          try {
            const results = await Promise.all(
              Array.from(missingEventIds).map(async (id) => {
                try {
                  const r = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${id}`
                  );
                  const j = await r.json();
                  if (j?.data && j.data._id) {
                    return [id, j.data] as const;
                  }
                } catch (e) {
                  console.warn("Failed fetching event details for", id, e);
                }
                return [id, null] as const;
              })
            );
            eventIdToEvent = Object.fromEntries(results.filter((p) => p[1]));
          } catch (e) {
            console.warn("Failed batch fetching event details", e);
          }
        }

        // Attach fetched events to tickets where missing
        const hydratedTickets = filteredByStatus.map((t: any) => {
          if (!t.event || !t.event._id) {
            const id = getEventIdFromTicket(t);
            if (id && eventIdToEvent[id]) {
              return { ...t, event: eventIdToEvent[id] };
            }
          }
          return t;
        });

        // Group by event, skip any still missing event data
        const groupedTickets = hydratedTickets.reduce(
          (acc: any, ticket: any) => {
            if (!ticket.event || !ticket.event._id) {
              console.warn(
                "Skipping ticket without resolvable event data:",
                ticket
              );
              return acc;
            }
            const eventId = ticket.event._id;
            if (!acc[eventId]) {
              acc[eventId] = { event: ticket.event, tickets: [] };
            }
            acc[eventId].tickets.push(ticket);
            return acc;
          },
          {}
        );

        const finalTickets = Object.values(groupedTickets);
        console.log("Final grouped tickets:", finalTickets);
        setTickets(finalTickets);
      } catch (err) {
        console.error("Error fetching tickets:", err);
        toast.error("Failed to fetch tickets. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const filteredTickets = tickets
    .filter((ticket) => {
      const hasActiveTickets = ticket.tickets.some(
        (t: any) => t.status === "active"
      );
      const hasUsedTickets = ticket.tickets.some(
        (t: any) => t.status === "used"
      );
      return activeTab === "active" ? hasActiveTickets : hasUsedTickets;
    })
    .map((ticket) => ({
      ...ticket,
      tickets: ticket.tickets.filter((t: any) => t.status === activeTab),
    }))
    .filter(
      (ticket) =>
        ticket.event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.event.location.address
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    );

  const displayedTickets = filteredTickets.slice(0, visibleTickets);
  const hasMoreTickets = visibleTickets < filteredTickets.length;

  const loadMore = () => {
    setVisibleTickets((prev) => prev + 2);
  };

  const handleNextTicket = () => {
    if (
      selectedGroup &&
      currentTicketIndex < selectedGroup.tickets.length - 1
    ) {
      setCurrentTicketIndex((prev) => prev + 1);
    }
  };

  const handlePrevTicket = () => {
    if (selectedGroup && currentTicketIndex > 0) {
      setCurrentTicketIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">My Tickets</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search tickets..."
            className="pl-10 h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "active"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Tickets
        </button>
        <button
          onClick={() => setActiveTab("used")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "used"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Used Tickets
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 mt-10">Loading tickets...</p>
      ) : displayedTickets.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">No tickets found.</p>
      ) : (
        <div className="space-y-4">
          {displayedTickets.map((group) => {
            return (
              <Card key={group.event._id}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                    <div className="w-full sm:w-24 h-32 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <EventImage
                        event={group.event}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold">
                            {group.event.title}
                          </h2>
                          <div className="mt-2 space-y-1 text-sm text-gray-500">
                            <p>
                              <span className="font-medium">Event Date:</span>{" "}
                              {new Date(
                                group.event.startDate
                              ).toLocaleDateString()}
                            </p>
                            <p>
                              <span className="font-medium">Location:</span>{" "}
                              {group.event.location.address},{" "}
                              {group.event.location.city}
                            </p>
                            <p>
                              <span className="font-medium">Tickets:</span>{" "}
                              {group.tickets.reduce(
                                (acc: number, t: TicketType) =>
                                  acc + (t.ticketCount || 1),
                                0
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3">
                          <Badge
                            variant="default"
                            className="font-medium capitalize"
                          >
                            {group.tickets[0].status}
                          </Badge>
                          <p className="text-lg font-semibold text-primary">
                            {group.tickets.reduce(
                              (sum: number, ticket: TicketType) =>
                                sum + ticket.price,
                              0
                            )}{" "}
                            ETB
                          </p>
                          {group.tickets.length > 1 && (
                            <Button
                              onClick={() => downloadAllEventQRCodes(group)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Event ID: {group.event._id}
                        </p>
                        <Dialog
                          onOpenChange={(open) => {
                            if (open) {
                              setSelectedGroup(group);
                              setCurrentTicketIndex(0);
                            } else {
                              setSelectedGroup(null);
                              setCurrentTicketIndex(0);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              View Tickets
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px] p-4">
                            <DialogHeader>
                              <DialogTitle className="text-lg font-bold">
                                {group.event.title}
                              </DialogTitle>
                            </DialogHeader>

                            <div className="mt-4 flex flex-col items-center">
                              {selectedGroup &&
                                selectedGroup.tickets[currentTicketIndex] && (
                                  <>
                                    <div className="flex justify-between items-start w-full mb-4">
                                      <div className="flex flex-col">
                                        <p className="text-sm font-medium">
                                          Ticket ID:{" "}
                                          {
                                            selectedGroup.tickets[
                                              currentTicketIndex
                                            ].ticketId
                                          }
                                        </p>
                                        <p className="text-sm font-bold text-[#0D47A1] mt-1">
                                          Admit:{" "}
                                          {selectedGroup.tickets[
                                            currentTicketIndex
                                          ].ticketCount || 1}{" "}
                                          Person
                                          {(selectedGroup.tickets[
                                            currentTicketIndex
                                          ].ticketCount || 1) > 1
                                            ? "s"
                                            : ""}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="capitalize"
                                      >
                                        {
                                          selectedGroup.tickets[
                                            currentTicketIndex
                                          ].status
                                        }
                                      </Badge>
                                    </div>

                                    <div className="flex justify-center mb-4 relative">
                                      <Image
                                        src={
                                          selectedGroup.tickets[
                                            currentTicketIndex
                                          ].qrCode || "/placeholder.svg"
                                        }
                                        alt="Ticket QR Code"
                                        width={280}
                                        height={280}
                                        className="rounded shadow"
                                      />
                                      {/* Download button overlay */}
                                      {/* <Button
                                      onClick={() => downloadQRCode(
                                        selectedGroup.tickets[currentTicketIndex].qrCode,
                                        selectedGroup.tickets[currentTicketIndex].ticketId,
                                        selectedGroup.tickets[currentTicketIndex].ticketType || 'ticket',
                                        selectedGroup.event.title
                                      )}
                                      size="sm"
                                      className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 border border-gray-300 shadow-sm"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button> */}
                                    </div>

                                    <p className="text-sm text-center text-gray-600 mb-4">
                                      Show this QR code at the event entrance to
                                      check in.
                                    </p>

                                    {/* Download button below QR code */}
                                    <div className="mb-4">
                                      <Button
                                        onClick={() =>
                                          downloadQRCode(
                                            selectedGroup.tickets[
                                              currentTicketIndex
                                            ].qrCode,
                                            selectedGroup.tickets[
                                              currentTicketIndex
                                            ].ticketId,
                                            selectedGroup.tickets[
                                              currentTicketIndex
                                            ].ticketType || "ticket",
                                            selectedGroup.event.title
                                          )
                                        }
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download QR Code
                                      </Button>
                                    </div>

                                    <div className="flex justify-between items-center w-full">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePrevTicket}
                                        disabled={currentTicketIndex === 0}
                                      >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                      </Button>
                                      <p className="text-sm text-gray-500">
                                        {currentTicketIndex + 1} of{" "}
                                        {selectedGroup.tickets.length}
                                      </p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleNextTicket}
                                        disabled={
                                          currentTicketIndex ===
                                          selectedGroup.tickets.length - 1
                                        }
                                      >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasMoreTickets && !loading && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            See More Tickets
          </Button>
        </div>
      )}
    </div>
  );
}
