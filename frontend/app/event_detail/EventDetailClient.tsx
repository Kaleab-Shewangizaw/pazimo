/* eslint-disable @typescript-eslint/no-unused-vars */
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
  Loader2,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
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
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import { downloadHighQualityQR } from "@/lib/downloadQR";
import { useWishlist } from "@/hooks/useWishlist";

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
  isSoldOut?: boolean;
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
  ticketCount?: number;
};

export default function EventDetailClient() {
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
  const [activePaymentProvider, setActivePaymentProvider] = useState<
    "SANTIM" | "CHAPA"
  >("CHAPA");
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [shareQrUrl, setShareQrUrl] = useState<string>("");
  const [santimForm, setSantimForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    paymentMethod: "telebirr",
  });
  const [isSantimLoading, setIsSantimLoading] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<
    string | null
  >(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/config/payment/active`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.activeProvider) {
            setActivePaymentProvider(data.data.activeProvider);
          }
        }
      } catch {}
    };
    fetchProvider();
  }, []);

  useEffect(() => {
    setSantimForm((prev) => ({
      ...prev,
      paymentMethod:
        activePaymentProvider === "CHAPA" ? "telebirr" : "Telebirr",
    }));
  }, [activePaymentProvider]);

  useEffect(() => {
    if (eventId) fetchEventDetails();
  }, [eventId]);

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
  }, [searchParams, event]);

  useEffect(() => {
    if (!eventId) return;
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
      } catch {}
    })();
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
      } catch {}
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
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEvent(data.data);
      const firstAvailableTicket = data.data.ticketTypes.find(
        (ticket: TicketType) => ticket.available !== false
      );
      if (firstAvailableTicket)
        setSelectedTicketType(firstAvailableTicket.name);
    } catch {
      toast.error("Failed to fetch event details");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadQRCode = (
    qrCodeDataUrl: string,
    ticketId: string,
    ticketType: string
  ) => {
    downloadHighQualityQR(
      qrCodeDataUrl,
      `ticket-${ticketId}-${ticketType}.png`
    );
    toast.success(`QR code for ${ticketType} downloaded!`);
  };

  const handleBuyClick = async () => {
    if (!selectedTicketType || ticketQuantity < 1) {
      toast.error("Please select ticket type and quantity");
      return;
    }

    const selectedType = ticketsToDisplay.find(
      (t) => t.name === selectedTicketType
    );
    if (!selectedType) return;

    localStorage.setItem("current_event_id", eventId || "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user || (useAuthStore.getState().user as any);
    if (u) {
      let phone = u.phone || u.phoneNumber || "";
      phone = phone.replace(/\D/g, "");
      if (phone.startsWith("251")) phone = phone.substring(3);
      if (phone.startsWith("0")) phone = phone.substring(1);

      setSantimForm({
        fullName: `${u.firstName} ${u.lastName || ""}`.trim(),
        email: u.email || "",
        phoneNumber: phone,
        paymentMethod:
          activePaymentProvider === "CHAPA" ? "telebirr" : "Telebirr",
      });
    } else {
      setSantimForm({
        fullName: "",
        email: "",
        phoneNumber: "",
        paymentMethod:
          activePaymentProvider === "CHAPA" ? "telebirr" : "Telebirr",
      });
    }

    setShowPaymentModal(true);
  };

  const verifyAndShowTickets = async (txRef: string) => {
    try {
      const ticketsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/public/details/${txRef}`
      );
      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json();
        const newTickets = ticketsData.data || [];
        setPurchasedTickets(newTickets);
        setShowTicketModal(true);
        setShouldShowTicketModal(true);
        router.replace(`/event_detail?id=${eventId || ""}`);
      }
    } catch {
      toast.error("Failed to load tickets");
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setIsWaitingForPayment(false);
  };

  const handleCancelPayment = async () => {
    stopPolling();
    if (currentTransactionId) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/payment/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: currentTransactionId }),
          }
        );
        toast.info("Payment cancelled");
      } catch {}
      setCurrentTransactionId(null);
    }
  };

  const pollPaymentStatus = async (txRef: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    let attempts = 0;
    const maxAttempts = 60;

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?txn=${txRef}`
        );
        const data = await response.json();

        if (data.status === "COMPLETED" || data.status === "PAID") {
          stopPolling();
          setShowPaymentModal(false);
          verifyAndShowTickets(txRef);
        } else if (data.status === "FAILED") {
          stopPolling();
          toast.error("Payment failed");
        }

        if (attempts >= maxAttempts) {
          stopPolling();
          toast.error("Payment verification timed out");
        }
      } catch {}
    }, 2000);
  };

  const handleMobilePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSantimLoading) return;

    // Require other fields but treat email as optional (defaults to customerpazimo@gmail.com)
    if (!santimForm.fullName || !santimForm.phoneNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Default email if not provided
    const finalEmail = santimForm.email || "customerpazimo@gmail.com";

    setIsSantimLoading(true);

    try {
      const selectedType = ticketsToDisplay.find(
        (t) => t.name === selectedTicketType
      );
      if (!selectedType) throw new Error("Ticket type not found");

      const formattedPhone =
        activePaymentProvider === "CHAPA"
          ? `0${santimForm.phoneNumber}`
          : `+251${santimForm.phoneNumber}`;

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
                email: finalEmail,
                phoneNumber: formattedPhone,
              }),
            }
          );

          if (authResponse.ok) {
            const authResult = await authResponse.json();
            const { user: userData, token } = authResult.data;

            // Only auto-login if not using the default email
            if (userData.email !== "customerpazimo@gmail.com") {
              useAuthStore.getState().setAuth({ user: userData, token });
              setUser(userData);
              setUserId(userData._id);
              toast.success("Account created/verified!");
            }
            finalUserId = userData._id;
          } else {
            const errorData = await authResponse.json();
            toast.error(errorData.message || "Authentication failed");
            setIsSantimLoading(false);
            return;
          }
        } catch {}
      }

      const amount = selectedType.price * ticketQuantity;
      const orderId =
        crypto.randomUUID?.() ||
        `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ticketId =
        crypto.randomUUID?.() ||
        `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const endpoint =
        activePaymentProvider === "CHAPA"
          ? "/api/tickets/ticket/initiate/chapa"
          : "/api/tickets/ticket/initiate";

      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentReason: `Ticket Purchase - ${event?.title}`,
          phoneNumber: formattedPhone,
          orderId,
          method: santimForm.paymentMethod,
          ticketDetails: {
            ticketId,
            eventId,
            ticketTypeId: selectedType._id || selectedType.name,
            quantity: ticketQuantity,
            userId: finalUserId,
            fullName: santimForm.fullName,
            email: finalEmail,
          },
          successUrl: `${window.location.origin}/my-account/tickets/${ticketId}`,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Payment initiation failed");

      if (data.token && data.user) {
        // Do not auto-login if using the default placeholder email
        if (data.user.email !== "customerpazimo@gmail.com") {
          useAuthStore
            .getState()
            .setAuth({ user: data.user, token: data.token });
          setUser(data.user);
          setUserId(data.user._id);
          toast.success("Account created/verified!");
        }
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.transactionId) {
        setIsSantimLoading(false);
        setIsWaitingForPayment(true);
        setCurrentTransactionId(data.transactionId);
        toast.success("Payment initiated! Please check your phone.");
        pollPaymentStatus(data.transactionId);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setIsSantimLoading(false);
    }
  };

  useEffect(() => {
    const txRef = searchParams.get("tx_ref") || searchParams.get("orderId");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");

    if ((txRef && status) || (paymentStatus === "success" && txRef)) {
      const processPayment = async () => {
        if (status === "success" || paymentStatus === "success") {
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
            toast.error("Payment verification timed out");
          }
        } else {
          toast.error("Payment was not successful");
          router.replace(`/event_detail?id=${eventId || ""}`);
        }
      };
      processPayment();
    }
  }, [searchParams, router, eventId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D47A1]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[#0D47A1]">Event not found</p>
      </div>
    );
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTimeWithAmPm = (time24?: string) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute < 10 ? "0" + minute : minute} ${ampm}`;
  };

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    const start = formatTimeWithAmPm(startTime);
    const end = formatTimeWithAmPm(endTime);
    if (!start && !end) return "Time TBA";
    if (!start) return end;
    if (!end) return start;
    return `${start} - ${end}`;
  };

  const isEventSoldOut = () => {
    if (event.isSoldOut) return true;
    if (event.status && event.status !== "published") return true;

    const now = new Date();
    const endDate = event.endDate ? new Date(event.endDate) : null;
    if (endDate) {
      // Set end time if available
      if (event.endTime) {
        const [h, m] = event.endTime.split(":").map(Number);
        endDate.setHours(h || 23, m || 59, 0, 0);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
      if (endDate.getTime() <= now.getTime()) return true;
    }

    const hasAvailableTickets = event.ticketTypes.some(
      (t) => t.available !== false && t.quantity > 0
    );
    return !hasAvailableTickets;
  };

  const ticketsToDisplay = event.ticketTypes.filter(
    (ticket) => ticket.available !== false
  );

  const calculateTotal = () => {
    const selectedType = ticketsToDisplay.find(
      (t) => t.name === selectedTicketType
    );
    return selectedType ? selectedType.price * ticketQuantity : 0;
  };

  const getSelectedTicketType = () =>
    ticketsToDisplay.find((t) => t.name === selectedTicketType);

  const isQuantityExceeded = () => {
    const selectedType = getSelectedTicketType();
    return selectedType ? ticketQuantity > selectedType.quantity : false;
  };

  const getDayName = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { weekday: "short" });

  const getDayNumber = (dateString: string) =>
    new Date(dateString).getDate().toString().padStart(2, "0");

  const getMonthName = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { month: "short" });

  const getCoverImageUrl = () => {
    if (!event.coverImages?.[0]) return "/events/eventimg.png";
    const img = event.coverImages[0];
    return img.startsWith("http")
      ? img
      : `${process.env.NEXT_PUBLIC_API_URL}${
          img.startsWith("/") ? img : `/${img}`
        }`;
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="relative w-full overflow-hidden">
        <div className="block md:hidden px-8 py-4">
          <div className="relative w-full max-w-md mx-auto">
            <Image
              src={getCoverImageUrl()}
              alt={`${event.title} - Event cover`}
              width={600}
              height={300}
              className="w-full h-auto object-cover rounded-lg shadow-md"
              priority
            />
          </div>
        </div>

        <div className="hidden md:block relative mx-4 mt-4 mb-8">
          <div className="relative h-[60vh] lg:h-[70vh] w-full rounded-2xl overflow-hidden shadow-lg">
            <Image
              src={getCoverImageUrl()}
              alt={`${event.title} - Event banner`}
              fill
              className="object-contain bg-black"
              priority
              sizes="100vw"
              quality={90}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0D47A1]/30 via-[#0D47A1]/60 to-[#0D47A1] rounded-2xl" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16 z-10">
              <Badge className="w-fit mb-4 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white text-sm px-3 py-1">
                {event.category?.name || "Uncategorized"}
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-white leading-tight">
                {event.title}
              </h1>
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

      <div className="block md:hidden px-4 py-4 bg-white">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight flex-1">
            {event.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="text-gray-700 border-gray-300 bg-transparent hover:bg-gray-50"
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
                toast.success("Link copied!");
              }
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-4 items-start">
          <div className="shrink-0 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm min-w-[70px]">
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

          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-2 text-gray-700">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <div>
                <div className="text-sm font-medium text-blue-600">
                  {event.location.address}
                </div>
                <div className="text-xs text-gray-500">
                  {event.location.city}, {event.location.country}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4 flex-shrink-0 text-gray-600" />
              <span className="text-sm">
                {formatDate(event.startDate)}
                {event.endDate &&
                  event.endDate !== event.startDate &&
                  ` - ${formatDate(event.endDate)}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="h-4 w-4 flex-shrink-0 text-gray-600" />
              <span className="text-sm">
                {formatTimeRange(event.startTime, event.endTime)}
              </span>
            </div>
            {event.organizer?.name && (
              <div className="text-xs text-gray-500">
                by {event.organizer.name}
              </div>
            )}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8 hidden lg:block">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="hidden md:flex bg-white border-b border-gray-200 w-full justify-start rounded-none h-14 p-0">
                <TabsTrigger
                  value="about"
                  className="rounded-none text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] h-14 px-6"
                >
                  About
                </TabsTrigger>
                <TabsTrigger
                  value="images"
                  className="rounded-none text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] h-14 px-6"
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
                    {event.eventImages?.length > 0 && (
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

          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6 shadow-md">
              <h2 className="text-2xl text-center font-bold mb-6 text-gray-900">
                Get Your Tickets
              </h2>
              <div className="space-y-6">
                {isEventSoldOut() ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-red-500 font-bold text-lg mb-2">
                      Tickets Not Available
                    </p>
                    <p className="text-gray-500 text-sm">
                      This event is sold out or has ended.
                    </p>
                  </div>
                ) : (
                  <>
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
                        No tickets are currently available.
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
                              className="w-full h-12 text-lg bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white disabled:bg-gray-400"
                            >
                              Buy Ticket
                            </Button>
                          )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="block lg:hidden">
          <Tabs defaultValue="tickets" className="w-full">
            <TabsList className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 w-full justify-around rounded-none h-12 p-0 shadow-t">
              <TabsTrigger
                value="tickets"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs"
              >
                <Ticket className="h-4 w-4 mb-0.5" />
                <span className="text-xs">Tickets</span>
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs"
              >
                <BookOpen className="h-4 w-4 mb-0.5" />
                <span className="text-xs">About</span>
              </TabsTrigger>
              <TabsTrigger
                value="images"
                className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] data-[state=active]:bg-blue-50 h-12 px-0 text-xs"
              >
                <ImageIcon className="h-4 w-4 mb-0.5" />
                <span className="text-xs">Images</span>
              </TabsTrigger>
            </TabsList>
            <div className="pb-16 md:pb-0 mt-0">
              <TabsContent value="tickets" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-md">
                    <div className="space-y-6">
                      {isEventSoldOut() ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-red-500 font-bold text-lg mb-2">
                            Tickets Not Available
                          </p>
                          <p className="text-gray-500 text-sm">
                            This event is sold out or has ended.
                          </p>
                        </div>
                      ) : (
                        <>
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
                              No tickets are currently available.
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
                                    className="w-full h-12 text-lg bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white disabled:bg-gray-400"
                                  >
                                    Buy Ticket
                                  </Button>
                                )}
                            </>
                          )}
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
                  {event.eventImages?.length > 0 && (
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

      <Dialog
        open={showTicketModal || shouldShowTicketModal}
        onOpenChange={(open) => {
          setShowTicketModal(open);
          if (!open) setShouldShowTicketModal(false);
        }}
      >
        <DialogContent className="w-full max-w-sm md:max-w-md lg:max-w-lg rounded-xl p-0 overflow-hidden bg-white gap-0">
          <div className="bg-[#0D47A1] p-6 text-white text-center">
            <h2 className="text-2xl font-bold mb-1">You&apos;re Going!</h2>
            <p className="text-blue-100 text-sm">Your ticket is ready</p>
          </div>
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {event.title}
              </h3>
              <div className="flex flex-col gap-1 items-center text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0D47A1]" />
                  <span>{formatDate(event.startDate)}</span>
                  <span className="text-gray-300">|</span>
                  <Clock className="h-4 w-4 text-[#0D47A1]" />
                  <span>{formatTimeWithAmPm(event.startTime)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-[#0D47A1]" />
                  <span>{event.location.address}</span>
                </div>
              </div>
            </div>
            <Separator className="my-6" />
            {purchasedTickets.length > 0 && (
              <div className="space-y-6">
                {(() => {
                  const ticket = purchasedTickets[currentTicketIndex];
                  return (
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-3 rounded-xl border-2 border-dashed border-gray-300 mb-5 shadow-sm">
                        <Image
                          src={ticket.qrCode ?? "/events/sampleqr.png"}
                          alt="Ticket QR"
                          width={220}
                          height={220}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="text-center space-y-2 w-full">
                        <div className="flex justify-center">
                          <Badge
                            variant="secondary"
                            className="text-base px-6 py-1.5 bg-blue-50 text-[#0D47A1]"
                          >
                            Admits: {ticket.ticketCount || 1} Person
                            {(ticket.ticketCount || 1) > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-lg text-gray-900 mt-2">
                          {ticket.ticketType}
                        </h4>
                        <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                          ID: {ticket.ticketId}
                        </p>
                      </div>
                    </div>
                  );
                })()}
                {purchasedTickets.length > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() =>
                        setCurrentTicketIndex(
                          Math.max(0, currentTicketIndex - 1)
                        )
                      }
                      disabled={currentTicketIndex === 0}
                    >
                      &lt;
                    </Button>
                    <div className="flex gap-1.5">
                      {purchasedTickets.map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            i === currentTicketIndex
                              ? "bg-[#0D47A1]"
                              : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
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
                      &gt;
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-gray-50 border-t flex gap-3">
            <Button
              className="flex-1 bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              variant="outline"
              onClick={() => {
                const ticket = purchasedTickets[currentTicketIndex];
                downloadQRCode(
                  ticket.qrCode,
                  ticket.ticketId,
                  ticket.ticketType
                );
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Save Image
            </Button>
            <Button
              className="flex-1 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white shadow-md"
              onClick={() => {
                setShowTicketModal(false);
                setShouldShowTicketModal(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                {(!user || !user.email) && (
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
                      placeholder="Email address"
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
                  <div className="flex items-center border rounded-md overflow-hidden mt-1 focus-within:ring-2 focus-within:ring-blue-500">
                    <div className="bg-gray-100 px-3 py-2 text-gray-500 border-r text-sm font-medium">
                      +251
                    </div>
                    <Input
                      id="santim_phone"
                      type="tel"
                      maxLength={9}
                      value={santimForm.phoneNumber}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "");
                        if (val.startsWith("0")) val = val.substring(1);
                        if (val.startsWith("251")) val = val.substring(3);
                        setSantimForm({ ...santimForm, phoneNumber: val });
                      }}
                      placeholder="9..."
                      required
                      className="border-0 rounded-none focus-visible:ring-0 shadow-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <PaymentMethodSelector
                phoneNumber={santimForm.phoneNumber}
                selectedMethod={santimForm.paymentMethod}
                onSelect={(val) =>
                  setSantimForm({ ...santimForm, paymentMethod: val })
                }
                provider={activePaymentProvider}
              />
            </div>
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  isSantimLoading ||
                  !santimForm.phoneNumber ||
                  !santimForm.paymentMethod ||
                  santimForm.phoneNumber.length < 9
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

      <Dialog
        open={isWaitingForPayment}
        onOpenChange={(open) => !open && handleCancelPayment()}
      >
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D47A1]" />
          </div>
          <p className="text-sm text-gray-500 mb-4">
            We are waiting for confirmation...
          </p>
          <Button
            variant="outline"
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
            onClick={handleCancelPayment}
          >
            Cancel Payment
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
