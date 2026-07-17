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
  Loader2,
  ImageIcon,
  BookOpen,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventHero from "@/components/event-detail/EventHero";
import AboutSection from "@/components/event-detail/AboutSection";
import GallerySection from "@/components/event-detail/GallerySection";
import TicketPanel from "@/components/event-detail/TicketPanel";
import { type TicketType } from "@/components/event-detail/types";

// Countries list for USD payment - with flags
const COUNTRIES_FOR_PAYMENT = [
  { code: "US", name: "United States", flag: "🇺🇸", prefix: "1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", prefix: "1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", prefix: "44" },
  { code: "AU", name: "Australia", flag: "🇦🇺", prefix: "61" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", prefix: "27" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", prefix: "251" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", prefix: "254" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", prefix: "256" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", prefix: "234" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", prefix: "233" },
];
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { useWishlist } from "@/hooks/useWishlist";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import { downloadHighQualityQR } from "@/lib/downloadQR";
import {
  buildCanonicalEventUrl,
  extractShortIdFromEventSlug,
} from "@/lib/event-url";

type Event = {
  _id: string;
  slug?: string;
  shortId?: string;
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

// Simple in-memory cache for event data
const eventCache = new Map<string, { data: Event; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function EventDetailClient() {
  const params = useParams<{ eventSlug?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventSlug = Array.isArray(params?.eventSlug)
    ? params.eventSlug[0]
    : params?.eventSlug;
  const shortIdFromSlug = extractShortIdFromEventSlug(eventSlug);
  const legacyEventId = searchParams.get("id") || searchParams.get("amp;id");
  const eventLookupId = shortIdFromSlug || legacyEventId;
  const eventId = eventLookupId;
  const currentEventPath = eventSlug
    ? `/events/${eventSlug}`
    : legacyEventId
      ? `/event_detail?id=${legacyEventId}`
      : "/event_explore";

  const getSearchParamValue = useCallback(
    (...keys: string[]) => {
      for (const key of keys) {
        const directValue = searchParams.get(key);
        if (directValue) return directValue;

        const ampKey = `amp;${key}`;
        const ampValue = searchParams.get(ampKey);
        if (ampValue) return ampValue;
      }
      return null;
    },
    [searchParams],
  );

  // Get user from store directly
  const { user } = useAuthStore();

  // Core state - reduced from 19+ to 9 state variables
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicketType, setSelectedTicketType] = useState<string>("");
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentProvider, setActivePaymentProvider] = useState<"SANTIM" | "CHAPA">("CHAPA");
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [paymentForm, setPaymentForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    paymentMethod: "telebirr",
    countryCode: "US", // For USD payments
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [currentTxRef, setCurrentTxRef] = useState<string | null>(null);
  const [waitingTicketId, setWaitingTicketId] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETB" | "USD">("ETB");

  const { toggleWishlist, isInWishlist, isLoading: isWishlistLoading } =
    useWishlist();

  const eventUrl = useMemo(() => {
    if (event?.slug && event?.shortId) {
      return buildCanonicalEventUrl(event.slug, event.shortId);
    }
    return currentEventPath;
  }, [currentEventPath, event?.shortId, event?.slug]);

  // Memoized computed values - prevent unnecessary re-renders
  const ticketsToDisplay = useMemo(() => {
    if (!event?.ticketTypes) return [];

    // Filter tickets based on selected currency availability
    return event.ticketTypes.filter((ticket: any) => {
      const isAvailable = ticket.available !== false;
      const hasPriceInCurrency = selectedCurrency === "USD"
        ? (ticket.priceUSD && ticket.priceUSD > 0)
        : (ticket.priceETB && ticket.priceETB > 0);

      return isAvailable && hasPriceInCurrency;
    });
  }, [event, selectedCurrency]);

  const selectedTicket = useMemo(() =>
    ticketsToDisplay.find((t: any) => t.name === selectedTicketType),
    [ticketsToDisplay, selectedTicketType]
  );

  // Get ticket price based on selected currency
  const ticketPrice = useMemo(() => {
    if (!selectedTicket) return 0;
    const ticket = selectedTicket as any;
    return selectedCurrency === "USD"
      ? (ticket.priceUSD || 0)
      : (ticket.priceETB || ticket.price || 0);
  }, [selectedTicket, selectedCurrency]);

  // Determine available currencies from all tickets
  const availableCurrencies = useMemo(() => {
    const hasETB = event?.ticketTypes.some((t: any) => (t.priceETB || t.price || 0) > 0) || false;
    const hasUSD = event?.ticketTypes.some((t: any) => (t.priceUSD || 0) > 0) || false;
    return { hasETB, hasUSD };
  }, [event]);

  // Set default currency based on availability
  useEffect(() => {
    if (!availableCurrencies.hasETB && availableCurrencies.hasUSD) {
      setSelectedCurrency("USD");
    } else {
      setSelectedCurrency("ETB");
    }
  }, [availableCurrencies]);

  const verificationAttempts = useRef(0);
  const isVerifyingPayment = useRef(false);
  const cancelPaymentRef = useRef(false);

  // Fetch event details with caching
  const fetchEventDetails = useCallback(async () => {
    if (!eventLookupId) return;

    // Check cache first
    const cached = eventCache.get(eventLookupId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setEvent(cached.data);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        shortIdFromSlug
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/events/short/${shortIdFromSlug}`
          : `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${legacyEventId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();

      // Cache the event data
      eventCache.set(eventLookupId, { data: data.data, timestamp: Date.now() });
      setEvent(data.data);

      const canonicalUrl =
        data.data?.slug && data.data?.shortId
          ? buildCanonicalEventUrl(data.data.slug, data.data.shortId)
          : currentEventPath;
      if (canonicalUrl !== currentEventPath) {
        router.replace(canonicalUrl);
      }

      // Set first available ticket as default
      const firstAvailableTicket = data.data.ticketTypes.find(
        (ticket: TicketType) => ticket.available !== false,
      );
      if (firstAvailableTicket && !selectedTicketType) {
        setSelectedTicketType(firstAvailableTicket.name);
      }
    } catch {
      toast.error("Failed to fetch event details");
    } finally {
      setIsLoading(false);
    }
  }, [currentEventPath, eventId, eventLookupId, legacyEventId, router, shortIdFromSlug, selectedTicketType]);

  // Verify and show tickets with retry logic - OPTIMIZED & GUARANTEED delivery
  const verifyAndShowTickets = useCallback(async (txRef: string, retryCount = 0, canceledRef?: React.MutableRefObject<boolean>) => {
    const MAX_RETRIES = 20; // Increased retries but with faster polling
    // Adaptive retry delays: Start fast, then slow down
    const getRetryDelay = (attempt: number) => {
      if (attempt < 3) return 500;  // First 3 attempts: 0.5s (1.5s total)
      if (attempt < 6) return 1000; // Next 3 attempts: 1s (3s total) 
      if (attempt < 10) return 1500; // Next 4 attempts: 1.5s (6s total)
      return 2000; // Remaining: 2s
    };

    try {
      // Check if user canceled
      if (canceledRef?.current) {
        console.log(`[VERIFY] User canceled payment verification`);
        setIsProcessingPayment(false);
        return false;
      }

      console.log(`[VERIFY] Attempt ${retryCount + 1}/${MAX_RETRIES} for txRef: ${txRef}`);

      // STEP 1: Verify payment status with backend (triggers ticket creation if not already done)
      const statusResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status?txn=${txRef}`,
      );

      if (!statusResponse.ok) {
        throw new Error(`Payment status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log(`[VERIFY] Status response:`, statusData);
      console.log(`[VERIFY] status field value: "${statusData.status}" (type: ${typeof statusData.status})`);
      console.log(`[VERIFY] newUserCredentials present:`, !!statusData.newUserCredentials);

      // ⚡ CRITICAL FIX: Handle CANCELLED and FAILED immediately
      if (statusData.status === "CANCELLED" || statusData.status === "CANCELED") {
        setIsProcessingPayment(false);
        toast.error("Payment was cancelled. Please try again if you wish to purchase tickets.");
        router.replace(eventUrl);
        return false;
      }

      if (statusData.status === "FAILED") {
        setIsProcessingPayment(false);
        toast.error("Payment failed. Please check your payment method and try again.");
        router.replace(eventUrl);
        return false;
      }

      if (statusData.status === "NOT_FOUND") {
        setIsProcessingPayment(false);
        toast.error("Payment not found. Please try again.");
        router.replace(eventUrl);
        return false;
      }

      // Handle pending status with adaptive retry
      if (statusData.status === "PENDING") {
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          console.log(`[VERIFY] Payment still pending (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return verifyAndShowTickets(txRef, retryCount + 1, canceledRef);
        }
        // Timeout - payment might still be processing on user's phone
        setIsProcessingPayment(false);
        toast.error("Payment verification timeout. If you completed payment, check 'My Tickets' in a few minutes.");
        router.replace(eventUrl);
        return false;
      }

      // STEP 2: Payment is COMPLETED, fetch the created tickets
      if (statusData.status === "COMPLETED") {
        console.log(`[VERIFY] Payment completed! Fetching tickets...`);

        if (statusData.ticketId) {
          setWaitingTicketId(statusData.ticketId);
          const directTicketResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/public/details/${statusData.ticketId}`,
          );

          if (directTicketResponse.ok) {
            const directTicketData = await directTicketResponse.json();
            const directTickets = directTicketData.data || [];
            if (directTickets.length > 0) {
              setPurchasedTickets(directTickets);
              setIsProcessingPayment(false);
              setShowTicketModal(true);
              router.replace(eventUrl);
              toast.success("Payment confirmed! Your ticket is ready.");
              return true;
            }
          }
        }

        // 🔐 AUTO-LOGIN: If backend returns credentials AND user not logged in, log them in
        if (statusData.newUserCredentials) {
          console.log(`[AUTO-LOGIN] Received credentials:`, {
            email: statusData.newUserCredentials.email,
            hasPassword: !!statusData.newUserCredentials.password
          });
          const { useAuthStore } = await import("@/store/authStore");
          const currentUser = useAuthStore.getState().user;

          // Only login if not already logged in
          if (!currentUser?.id && !currentUser?._id) {
            console.log(`[AUTO-LOGIN] User not logged in, attempting auto-login...`);
            try {
              const loginResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/auth/unified-auth`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fullName: "Customer",
                    email: statusData.newUserCredentials.email,
                    phoneNumber: statusData.newUserCredentials.password,
                  }),
                }
              );

              if (loginResponse.ok) {
                const authData = await loginResponse.json();
                if (authData.status === "success" && authData.data) {
                  // Save auth using Zustand store
                  useAuthStore.getState().setAuth({
                    user: authData.data.user,
                    token: authData.data.token,
                  });
                  console.log(`[AUTO-LOGIN] ✅ Logged in as ${authData.data.user.email}`);
                  toast.success("Welcome! You're now logged in.");
                }
              } else {
                console.error(`[AUTO-LOGIN] ❌ Login failed:`, loginResponse.status);
              }
            } catch (loginError) {
              console.error(`[AUTO-LOGIN] ❌ Error during auto-login:`, loginError);
            }
          } else {
            console.log(`[AUTO-LOGIN] User already logged in, skipping.`);
          }
        }

        const ticketsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/public/details/${txRef}`,
        );

        if (ticketsResponse.ok) {
          const ticketsData = await ticketsResponse.json();
          const newTickets = ticketsData.data || [];

          if (newTickets.length > 0) {
            console.log(`[VERIFY] ✅ Success! Received ${newTickets.length} ticket(s)`);
            // if we haven't set waitingTicketId yet, use first ticket
            if (!waitingTicketId && newTickets[0]?.ticketId) {
              setWaitingTicketId(newTickets[0].ticketId);
            }
            setPurchasedTickets(newTickets);
            setIsProcessingPayment(false);
            setShowTicketModal(true);
            router.replace(eventUrl);
            toast.success(`🎉 ${newTickets.length} ticket(s) received successfully!`);
            return true;
          }

          // Tickets not created yet - this can happen if ticket creation is slow
          if (retryCount < MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            console.log(`[VERIFY] No tickets returned, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return verifyAndShowTickets(txRef, retryCount + 1, canceledRef);
          }
        }
      }

      // Shouldn't reach here, but fallback
      throw new Error("Unexpected response from backend");

    } catch (error) {
      console.error(`[VERIFY] Error on attempt ${retryCount + 1}:`, error);

      // Retry on errors (network issues, timeouts, etc)
      if (retryCount < MAX_RETRIES) {
        const delay = getRetryDelay(retryCount);
        console.log(`[VERIFY] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return verifyAndShowTickets(txRef, retryCount + 1, canceledRef);
      }

      // Max retries exceeded
      console.error("[VERIFY] ❌ Failed after all retries");
      setIsProcessingPayment(false);
      toast.error(`Failed to load tickets. Please check 'My Tickets' or contact support with reference: ${txRef}`);
      router.replace(eventUrl);
      return false;
    }
  }, [currentEventPath, eventLookupId, legacyEventId, router, shortIdFromSlug, waitingTicketId]);

  // Handle payment initiation - streamlined and optimized
  const handleMobilePayment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingPayment) return;

    // Validate required fields
    if (!paymentForm.fullName || !paymentForm.phoneNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    const selectedType = ticketsToDisplay.find((t) => t.name === selectedTicketType);
    if (!selectedType) {
      toast.error("Please select a ticket type");
      return;
    }

    setIsProcessingPayment(true);
    setWaitingTicketId(null);

    try {
      // Use provided email or generate placeholder email
      const finalEmail = paymentForm.email || user?.email ||
        `customerpazimo${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}@gmail.com`;

      // Build formatted phone number:
      // - USD (international card): use the selected country prefix from the dropdown
      // - ETB + CHAPA: Ethiopian local format (0xx...)
      // - ETB + SANTIM: Ethiopian international format (+251xx...)
      let formattedPhone: string;
      if (selectedCurrency === "USD") {
        const prefix = COUNTRIES_FOR_PAYMENT.find(
          (c) => c.code === paymentForm.countryCode
        )?.prefix || "1";
        formattedPhone = `+${prefix}${paymentForm.phoneNumber}`;
      } else if (activePaymentProvider === "CHAPA") {
        formattedPhone = `0${paymentForm.phoneNumber}`;
      } else {
        formattedPhone = `+251${paymentForm.phoneNumber}`;
      }

      // Backend will handle user creation during payment initiation
      const finalUserId = user?._id;

      console.log("[PAYMENT-INIT] ============================================");
      console.log("[PAYMENT-INIT] User logged in:", !!user);
      console.log("[PAYMENT-INIT] User ID:", finalUserId);
      console.log("[PAYMENT-INIT] User email:", user?.email);
      console.log("[PAYMENT-INIT] Payment email:", finalEmail);
      console.log("[PAYMENT-INIT] Payment phone:", formattedPhone);
      console.log("[PAYMENT-INIT] Selected currency:", selectedCurrency);
      console.log("[PAYMENT-INIT] ============================================");

      // Calculate amount based on selected currency
      const selectedTypeAny = selectedType as any;
      const amount = selectedCurrency === "USD"
        ? (selectedTypeAny.priceUSD || selectedType.price) * ticketQuantity
        : (selectedTypeAny.priceETB || selectedType.price) * ticketQuantity;

      // Force CHAPA provider for USD payments (international cards)
      const effectiveProvider = selectedCurrency === "USD" ? "CHAPA" : activePaymentProvider;

      const orderId = crypto.randomUUID?.() ||
        `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ticketId = crypto.randomUUID?.() ||
        `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const endpoint = effectiveProvider === "CHAPA"
        ? "/api/tickets/ticket/initiate/chapa"
        : "/api/tickets/ticket/initiate";

      const requestBody = {
        amount,
        currency: selectedCurrency, // Pass currency to backend
        paymentReason: `Ticket Purchase - ${event?.title}`,
        phoneNumber: formattedPhone,
        orderId,
        method: paymentForm.paymentMethod,
        ticketDetails: {
          ticketId,
          eventId,
          ticketTypeId: selectedType._id || selectedType.name,
          quantity: ticketQuantity,
          userId: finalUserId,
          fullName: paymentForm.fullName,
          email: finalEmail,
        },
        successUrl: `${process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin}${eventUrl}?payment_status=success&tx_ref=${orderId}`,
        callbackUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/payments/callback`,
      };

      console.log("[PAYMENT-INIT] Sending payment request:", {
        endpoint,
        currency: selectedCurrency,
        method: paymentForm.paymentMethod,
        provider: effectiveProvider,
        amount,
      });

      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.code === "PHONE_BANNED") {
          throw new Error(
            "This phone number has been blocked from making purchases on Pazimo. Contact support if you believe this is a mistake."
          );
        }
        // Backend error responses use `error`, not `message` — fall back to
        // both so the real reason (e.g. amount/availability issues) reaches the user.
        throw new Error(data.error || data.message || "Payment initiation failed");
      }

      // Handle auto-login from payment response for guest users (new or existing)
      if (data.token && data.user && !user) {
        useAuthStore.getState().setAuth({ user: data.user, token: data.token });
        // Check if this was a newly created account or existing account
        const isNewAccount = data.user.email?.includes("customerpazimo") ||
          !data.user.email ||
          data.message?.includes("created");
        toast.success(isNewAccount ? "Account created! You'll be logged in after payment." : "Welcome back! Logging you in...");
      }

      // Redirect to payment gateway if checkout URL provided
      if (data.checkoutUrl) {
        setShowPaymentModal(false);
        toast.success("Redirecting to payment...");
        window.location.href = data.checkoutUrl;
        return;
      }

      // For mobile money (non-Chapa), verify transaction
      if (data.transactionId) {
        setShowPaymentModal(false);
        toast.success("Payment initiated! Checking status...");

        // ⚡ Start polling immediately - verifyAndShowTickets has smart polling
        // It will handle CANCELLED/FAILED quickly and retry PENDING with adaptive delays
        await verifyAndShowTickets(data.transactionId);
      }

    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setIsProcessingPayment(false);
    }
  }, [
    isProcessingPayment,
    paymentForm,
    selectedTicketType,
    ticketQuantity,
    activePaymentProvider,
    user,
    event,
    eventId,
    verifyAndShowTickets,
  ]);

  // Initialize payment form when user logs in or opens modal
  const initializePaymentForm = useCallback(() => {
    // Set country code based on currency
    let countryCode = selectedCurrency === "USD" ? "US" : "ET";

    if (user) {
      let phone = user.phoneNumber || "";
      phone = phone.replace(/\D/g, "");
      if (phone.startsWith("251")) phone = phone.substring(3);
      if (phone.startsWith("0")) phone = phone.substring(1);

      // Set payment method based on currency and provider
      let defaultMethod = "telebirr";
      if (selectedCurrency === "USD") {
        defaultMethod = "visa"; // Default to Visa for USD card payment
      } else if (activePaymentProvider === "CHAPA") {
        defaultMethod = "telebirr";
      } else {
        defaultMethod = "Telebirr";
      }

      setPaymentForm({
        fullName: `${user.firstName} ${user.lastName || ""}`.trim(),
        email: user.email || "",
        phoneNumber: phone,
        paymentMethod: defaultMethod,
        countryCode: countryCode,
      });
    } else {
      // Set payment method based on currency and provider
      let defaultMethod = "telebirr";
      if (selectedCurrency === "USD") {
        defaultMethod = "visa"; // Default to Visa for USD card payment
      } else if (activePaymentProvider === "CHAPA") {
        defaultMethod = "telebirr";
      } else {
        defaultMethod = "Telebirr";
      }

      setPaymentForm({
        fullName: "",
        email: "",
        phoneNumber: "",
        paymentMethod: defaultMethod,
        countryCode: countryCode,
      });
    }
  }, [user, activePaymentProvider, selectedCurrency]);

  const handleBuyClick = useCallback(() => {
    if (!selectedTicketType || ticketQuantity < 1) {
      toast.error("Please select ticket type and quantity");
      return;
    }

    const selectedType = ticketsToDisplay.find((t) => t.name === selectedTicketType);
    if (!selectedType) return;

    localStorage.setItem("current_event_id", eventId || "");
    initializePaymentForm();
    setShowPaymentModal(true);
  }, [selectedTicketType, ticketQuantity, eventId, initializePaymentForm]);

  // Consolidated initialization effect
  useEffect(() => {
    // Fetch active payment provider
    const fetchProvider = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/config/payment/active`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.activeProvider) {
            setActivePaymentProvider(data.data.activeProvider);
          }
        }
      } catch { }
    };

    fetchProvider();

    // Fetch event details
    if (eventId) {
      fetchEventDetails();
    }

    // Handle URL parameters for pre-selection
    const qtyParam = searchParams.get("quantity");
    const typeParam = searchParams.get("ticketType");
    if (qtyParam) {
      const parsed = Number.parseInt(qtyParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        setTicketQuantity(parsed);
      }
    }
    if (typeParam && event?.ticketTypes?.some((t) => t.name === typeParam)) {
      setSelectedTicketType(typeParam);
    }
  }, [eventId, fetchEventDetails, searchParams, event]);

  // Handle payment return from gateway - OPTIMIZED for speed
  useEffect(() => {
    const txRef = getSearchParamValue("tx_ref", "orderId");
    const status = (getSearchParamValue("status") || "").toLowerCase();
    const paymentStatus = (getSearchParamValue("payment_status") || "").toLowerCase();

    if (!txRef) return;

    // Prevent multiple verification attempts
    if (isVerifyingPayment.current) return;
    isVerifyingPayment.current = true;

    const processPayment = async () => {
      // If gateway explicitly says cancelled/failed, show immediate feedback
      // and still rely on backend status endpoint for final source of truth.
      if (status === "cancelled" || status === "canceled" || paymentStatus === "cancelled") {
        console.log("[PAYMENT-RETURN] Payment marked cancelled by gateway:", { status, paymentStatus, txRef });
        toast.error("Payment was cancelled");
      } else if (status === "failed" || paymentStatus === "failed") {
        console.log("[PAYMENT-RETURN] Payment marked failed by gateway:", { status, paymentStatus, txRef });
        toast.error("Failed to issue ticket because payment was unsuccessful.");
      }

      setIsProcessingPayment(true);
      setCurrentTxRef(txRef);
      setWaitingTicketId(null);
      cancelPaymentRef.current = false;
      console.log("[PAYMENT-RETURN] Verifying payment status for txRef:", txRef);
      await verifyAndShowTickets(txRef, 0, cancelPaymentRef);

      isVerifyingPayment.current = false;
    };

    processPayment();
  }, [getSearchParamValue, verifyAndShowTickets]);

  // Update payment method when provider or currency changes
  useEffect(() => {
    let defaultMethod = "telebirr";
    if (selectedCurrency === "USD") {
      defaultMethod = "visa"; // Default to Visa for USD card payment
    } else if (activePaymentProvider === "CHAPA") {
      defaultMethod = "telebirr";
    } else {
      defaultMethod = "Telebirr";
    }

    console.log("[CURRENCY-CHANGE] Currency changed:", { selectedCurrency, newMethod: defaultMethod });
    setPaymentForm((prev) => ({
      ...prev,
      paymentMethod: defaultMethod,
    }));
  }, [activePaymentProvider, selectedCurrency]);

  // Reset ticket index when tickets change
  useEffect(() => {
    if (purchasedTickets.length > 0) {
      setCurrentTicketIndex(0);
    }
  }, [purchasedTickets]);

  const totalPrice = useMemo(() =>
    ticketPrice * ticketQuantity,
    [ticketPrice, ticketQuantity]
  );

  const isQuantityExceeded = useMemo(() =>
    selectedTicket ? ticketQuantity > selectedTicket.quantity : false,
    [selectedTicket, ticketQuantity]
  );

  const isEventSoldOut = useMemo(() => {
    if (!event) return false;
    if (event.isSoldOut) return true;
    if (event.status && event.status !== "published") return true;

    const now = new Date();
    const endDate = event.endDate ? new Date(event.endDate) : null;
    if (endDate) {
      if (event.endTime) {
        const [h, m] = event.endTime.split(":").map(Number);
        endDate.setHours(h || 23, m || 59, 0, 0);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
      if (endDate.getTime() <= now.getTime()) return true;
    }

    const hasAvailableTickets = event.ticketTypes.some(
      (t) => t.available !== false && t.quantity > 0,
    );
    return !hasAvailableTickets;
  }, [event]);

  const shareUrl = useMemo(
    () => `${process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin}${eventUrl}`,
    [eventUrl]
  );

  const coverImageUrl = useMemo(() => {
    if (!event?.coverImages?.[0]) return "/events/eventimg.png";
    const img = event.coverImages[0];
    return img.startsWith("http")
      ? img
      : `${process.env.NEXT_PUBLIC_API_URL}${img.startsWith("/") ? img : `/${img}`}`;
  }, [event]);

  // Utility functions - memoized with useCallback
  const downloadQRCode = useCallback((
    qrCodeDataUrl: string,
    ticketId: string,
    ticketType: string,
  ) => {
    downloadHighQualityQR(qrCodeDataUrl, `ticket-${ticketId}-${ticketType}.png`);
    toast.success(`QR code for ${ticketType} downloaded!`);
  }, []);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: event?.title,
        text: event?.description,
        url: shareUrl,
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  }, [event, shareUrl]);

  // Format functions - memoized and simplified
  const formatDate = useCallback((dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }), []);

  const formatTimeWithAmPm = useCallback((time24?: string) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute < 10 ? "0" + minute : minute} ${ampm}`;
  }, []);

  const formatTimeRange = useCallback((startTime?: string, endTime?: string) => {
    const start = formatTimeWithAmPm(startTime);
    const end = formatTimeWithAmPm(endTime);
    if (!start && !end) return "Time TBA";
    if (!start) return end;
    if (!end) return start;
    return `${start} - ${end}`;
  }, [formatTimeWithAmPm]);

  const getDayName = useCallback((dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { weekday: "short" }), []);

  const getDayNumber = useCallback((dateString: string) =>
    new Date(dateString).getDate().toString().padStart(2, "0"), []);

  const getMonthName = useCallback((dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { month: "short" }), []);

  // Loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="rounded-3xl p-8 bg-white/55 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D47A1] dark:border-yellow-400" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="rounded-3xl px-10 py-8 bg-white/55 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl">
          <p className="text-[#0D47A1] dark:text-yellow-400 font-medium">
            Event not found
          </p>
        </div>
      </div>
    );
  }

  const resolveImageUrl = (img: string) =>
    img.startsWith("http")
      ? img
      : `${process.env.NEXT_PUBLIC_API_URL}${img.startsWith("/") ? img : `/${img}`}`;

  const galleryImages = [
    ...event.coverImages.map((img) => ({ url: resolveImageUrl(img) })),
    ...(event.eventImages || []).map((img) => ({
      url: resolveImageUrl(img.url),
      caption: img.caption,
    })),
  ];

  const ageLabel = event.ageRestriction?.hasRestriction
    ? event.ageRestriction.minAge && !event.ageRestriction.maxAge
      ? `Ages ${event.ageRestriction.minAge}+`
      : !event.ageRestriction.minAge && event.ageRestriction.maxAge
        ? `Up to age ${event.ageRestriction.maxAge}`
        : event.ageRestriction.minAge && event.ageRestriction.maxAge
          ? `Ages ${event.ageRestriction.minAge}–${event.ageRestriction.maxAge}`
          : "Age restricted"
    : null;

  const ticketPanel = (
    <TicketPanel
      tickets={ticketsToDisplay}
      selectedTicketType={selectedTicketType}
      onSelectTicketType={setSelectedTicketType}
      selectedCurrency={selectedCurrency}
      onSelectCurrency={setSelectedCurrency}
      availableCurrencies={availableCurrencies}
      isSoldOut={isEventSoldOut}
      quantity={ticketQuantity}
      onQuantityChange={setTicketQuantity}
      maxQuantity={selectedTicket?.quantity || 10}
      isQuantityExceeded={isQuantityExceeded}
      totalPrice={totalPrice}
      showBuyButton={user?.role !== "admin" && user?.role !== "organizer"}
      isProcessing={isProcessingPayment}
      onBuy={handleBuyClick}
    />
  );

  return (
    <div className="relative isolate min-h-screen md:min-h-0 bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Ambient color blobs — gives the glass panels something to refract */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden md:hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-blue-400/25 dark:bg-blue-600/15 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-cyan-300/20 dark:bg-yellow-400/[0.07] blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-[26rem] w-[26rem] rounded-full bg-indigo-300/20 dark:bg-purple-600/10 blur-3xl" />
      </div>

      {/* ── Mobile — original layout, glassified ── */}
      <div className="relative w-full overflow-hidden md:hidden">
        <div className="px-8 py-4">
          <div className="relative w-full max-w-md mx-auto">
            <Image
              src={coverImageUrl}
              alt={`${event.title} - Event cover`}
              width={600}
              height={300}
              className="w-full h-auto object-cover rounded-xl shadow-md"
              priority
            />
          </div>
        </div>

        <div className="px-4 py-4 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight flex-1">
              {event.title}
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-700 dark:text-gray-300 border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md hover:bg-white/60 dark:hover:bg-white/10"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-4 items-start">
            <div className="shrink-0 bg-white/50 dark:bg-white/[0.06] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-3 text-center shadow-[0_8px_32px_rgba(31,38,135,0.1)] min-w-[70px]">
              <div className="text-xs font-medium text-gray-600 dark:text-yellow-400 uppercase tracking-wide">
                {getDayName(event.startDate)}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none mt-1">
                {getDayNumber(event.startDate)}
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mt-1">
                {getMonthName(event.startDate)}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-yellow-400" />
                <div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {event.location.address}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {event.location.city}, {event.location.country}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Calendar className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                <span className="text-sm">
                  {formatDate(event.startDate)}
                  {event.endDate &&
                    event.endDate !== event.startDate &&
                    ` - ${formatDate(event.endDate)}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                <span className="text-sm">
                  {formatTimeRange(event.startTime, event.endTime)}
                </span>
              </div>
              {event.organizer?.name && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  by {event.organizer.name}
                </div>
              )}
              {ageLabel && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <UserCheck className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs">{ageLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:hidden">
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/75 dark:bg-black/60 backdrop-blur-2xl border-t border-white/50 dark:border-white/10 w-full justify-around rounded-none h-12 p-0">
            <TabsTrigger
              value="tickets"
              className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50/60 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs"
            >
              <Ticket className="h-4 w-4 mb-0.5" />
              <span className="text-xs">Tickets</span>
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50/60 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs"
            >
              <BookOpen className="h-4 w-4 mb-0.5" />
              <span className="text-xs">About</span>
            </TabsTrigger>
            <TabsTrigger
              value="images"
              className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50/60 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs"
            >
              <ImageIcon className="h-4 w-4 mb-0.5" />
              <span className="text-xs">Images</span>
            </TabsTrigger>
          </TabsList>
          <div className="pb-16 mt-0">
            <TabsContent value="tickets" className="mt-0">
              {ticketPanel}
            </TabsContent>
            <TabsContent value="about" className="mt-0">
              <AboutSection
                description={event.description}
                organizerName={event.organizer?.name}
              />
            </TabsContent>
            <TabsContent value="images" className="mt-0">
              <GallerySection images={galleryImages} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* ── Desktop — full-viewport hero, no page scroll ── */}
      <EventHero
        title={event.title}
        coverImageUrl={coverImageUrl}
        description={event.description}
        categoryName={event.category?.name}
        dateLabel={
          event.endDate && event.endDate !== event.startDate
            ? `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`
            : formatDate(event.startDate)
        }
        timeLabel={formatTimeRange(event.startTime, event.endTime)}
        locationLabel={`${event.location.address}, ${event.location.city}`}
        ageLabel={ageLabel}
        organizerName={event.organizer?.name}
        isWishlisted={isInWishlist(event._id)}
        isWishlistLoading={isWishlistLoading}
        onToggleWishlist={() => {
          void toggleWishlist(event._id);
        }}
        onShare={handleShare}
      >
        {ticketPanel}
      </EventHero>

      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="w-full max-w-sm md:max-w-md lg:max-w-lg rounded-3xl p-0 overflow-hidden bg-white/90 dark:bg-[#12141A]/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 gap-0">
          <div className="bg-gradient-to-br from-[#0D47A1] to-blue-600 dark:from-yellow-400 dark:to-amber-500 p-6 text-white dark:text-black text-center">
            <h2 className="text-2xl font-bold mb-1">You&apos;re Going!</h2>
            <p className="text-blue-100 dark:text-black/70 text-sm">
              Your ticket is ready
            </p>
          </div>
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {event.title}
              </h3>
              <div className="flex flex-col gap-1 items-center text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0D47A1] dark:text-yellow-400" />
                  <span>{formatDate(event.startDate)}</span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <Clock className="h-4 w-4 text-[#0D47A1] dark:text-yellow-400" />
                  <span>{formatTimeWithAmPm(event.startTime)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-[#0D47A1] dark:text-yellow-400" />
                  <span>{event.location.address}</span>
                </div>
              </div>
            </div>
            <Separator className="my-6 dark:bg-white/10" />
            {purchasedTickets.length > 0 && (
              <div className="space-y-6">
                {(() => {
                  const ticket = purchasedTickets[currentTicketIndex];
                  return (
                    <div className="flex flex-col items-center">
                      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-md p-3 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 mb-5 shadow-sm">
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
                            className="text-base px-6 py-1.5 bg-blue-50/80 dark:bg-yellow-400/10 text-[#0D47A1] dark:text-yellow-400 backdrop-blur-md"
                          >
                            Admits: {ticket.ticketCount || 1} Person
                            {(ticket.ticketCount || 1) > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-lg text-gray-900 dark:text-white mt-2">
                          {ticket.ticketType}
                        </h4>
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
                        setCurrentTicketIndex(Math.max(0, currentTicketIndex - 1))
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
                              ? "bg-[#0D47A1] dark:bg-yellow-400"
                              : "bg-gray-200 dark:bg-white/20"
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
                            currentTicketIndex + 1,
                          ),
                        )
                      }
                      disabled={currentTicketIndex === purchasedTickets.length - 1}
                    >
                      &gt;
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-gray-50/60 dark:bg-black/20 backdrop-blur-md border-t border-gray-200/60 dark:border-white/10 flex gap-3">
            <Button
              className="flex-1 bg-white/70 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 backdrop-blur-md"
              variant="outline"
              onClick={() => {
                const ticket = purchasedTickets[currentTicketIndex];
                downloadQRCode(ticket.qrCode, ticket.ticketId, ticket.ticketType);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Save Image
            </Button>
            <Button
              className="flex-1 bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90 text-white shadow-md"
              onClick={() => setShowTicketModal(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-xl rounded-3xl max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-[#12141A]/90 backdrop-blur-2xl border border-white/40 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center dark:text-white">
              Checkout
            </DialogTitle>
            <DialogDescription className="text-center dark:text-gray-400">
              Complete your purchase securely
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMobilePayment} className="space-y-6 pt-2">
            <div className="space-y-3">
              {!user && (
                <div>
                  <Label
                    htmlFor="payment_fullname"
                    className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="payment_fullname"
                    value={paymentForm.fullName}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, fullName: e.target.value })
                    }
                    placeholder="Enter your full name"
                    required
                    className="mt-1 bg-white/60 dark:bg-white/5 border-white/60 dark:border-white/10 dark:text-white backdrop-blur-md"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {(!user || !user.email) && (
                  <div>
                    <Label
                      htmlFor="payment_email"
                      className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                    >
                      Email
                    </Label>
                    <Input
                      id="payment_email"
                      type="email"
                      value={paymentForm.email}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, email: e.target.value })
                      }
                      placeholder="Email address"
                      className="mt-1 bg-white/60 dark:bg-white/5 border-white/60 dark:border-white/10 dark:text-white backdrop-blur-md"
                    />
                  </div>
                )}
                <div>
                  <Label
                    htmlFor="payment_phone"
                    className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                  >
                    Phone
                  </Label>
                  {selectedCurrency === "USD" ? (
                    // Country code dropdown + phone input for USD
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      <select
                        value={paymentForm.countryCode}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            countryCode: e.target.value,
                          })
                        }
                        className="bg-white/60 dark:bg-[#1A1D24]/80 backdrop-blur-md w-full border border-white/60 dark:border-white/10 rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                      >
                        {COUNTRIES_FOR_PAYMENT.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name} (+{country.prefix})
                          </option>
                        ))}
                      </select>
                      <div className="flex-1 sm:flex-row flex flex-row w-full items-center border border-white/60 dark:border-white/10 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white/60 dark:bg-white/5 backdrop-blur-md">
                        <div className="bg-gray-100/80 dark:bg-white/5 px-3 py-2 text-gray-500 dark:text-gray-400 border-r dark:border-white/10 text-sm font-medium min-w-fit">
                          +
                          {COUNTRIES_FOR_PAYMENT.find(
                            (c) => c.code === paymentForm.countryCode,
                          )?.prefix || "1"}
                        </div>
                        <Input
                          id="payment_phone"
                          type="tel"
                          value={paymentForm.phoneNumber}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            setPaymentForm({ ...paymentForm, phoneNumber: val });
                          }}
                          placeholder="Enter phone number"
                          required
                          className="border-0 rounded-none focus-visible:ring-0 shadow-none flex-1 bg-transparent"
                        />
                      </div>
                    </div>
                  ) : (
                    // Ethiopia +251 for ETB
                    <div className="flex items-center border border-white/60 dark:border-white/10 rounded-md overflow-hidden mt-1 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-gray-400/20 bg-white/60 dark:bg-white/5 backdrop-blur-md">
                      <div className="bg-gray-100/80 dark:bg-white/5 px-3 py-2 text-gray-500 dark:text-gray-400 border-r dark:border-white/10 text-sm font-medium">
                        +251
                      </div>
                      <Input
                        id="payment_phone"
                        type="tel"
                        maxLength={9}
                        value={paymentForm.phoneNumber}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, "");
                          if (val.startsWith("0")) val = val.substring(1);
                          if (val.startsWith("251")) val = val.substring(3);
                          setPaymentForm({ ...paymentForm, phoneNumber: val });
                        }}
                        placeholder="9..."
                        required
                        className="border-0 rounded-none focus-visible:ring-0 shadow-none bg-transparent dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <PaymentMethodSelector
                phoneNumber={paymentForm.phoneNumber}
                selectedMethod={paymentForm.paymentMethod}
                onSelect={(val) =>
                  setPaymentForm({ ...paymentForm, paymentMethod: val })
                }
                provider={activePaymentProvider}
                currency={selectedCurrency}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 dark:bg-[#FDC700] dark:hover:bg-yellow-400/90 dark:text-black hover:bg-blue-700 text-white"
                disabled={
                  isProcessingPayment ||
                  !paymentForm.phoneNumber ||
                  !paymentForm.paymentMethod ||
                  // For ETB payments, enforce 9-digit Ethiopian number.
                  // For USD (international card), any non-empty number is accepted.
                  (selectedCurrency !== "USD" &&
                    paymentForm.phoneNumber.length < 9)
                }
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                  </>
                ) : (
                  `Pay ${selectedCurrency === "USD" ? "$" : ""}${totalPrice} ${selectedCurrency === "USD" ? "USD" : "ETB"}`
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loading Dialog for Ticket Verification */}
      <Dialog open={isProcessingPayment} onOpenChange={() => { }}>
        <DialogContent
          className="w-[90vw] max-w-sm rounded-3xl p-6 text-center bg-white/90 dark:bg-[#12141A]/90 backdrop-blur-2xl border border-white/40 dark:border-white/10"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold mb-2 dark:text-white">
              Processing Your Tickets
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Please wait while we retrieve your tickets...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0D47A1] dark:border-yellow-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
              This may take a few moments
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {waitingTicketId
                ? `Ticket ID: ${waitingTicketId} – finalizing...`
                : currentTxRef
                  ? `Reference: ${currentTxRef}, checking status...`
                  : "Checking payment status..."}
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                cancelPaymentRef.current = true;
                setIsProcessingPayment(false);

                // Cancel the payment on backend
                if (currentTxRef) {
                  try {
                    await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL}/api/payments/cancel`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ transactionId: currentTxRef }),
                      },
                    );
                    toast.info(
                      "Payment verification cancelled. You can try again.",
                    );
                  } catch (error) {
                    console.error("Failed to cancel payment:", error);
                  }
                }

                router.replace(eventUrl);
              }}
              className="mt-4 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
