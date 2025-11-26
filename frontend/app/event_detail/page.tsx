"use client";
import { Button } from "@/components/ui/button";
import {
  Share2,
  MapPin,
  Calendar,
  Clock,
  UserCheck,
  Download,
  ImageIcon,
  BookOpen,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import TicketCounter from "@/components/ticket-counter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { CreditCard, Loader2 } from "lucide-react";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";

type TicketType = {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
  available: boolean;
  startDate?: string;
  endDate?: string;
  wave?: string;
};

type Event = {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: [number, number];
  };
  category: {
    _id: string;
    name: string;
    description: string;
  };
  ticketTypes: TicketType[];
  status: string;
  organizer: {
    name: string;
    email: string;
  };
  coverImages: string[];
  eventImages: Array<{ url: string; caption?: string }>;
  ageRestriction?: {
    hasRestriction: boolean;
    minAge?: number;
    maxAge?: number;
  };
};

type User = {
  tickets: string[];
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
};

type PurchasedTicket = {
  _id: string;
  ticketId: string;
  event: string;
  user: string;
  ticketType: string;
  price: number;
  qrCode: string;
  purchaseDate: string;
  status: string;
  checkedIn: boolean;
  paymentReference?: string;
};

function EventDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = searchParams.get("id");
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicketType, setSelectedTicketType] = useState<string>("");
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>(
    []
  );
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [shouldShowTicketModal, setShouldShowTicketModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);

  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [shareQrUrl, setShareQrUrl] = useState<string>("");

  const [santimForm, setSantimForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    paymentMethod: "Telebirr",
  });
  const [isSantimLoading, setIsSantimLoading] = useState(false);

  // Auth store
  // const { login, signup } = useAuthStore();

  // Download QR code function
  const downloadQRCode = (
    qrCodeDataUrl: string,
    ticketId: string,
    ticketType: string
  ) => {
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `ticket-${ticketId}-${ticketType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`QR code for ${ticketType} ticket downloaded!`);
  };

  // Download all QR codes as ZIP
  const downloadAllQRCodes = async () => {
    if (!purchasedTickets.length) return;
    try {
      purchasedTickets.forEach((ticket, index) => {
        setTimeout(() => {
          downloadQRCode(ticket.qrCode, ticket.ticketId, ticket.ticketType);
        }, index * 500);
      });
      toast.success("Starting download of all QR codes...");
    } catch (error) {
      toast.error("Failed to download QR codes");
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  // Previously auto-triggered payment via shared link; now disabled by request.
  useEffect(() => {
    const qtyParam = searchParams.get("quantity");
    const typeParam = searchParams.get("ticketType");
    if (qtyParam) {
      const parsed = Number.parseInt(qtyParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) setTicketQuantity(parsed);
    }
    if (typeParam && event?.ticketTypes?.some((t) => t.name === typeParam)) {
      setSelectedTicketType(typeParam);
    }
    // Do not auto-call handleBuyClick; user must click Buy.
  }, [searchParams, selectedTicketType, event]);

  // Build share URL and generate QR code (simple event link only)
  useEffect(() => {
    if (!eventId) return;
    try {
      const builtUrl = `${
        process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin
      }/event_detail?id=${eventId}`;
      setShareQrUrl(builtUrl);
      (async () => {
        try {
          const QRCode = (await import("qrcode")).default;
          const dataUrl = await QRCode.toDataURL(builtUrl, {
            width: 256,
            margin: 1,
          });
          setShareQrDataUrl(dataUrl);
        } catch {
          setShareQrDataUrl("");
        }
      })();
    } catch {
      // ignore URL build issues
    }
  }, [eventId]);

  useEffect(() => {
    const storedAuth = localStorage.getItem("auth-storage");
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth);
        const userData = parsedAuth.state?.user;
        if (userData) {
          const derivedId = userData._id || userData.id;
          if (derivedId) setUserId(derivedId);
          setUser(userData);
        }
      } catch (e) {
        console.error("Error parsing auth storage:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (purchasedTickets.length > 0) setCurrentTicketIndex(0);
  }, [purchasedTickets]);

  const fetchEventDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId || ""}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      const data = await response.json();
      setEvent(data.data);
      // Set the first available ticket as default selection
      if (data.data.ticketTypes && data.data.ticketTypes.length > 0) {
        const firstAvailableTicket = data.data.ticketTypes.find(
          (ticket: TicketType) => ticket.available !== false
        );
        if (firstAvailableTicket) {
          setSelectedTicketType(firstAvailableTicket.name);
        }
      }
    } catch (error) {
      console.error("Error fetching event details:", error);
      toast.error("Failed to fetch event details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyClick = async () => {
    if (!selectedTicketType || ticketQuantity < 1) {
      toast.error("Please select ticket type and quantity");
      return;
    }
    try {
      const selectedType = ticketsToDisplay.find(
        (t) => t.name === selectedTicketType
      );
      if (!selectedType) {
        throw new Error("Selected ticket type not found");
      }
      localStorage.setItem("current_event_id", eventId || "");

      // Pre-fill form with user data if logged in
      const u = user || (useAuthStore.getState().user as any);
      if (u) {
        setSantimForm({
          fullName: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email || "",
          phoneNumber: u.phone || u.phoneNumber || "",
          paymentMethod: "Telebirr",
        });
      } else {
        // Clear form for guest
        setSantimForm({
          fullName: "",
          email: "",
          phoneNumber: "",
          paymentMethod: "Telebirr",
        });
      }

      // Open Payment modal
      setShowPaymentModal(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to process payment");
    }
  };

  const verifyAndShowTickets = async (txRef: string) => {
    try {
      // Fetch tickets
      const ticketsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/my-tickets`,
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
        }
      );
      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json();
        // Filter tickets for this transaction
        const newTickets = ticketsData.data.filter(
          (t: PurchasedTicket) => t.paymentReference === txRef
        );
        setPurchasedTickets(newTickets);
        setShowTicketModal(true);
        setShouldShowTicketModal(true);
        toast.success("Payment successful! Your tickets are ready.");
        // Clean URL if needed
        router.replace(`/event_detail?id=${eventId || ""}`);
      }
    } catch (e) {
      console.error("Ticket fetch error", e);
      toast.error("Failed to load tickets");
    }
  };

  const pollPaymentStatus = async (txRef: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes (2s interval)

    const interval = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?txn=${txRef}`
        );
        const data = await response.json();

        if (data.status === "COMPLETED" || data.status === "PAID") {
          clearInterval(interval);
          setIsWaitingForPayment(false);
          setShowPaymentModal(false);

          if (data.ticketId) {
            toast.success("Payment successful! Redirecting to your ticket...");
            router.push(`/my-account/tickets/${data.ticketId}`);
          } else {
            verifyAndShowTickets(txRef);
          }
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setIsWaitingForPayment(false);
          toast.error("Payment failed. Please try again.");
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsWaitingForPayment(false);
          toast.error(
            "Payment verification timed out. Please check 'My Tickets' later."
          );
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
  };

  const handleMobilePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSantimLoading) return;

    if (!santimForm.fullName || !santimForm.phoneNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSantimLoading(true);
    try {
      const selectedType = ticketsToDisplay.find(
        (t) => t.name === selectedTicketType
      );
      if (!selectedType) throw new Error("Ticket type not found");

      // Implicit Auth for Guest
      let finalUserId = userId;
      if (!finalUserId) {
        try {
          const authResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/unified-auth`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fullName: santimForm.fullName,
                email: santimForm.email,
                phoneNumber: santimForm.phoneNumber,
              }),
            }
          );

          if (authResponse.ok) {
            const authResult = await authResponse.json();
            const { user: userData, token } = authResult.data;

            // Update store and state
            useAuthStore.getState().setAuth({ user: userData, token });
            setUser(userData);
            setUserId(userData._id);
            finalUserId = userData._id;

            toast.success("Account created/verified successfully!");
          } else {
            // If auth fails (e.g. existing user with different password),
            // we proceed as guest (finalUserId remains null).
            console.warn("Implicit auth failed, proceeding as guest");
          }
        } catch (err) {
          console.error("Implicit auth error:", err);
          // Proceed as guest
        }
      }

      const amount = selectedType.price * ticketQuantity;
      // Generate orderId on client to ensure we have it for the success URL
      const orderId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate ticketId on client
      const ticketId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/tickets/ticket/initiate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            paymentReason: `Ticket Purchase - ${event?.title}`,
            phoneNumber: santimForm.phoneNumber,
            orderId, // Pass the generated ID
            method: santimForm.paymentMethod,
            ticketDetails: {
              // Changed from ticketData to ticketDetails to match backend
              ticketId: ticketId,
              eventId: eventId,
              ticketTypeId: selectedType._id || selectedType.name,
              quantity: ticketQuantity,
              userId: finalUserId,
              fullName: santimForm.fullName,
              email: santimForm.email,
            },
            successUrl: `${window.location.origin}/my-account/tickets/${ticketId}`,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Payment initiation failed");

      if (data.transactionId) {
        setIsSantimLoading(false);
        setIsWaitingForPayment(true);
        toast.success("Payment initiated! Please check your phone.");
        pollPaymentStatus(data.transactionId);
      } else {
        throw new Error("No transaction ID returned");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
      setIsSantimLoading(false);
    }
  };

  // Handle payment verification after returning from SantimPay
  useEffect(() => {
    const txRef = searchParams.get("tx_ref") || searchParams.get("orderId");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");

    if ((txRef && status) || (paymentStatus === "success" && txRef)) {
      const processPayment = async () => {
        if (status === "success" || paymentStatus === "success") {
          try {
            toast.info("Verifying payment...");
            // Poll for status completion
            let attempts = 0;
            const maxAttempts = 10;
            let verified = false;

            while (attempts < maxAttempts && !verified) {
              const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?txn=${txRef}`
              );
              const data = await response.json();

              if (data.status === "COMPLETED") {
                verified = true;
                verifyAndShowTickets(txRef);
              } else {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                attempts++;
              }
            }

            if (!verified) {
              toast.error(
                "Payment verification timed out. Please check 'My Tickets' later."
              );
            }
          } catch (e) {
            console.error("Payment processing error", e);
            toast.error("Failed to verify payment");
          }
        } else {
          toast.error("Payment was not successful");
          router.replace(`/event_detail?id=${eventId || ""}`);
        }
      };
      if (userId) {
        processPayment();
      }
    }
  }, [searchParams, router, eventId, userId]);

  useEffect(() => {
    const txRef = searchParams.get("tx_ref");
    if (txRef) {
      router.replace(`/event_detail?id=${eventId || ""}`);
    }
  }, [searchParams, router, eventId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D47A1] mx-auto"></div>
          <p className="mt-2 text-[#0D47A1]">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-[#0D47A1]">Event not found</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTimeWithAmPm = (time24?: string): string => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    if (hourStr === undefined || minuteStr === undefined) return time24;
    let hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const minuteFormatted = minute < 10 ? `0${minute}` : minute;
    return `${hour}:${minuteFormatted} ${ampm}`;
  };

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    const start = formatTimeWithAmPm(startTime);
    const end = formatTimeWithAmPm(endTime);
    if (!start && !end) return "Time TBA";
    if (!start) return end;
    if (!end) return start;
    return `${start} - ${end}`;
  };

  const ticketsToDisplay = event.ticketTypes.filter((ticket) => {
    // Show all tickets that are available (not explicitly set to false)
    return ticket.available !== false;
  });

  const calculateTotal = () => {
    const selectedType = ticketsToDisplay.find(
      (t) => t.name === selectedTicketType
    );
    return selectedType ? selectedType.price * ticketQuantity : 0;
  };

  const getSelectedTicketType = () => {
    return ticketsToDisplay.find((t) => t.name === selectedTicketType);
  };

  const isQuantityExceeded = () => {
    const selectedType = getSelectedTicketType();
    return selectedType ? ticketQuantity > selectedType.quantity : false;
  };

  // Debug: Log ticket information
  console.log("=== TICKET DEBUG INFO ===");
  console.log("All tickets from API:", event.ticketTypes);
  console.log("Total tickets:", event.ticketTypes?.length || 0);
  console.log(
    "Tickets with available=true:",
    event.ticketTypes?.filter((t) => t.available === true).length || 0
  );
  console.log(
    "Tickets with available=false:",
    event.ticketTypes?.filter((t) => t.available === false).length || 0
  );
  console.log(
    "Tickets with available=undefined:",
    event.ticketTypes?.filter((t) => t.available === undefined).length || 0
  );
  console.log("Filtered tickets to display:", ticketsToDisplay);
  console.log("Tickets to display count:", ticketsToDisplay?.length || 0);
  console.log("Selected ticket type:", selectedTicketType);
  console.log("========================");

  const getDayName = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
    });
  };

  const getDayNumber = (dateString: string) => {
    return new Date(dateString).getDate().toString().padStart(2, "0");
  };

  const getMonthName = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short" });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <div className="relative w-full overflow-hidden">
        {/* Mobile: Smaller Image with padding */}
        <div className="block md:hidden px-8 py-4">
          <div className="relative w-full max-w-md mx-auto">
            <Image
              src={
                event.coverImages && event.coverImages.length > 0
                  ? event.coverImages[0].startsWith("http")
                    ? event.coverImages[0]
                    : `${process.env.NEXT_PUBLIC_API_URL}${
                        event.coverImages[0].startsWith("/")
                          ? event.coverImages[0]
                          : `/${event.coverImages[0]}`
                      }`
                  : "/events/eventimg.png"
              }
              alt={event.title}
              width={600}
              height={300}
              className="w-full h-auto object-cover rounded-lg shadow-md"
              priority
            />
          </div>
        </div>
        {/* Desktop: Banner with padding and border radius */}
        <div className="hidden md:block relative mx-4 mt-4 mb-8">
          <div className="relative h-[60vh] lg:h-[70vh] w-full rounded-2xl overflow-hidden shadow-lg">
            <Image
              src={
                event.coverImages && event.coverImages.length > 0
                  ? event.coverImages[0].startsWith("http")
                    ? event.coverImages[0]
                    : `${process.env.NEXT_PUBLIC_API_URL}${
                        event.coverImages[0].startsWith("/")
                          ? event.coverImages[0]
                          : `/${event.coverImages[0]}`
                      }`
                  : "/events/eventimg.png"
              }
              alt={event.title}
              fill
              className="object-contain bg-black"
              priority
              sizes="100vw"
              quality={90}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0D47A1]/30 via-[#0D47A1]/60 to-[#0D47A1] rounded-2xl"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16 z-10">
              <Badge className="w-fit mb-4 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white text-sm px-3 py-1">
                {event.category?.name || "Uncategorized"}
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-white leading-tight">
                {event.title}
              </h1>
              {/* Desktop: Show all details */}
              <div className="flex flex-wrap gap-4 items-center mt-4 text-white">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-300" />
                  <span className="text-xl font-semibold">
                    {formatDate(event.startDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-300" />
                  <span>{formatTimeRange(event.startTime, event.endTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-300" />
                  <span>
                    {event.location.address}, {event.location.city}
                  </span>
                </div>
                {event.ageRestriction?.hasRestriction && (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-blue-300" />
                    <span>
                      {event.ageRestriction.minAge &&
                        !event.ageRestriction.maxAge &&
                        `Ages ${event.ageRestriction.minAge}+`}
                      {!event.ageRestriction.minAge &&
                        event.ageRestriction.maxAge &&
                        `Up to age ${event.ageRestriction.maxAge}`}
                      {event.ageRestriction.minAge &&
                        event.ageRestriction.maxAge &&
                        `Ages ${event.ageRestriction.minAge} - ${event.ageRestriction.maxAge}`}
                      {!event.ageRestriction.minAge &&
                        !event.ageRestriction.maxAge &&
                        "Age restricted"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Calendar-style Title and Details Section */}
      <div className="block md:hidden px-4 py-4 bg-white">
        {/* Title and Share Button */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight flex-1">
            {event.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="text-gray-700 border-gray-300 bg-transparent hover:bg-gray-50 flex-shrink-0"
            onClick={() => {
              const shareUrl = `${
                process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin
              }/event_detail?id=${eventId || ""}`;
              if (navigator.share) {
                navigator
                  .share({
                    title: event.title,
                    text: event.description,
                    url: shareUrl,
                  })
                  .catch(() => {});
              } else {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied to clipboard!");
              }
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar-style Date Display and Event Details Layout */}
        <div className="flex gap-4 items-start">
          {/* Calendar-style Date Box */}
          <div className="flex-shrink-0 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm min-w-[70px]">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              {getDayName(event.startDate)}
            </div>
            <div className="text-2xl font-bold text-gray-900 leading-none mt-1">
              {getDayNumber(event.startDate)}
            </div>
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mt-1">
              {getMonthName(event.startDate)}
            </div>
          </div>

          {/* Event Details */}
          <div className="flex-1 space-y-3">
            {/* Location */}
            <div className="flex items-start gap-2 text-gray-700">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600" />
              <div>
                <div className="text-sm font-medium text-blue-600">
                  {event.location.address}
                </div>
                <div className="text-xs text-gray-500">
                  {event.location.city}, {event.location.country}
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4 flex-shrink-0 text-gray-600" />
              <span className="text-sm">
                {formatDate(event.startDate)}
                {event.endDate && event.endDate !== event.startDate && (
                  <span> - {formatDate(event.endDate)}</span>
                )}
              </span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="h-4 w-4 flex-shrink-0 text-gray-600" />
              <span className="text-sm">
                {formatTimeRange(event.startTime, event.endTime)}
              </span>
            </div>

            {/* Organizer */}
            {event.organizer?.name && (
              <div className="text-xs text-gray-500">
                by {event.organizer.name}
              </div>
            )}

            {/* Age Restriction */}
            {event.ageRestriction?.hasRestriction && (
              <div className="flex items-center gap-2 text-gray-700">
                <UserCheck className="h-4 w-4 flex-shrink-0 text-gray-600" />
                <span className="text-xs">
                  {event.ageRestriction.minAge &&
                    !event.ageRestriction.maxAge &&
                    `Ages ${event.ageRestriction.minAge}+`}
                  {!event.ageRestriction.minAge &&
                    event.ageRestriction.maxAge &&
                    `Up to age ${event.ageRestriction.maxAge}`}
                  {event.ageRestriction.minAge &&
                    event.ageRestriction.maxAge &&
                    `Ages ${event.ageRestriction.minAge} - ${event.ageRestriction.maxAge}`}
                  {!event.ageRestriction.minAge &&
                    !event.ageRestriction.maxAge &&
                    "Age restricted"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column - Event Details (desktop only) */}
          <div className="lg:col-span-2 space-y-8 hidden lg:block">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="hidden md:flex bg-white border-b border-gray-200 w-full justify-start rounded-none h-14 p-0">
                <TabsTrigger
                  value="about"
                  className="rounded-none text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-transparent h-14 px-6"
                >
                  About
                </TabsTrigger>
                <TabsTrigger
                  value="images"
                  className="rounded-none text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-transparent h-14 px-6"
                >
                  Images
                </TabsTrigger>
              </TabsList>
              <div className="pb-20 md:pb-0">
                <TabsContent value="about" className="pt-6">
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      About The Event
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="images" className="pt-6">
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Event Images
                    </h2>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {event.coverImages.map((image, index) => (
                          <div
                            key={index}
                            className="relative aspect-video rounded-lg overflow-hidden"
                          >
                            <Image
                              src={
                                image.startsWith("http")
                                  ? image
                                  : `${process.env.NEXT_PUBLIC_API_URL}${
                                      image.startsWith("/")
                                        ? image
                                        : `/${image}`
                                    }`
                              }
                              alt={`Cover image ${index + 1}`}
                              fill
                              className="object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {event.eventImages && event.eventImages.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-gray-900">
                          Event Gallery
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {event.eventImages.map((image, index) => (
                            <div
                              key={index}
                              className="relative aspect-video rounded-lg overflow-hidden"
                            >
                              <Image
                                src={
                                  image.url.startsWith("http")
                                    ? image.url
                                    : `${process.env.NEXT_PUBLIC_API_URL}${
                                        image.url.startsWith("/")
                                          ? image.url
                                          : `/${image.url}`
                                      }`
                                }
                                alt={
                                  image.caption || `Event image ${index + 1}`
                                }
                                fill
                                className="object-cover hover:scale-105 transition-transform duration-300"
                              />
                              {image.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm">
                                  {image.caption}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          {/* Right Column - Ticket Purchase (Desktop Only) */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6 shadow-md">
              <h2 className="text-2xl text-center font-bold mb-6 text-gray-900">
                Get Your Tickets
              </h2>
              <div className="space-y-6">
                <RadioGroup
                  value={selectedTicketType}
                  onValueChange={setSelectedTicketType}
                >
                  {ticketsToDisplay.map((ticketType) => (
                    <div
                      key={ticketType.name}
                      className="flex items-center justify-between space-x-2 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={ticketType.name}
                          id={ticketType.name}
                        />
                        <div>
                          <Label
                            htmlFor={ticketType.name}
                            className="font-medium text-gray-900"
                          >
                            {ticketType.name}
                          </Label>
                          {ticketType.description && (
                            <p className="text-xs text-gray-500">
                              {ticketType.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-[#0D47A1]">
                        {ticketType.price} ETB
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                {ticketsToDisplay.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    No tickets are currently available. Please check back later.
                  </div>
                )}
                {ticketsToDisplay.length > 0 && (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2 text-gray-700">
                        Number of tickets:
                      </h3>
                      <TicketCounter
                        value={ticketQuantity}
                        onChange={setTicketQuantity}
                        max={getSelectedTicketType()?.quantity || 10}
                      />
                      {isQuantityExceeded() && (
                        <p className="text-xs text-red-500 mt-1">
                          Not enough tickets available
                        </p>
                      )}
                    </div>
                    <Separator className="bg-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-lg text-gray-700">Total:</span>
                      <span className="text-2xl font-bold text-[#0D47A1]">
                        {calculateTotal()} ETB
                      </span>
                    </div>
                    {user?.role !== "admin" &&
                      user?.role !== "organizer" &&
                      user?.role !== "partner" && (
                        <Button
                          onClick={handleBuyClick}
                          disabled={isQuantityExceeded()}
                          className="w-full h-12 text-lg bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Buy Ticket
                        </Button>
                      )}
                    {false && shareQrDataUrl && <div />}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Mobile: Tabs */}
        <div className="block lg:hidden">
          <Tabs defaultValue="tickets" className="w-full">
            <TabsList className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 w-full justify-around rounded-none h-12 p-0 shadow-t">
              <TabsTrigger
                value="tickets"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-b-0 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs transition-colors"
              >
                <Ticket className="h-4 w-4 mb-0.5 data-[state=active]:text-[#0D47A1]" />
                <span className="text-xs">Tickets</span>
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-b-0 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs transition-colors"
              >
                <BookOpen className="h-4 w-4 mb-0.5 data-[state=active]:text-[#0D47A1]" />
                <span className="text-xs">About</span>
              </TabsTrigger>
              <TabsTrigger
                value="images"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-b-0 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs transition-colors"
              >
                <ImageIcon className="h-4 w-4 mb-0.5 data-[state=active]:text-[#0D47A1]" />
                <span className="text-xs">Images</span>
              </TabsTrigger>
            </TabsList>
            <div className="pb-16 md:pb-0 mt-0">
              <TabsContent value="tickets" className="mt-0">
                <div className="space-y-6">
                  {/* <h2 className="text-2xl font-bold text-gray-900 text-center">Get Your Tickets</h2> */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-md">
                    <div className="space-y-6">
                      <RadioGroup
                        value={selectedTicketType}
                        onValueChange={setSelectedTicketType}
                      >
                        {ticketsToDisplay.map((ticketType) => (
                          <div
                            key={ticketType.name}
                            className="flex items-center justify-between space-x-2 border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={ticketType.name}
                                id={ticketType.name}
                              />
                              <div>
                                <Label
                                  htmlFor={ticketType.name}
                                  className="font-medium text-gray-900"
                                >
                                  {ticketType.name}
                                </Label>
                                {ticketType.description && (
                                  <p className="text-xs text-gray-500">
                                    {ticketType.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="font-bold text-[#0D47A1]">
                              {ticketType.price} ETB
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                      {ticketsToDisplay.length === 0 && (
                        <div className="text-center py-6 text-gray-500">
                          No tickets are currently available. Please check back
                          later.
                        </div>
                      )}
                      {ticketsToDisplay.length > 0 && (
                        <>
                          <div>
                            <h3 className="text-sm font-medium mb-2 text-gray-700">
                              Number of tickets:
                            </h3>
                            <TicketCounter
                              value={ticketQuantity}
                              onChange={setTicketQuantity}
                              max={getSelectedTicketType()?.quantity || 10}
                            />
                            {isQuantityExceeded() && (
                              <p className="text-xs text-red-500 mt-1">
                                Not enough tickets available
                              </p>
                            )}
                          </div>
                          <Separator className="bg-gray-200" />
                          <div className="flex justify-between items-center">
                            <span className="text-lg text-gray-700">
                              Total:
                            </span>
                            <span className="text-2xl font-bold text-[#0D47A1]">
                              {calculateTotal()} ETB
                            </span>
                          </div>
                          {user?.role !== "admin" &&
                            user?.role !== "organizer" &&
                            user?.role !== "partner" && (
                              <Button
                                onClick={handleBuyClick}
                                disabled={isQuantityExceeded()}
                                className="w-full h-12 text-lg bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                Buy Ticket
                              </Button>
                            )}
                          {false && shareQrDataUrl && <div />}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="about" className="mt-0">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    About The Event
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="images" className="mt-0">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Event Images
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {event.coverImages.map((image, index) => (
                        <div
                          key={index}
                          className="relative aspect-video rounded-lg overflow-hidden"
                        >
                          <Image
                            src={
                              image.startsWith("http")
                                ? image
                                : `${process.env.NEXT_PUBLIC_API_URL}${
                                    image.startsWith("/") ? image : `/${image}`
                                  }`
                            }
                            alt={`Cover image ${index + 1}`}
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {event.eventImages && event.eventImages.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Event Gallery
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {event.eventImages.map((image, index) => (
                          <div
                            key={index}
                            className="relative aspect-video rounded-lg overflow-hidden"
                          >
                            <Image
                              src={
                                image.url.startsWith("http")
                                  ? image.url
                                  : `${process.env.NEXT_PUBLIC_API_URL}${
                                      image.url.startsWith("/")
                                        ? image.url
                                        : `/${image.url}`
                                    }`
                              }
                              alt={image.caption || `Event image ${index + 1}`}
                              fill
                              className="object-cover hover:scale-105 transition-transform duration-300"
                            />
                            {image.caption && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm">
                                {image.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
      <div className="hidden md:block"></div>
      {/* Ticket Modal */}
      <Dialog
        open={showTicketModal || shouldShowTicketModal}
        onOpenChange={(open) => {
          setShowTicketModal(open);
          if (!open) setShouldShowTicketModal(false);
        }}
      >
        <DialogContent className="w-full max-w-sm md:max-w-md lg:max-w-lg rounded-xl p-4 md:p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-lg md:text-xl">
              Your Ticket
              {purchasedTickets.length > 1
                ? `s (${currentTicketIndex + 1}/${purchasedTickets.length})`
                : ""}
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 text-xs md:text-sm">
              Show this QR code at the venue for check-in.
            </DialogDescription>
          </DialogHeader>

          {purchasedTickets.length > 0 && (
            <div className="mt-2">
              {(() => {
                const ticket = purchasedTickets[currentTicketIndex];
                return (
                  <div className="border border-gray-200 rounded-lg p-4 md:p-5 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
                    <div className="text-center mb-3">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">
                        Ticket #{currentTicketIndex + 1} - {ticket.ticketType}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-600">
                        Ticket ID: {ticket.ticketId}
                      </p>
                      <p className="text-xs md:text-sm text-gray-600">
                        Price: {ticket.price} ETB
                      </p>
                    </div>
                    <div className="flex justify-center mb-3">
                      <div className="bg-white p-3 md:p-4 rounded-lg shadow-md border border-gray-200 relative">
                        <Image
                          src={ticket.qrCode ?? "/events/sampleqr.png"}
                          alt={`QR Code for Ticket ${currentTicketIndex + 1}`}
                          width={140}
                          height={140}
                          className="mx-auto md:hidden"
                        />
                        <Image
                          src={ticket.qrCode ?? "/events/sampleqr.png"}
                          alt={`QR Code for Ticket ${currentTicketIndex + 1}`}
                          width={170}
                          height={170}
                          className="mx-auto hidden md:block"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] md:text-xs text-gray-500 mb-2">
                        Scan this QR code at the venue entrance
                      </p>
                      <Button
                        onClick={() =>
                          downloadQRCode(
                            ticket.qrCode,
                            ticket.ticketId,
                            ticket.ticketType
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
                  </div>
                );
              })()}

              {purchasedTickets.length > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentTicketIndex(Math.max(0, currentTicketIndex - 1))
                    }
                    disabled={currentTicketIndex === 0}
                  >
                    Prev
                  </Button>
                  <div className="flex items-center gap-1 md:gap-2">
                    {purchasedTickets.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${
                          i === currentTicketIndex
                            ? "bg-[#0D47A1]"
                            : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentTicketIndex(
                        Math.min(
                          purchasedTickets.length - 1,
                          currentTicketIndex + 1
                        )
                      )
                    }
                    disabled={
                      currentTicketIndex === purchasedTickets.length - 1
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 md:mt-5 p-3 bg-blue-50 rounded-lg border border-blue-200 text-[11px] md:text-xs text-blue-800">
            Keep this QR safe. You can access your tickets anytime from your
            account dashboard.
          </div>
          <div className="mt-3 md:mt-4 flex justify-end">
            <Button
              onClick={() => {
                setShowTicketModal(false);
                setShouldShowTicketModal(false);
              }}
              className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
              size="sm"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Modal Removed */}
      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md rounded-xl max-h-[90vh] overflow-y-auto top-4 translate-y-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Checkout
            </DialogTitle>
            <DialogDescription className="text-center">
              Complete your purchase securely
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMobilePayment} className="space-y-6 pt-2">
            {/* Order Summary */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Item</span>
                <span className="font-medium text-gray-900">
                  {selectedTicketType} Ticket
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Quantity</span>
                <span className="font-medium text-gray-900">
                  {ticketQuantity}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-[#0D47A1]">{calculateTotal()} ETB</span>
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-3">
              {!user && (
                <div>
                  <Label
                    htmlFor="santim_fullname"
                    className="text-xs font-semibold uppercase text-gray-500"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="santim_fullname"
                    value={santimForm.fullName}
                    onChange={(e) =>
                      setSantimForm({ ...santimForm, fullName: e.target.value })
                    }
                    placeholder="Enter your full name"
                    required
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {!user && (
                  <div>
                    <Label
                      htmlFor="santim_email"
                      className="text-xs font-semibold uppercase text-gray-500"
                    >
                      Email
                    </Label>
                    <Input
                      id="santim_email"
                      type="email"
                      value={santimForm.email}
                      onChange={(e) =>
                        setSantimForm({ ...santimForm, email: e.target.value })
                      }
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <Label
                    htmlFor="santim_phone"
                    className="text-xs font-semibold uppercase text-gray-500"
                  >
                    Phone
                  </Label>
                  <Input
                    id="santim_phone"
                    type="tel"
                    value={santimForm.phoneNumber}
                    onChange={(e) =>
                      setSantimForm({
                        ...santimForm,
                        phoneNumber: e.target.value,
                      })
                    }
                    placeholder="09..."
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                Payment Method
              </Label>
              <PaymentMethodSelector
                phoneNumber={santimForm.phoneNumber}
                selectedMethod={santimForm.paymentMethod}
                onSelect={(val) =>
                  setSantimForm({ ...santimForm, paymentMethod: val })
                }
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#28a745] hover:bg-[#218838] text-white"
                disabled={
                  isSantimLoading ||
                  !santimForm.phoneNumber ||
                  !santimForm.paymentMethod
                }
              >
                {isSantimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                  </>
                ) : (
                  `Pay ${calculateTotal()} ETB`
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Waiting for Payment Modal */}
      <Dialog open={isWaitingForPayment} onOpenChange={setIsWaitingForPayment}>
        <DialogContent className="max-w-sm rounded-xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold mb-2">
              Waiting for Payment
            </DialogTitle>
            <DialogDescription>
              Please check your phone and complete the payment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D47A1]"></div>
          </div>
          <p className="text-sm text-gray-500">
            We are waiting for confirmation from the payment provider...
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EventDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EventDetailContent />
    </Suspense>
  );
}
