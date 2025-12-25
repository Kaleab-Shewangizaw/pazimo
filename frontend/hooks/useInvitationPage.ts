import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Event, Invitation, Attendee, Pricing } from "@/types/invitation";
import { createGuestTicket } from "@/lib/invitationUtils";

interface PendingInvitation {
  contact: string;
  customerName: string;
  message: string;
  qrCodeCount: number;
  guestType: "guest" | "paid";
  ticketType?: string;
  contactType: "email" | "phone" | "both";
  selectedEvent: Event | null;
}

export function useInvitationPage() {
  // Auth & Loading States
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSantimLoading, setIsSantimLoading] = useState(false);
  const [payingPhoneNumber, setPayingPhoneNumber] = useState<string>("");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  // Data States
  const [events, setEvents] = useState<Event[]>([]);
  const [rawInvitations, setRawInvitations] = useState<any[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [pricing, setPricing] = useState<Pricing>({ email: 2.5, sms: 7.5 });
  const [qrCodeUsage, setQrCodeUsage] = useState<Record<string, number>>({});

  // Modal States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Selection States
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [selectedEventAttendees, setSelectedEventAttendees] =
    useState<Event | null>(null);
  const [selectedEventDetails, setSelectedEventDetails] =
    useState<Event | null>(null);
  const [pendingInvitation, setPendingInvitation] =
    useState<PendingInvitation | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form States
  const [contact, setContact] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone" | "both">(
    "email"
  );
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [qrCodeCount, setQrCodeCount] = useState(1);
  const [guestType, setGuestType] = useState<"guest" | "paid">("guest");
  const [selectedTicketType, setSelectedTicketType] = useState("Regular");

  // UI States
  const [activeTab, setActiveTab] = useState<"send" | "sent">("send");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [attendeesPage, setAttendeesPage] = useState(1);

  const itemsPerPage = 5;
  const attendeesPerPage = 5;

  // Computed Data
  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvitations = sentInvitations.filter(
    (inv) =>
      (inv.customerName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (inv.eventTitle || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(
    (activeTab === "send"
      ? filteredEvents.length
      : filteredInvitations.length) / itemsPerPage
  );

  const isLoading = !mounted;

  const stats = {
    totalInvitations: sentInvitations.length,
    emailInvitations: sentInvitations.filter((i) => i.contactType === "email")
      .length,
    smsInvitations: sentInvitations.filter((i) => i.contactType === "phone")
      .length,
    deliveredInvitations: sentInvitations.filter(
      (i) => i.status === "delivered"
    ).length,
    publicEvents: events.filter((e) => e.isPublic !== false).length,
    privateEvents: events.filter((e) => e.isPublic === false).length,
    totalExpense: sentInvitations.reduce((sum, inv) => {
      // Only count if paymentStatus is 'paid' (meaning organizer paid for it)
      if (inv.paymentStatus === "paid") {
        // @ts-ignore
        const type = inv.originalType || "email";
        const amount = inv.qrCodeCount || 1;
        let cost = 0;
        if (type === "email") cost = pricing.email;
        else if (type === "sms" || type === "phone") cost = pricing.sms;
        else if (type === "both") cost = pricing.email + pricing.sms;
        return sum + cost * amount;
      }
      return sum;
    }, 0),
  };

  useEffect(() => {
    setMounted(true);
    const userId = localStorage.getItem("userId");
    if (userId) {
      loadEvents(userId);
    }
    fetchSentInvitations();
    // fetchPricing(); // This requires eventType, removing for now or should be called when event is selected

    // Fetch payment config
    const fetchConfig = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/config/payment/active`
        );
        const data = await res.json();
        if (data.success) {
          setActivePaymentProvider(data.data.activeProvider);
        }
      } catch (error) {
        console.error("Failed to fetch payment config", error);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  const pollPaymentStatus = async (transactionId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/status/${transactionId}`
      );
      const data = await response.json();

      if (data.success && data.status === "PAID") {
        if (pollingInterval) clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsSantimLoading(false);
        setShowPaymentModal(false);
        setPendingInvitation(null);

        toast.success("Payment successful! Invitations sent.");
        fetchSentInvitations(); // Refresh list
      } else if (data.status === "FAILED" || data.status === "CANCELLED") {
        if (pollingInterval) clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsSantimLoading(false);
        if (data.status === "CANCELLED") {
          toast.info("Payment cancelled.");
        } else {
          toast.error("Payment failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  const fetchPricing = async (eventType: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing/${eventType}`
      );
      if (response.ok) {
        const data = await response.json();
        setPricing({
          email: data.data.emailPrice,
          sms: data.data.smsPrice,
        });
      }
    } catch (error) {
      console.error("Failed to fetch pricing:", error);
    }
  };

  const loadEvents = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const allEvents = data.events || data.data || [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedEvents = allEvents.map((event: any) => ({
          id: event._id,
          title: event.title,
          date: new Date(event.startDate).toLocaleDateString(),
          time: event.startTime || "TBD",
          location: `${event.location?.address || ""}, ${
            event.location?.city || ""
          }`
            .trim()
            .replace(/^,\s*/, ""),
          organizer: "Current User",
          description: event.description,
          status: event.status,
          eventType:
            typeof event.isPublic === "boolean"
              ? event.isPublic
                ? "public"
                : "private"
              : event.eventType || "public",
          isPublic: event.isPublic,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          capacity: event.capacity,
          ticketTypes: event.ticketTypes,
          tags: event.tags,
          category: event.category,
          ageRestriction: event.ageRestriction,
          coverImages: event.coverImages,
          _id: event._id,
        }));

        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

  const fetchSentInvitations = async () => {
    try {
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      if (!userId || !token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/organizer/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        let invitations = [];

        if (Array.isArray(data)) {
          invitations = data;
        } else if (Array.isArray(data.data)) {
          invitations = data.data;
        } else if (Array.isArray(data.invitations)) {
          invitations = data.invitations;
        }

        console.log("Fetched invitations:", invitations);
        setRawInvitations(invitations);
      }
    } catch (error) {
      console.error("Error fetching sent invitations:", error);
    }
  };

  useEffect(() => {
    const formattedInvitations = rawInvitations.map((inv: any) => {
      // Try to find event title from loaded events if not populated
      const eventId = inv.eventId?._id || inv.eventId;
      const loadedEvent = events.find(
        (e) => e.id === eventId || e._id === eventId
      );
      const eventTitle =
        inv.eventId?.title ||
        inv.eventTitle ||
        loadedEvent?.title ||
        "Unknown Event";

      return {
        id: inv._id || inv.id || Math.random().toString(36).substr(2, 9),
        eventTitle: eventTitle,
        customerName: inv.guestName || inv.customerName || "Unknown Guest",
        ticketType: inv.ticketType || "Regular",
        contact:
          inv.type === "email"
            ? inv.guestEmail
            : inv.type === "phone" || inv.type === "sms"
            ? inv.guestPhone
            : inv.contact || "",
        contactType: (inv.type === "sms"
          ? "phone"
          : inv.type || inv.contactType || "email"
        ).toLowerCase(),
        originalType: inv.type,
        guestType: inv.paymentStatus === "paid" ? "paid" : "guest",
        paymentStatus: inv.paymentStatus || "free",
        qrCodeCount: inv.amount || inv.qrCodeCount || 1,
        message: inv.message || "",
        sentAt: inv.createdAt
          ? new Date(inv.createdAt).toLocaleString()
          : "Just now",
        status: inv.status || "sent",
        rsvpStatus: inv.rsvpStatus || "pending",
        qrCode: inv.qrCodeData || inv.qrCode || "",
        rsvpLink: inv.rsvpLink || "",
        eventId: eventId,
      };
    });
    setSentInvitations(formattedInvitations);
  }, [rawInvitations, events]);

  const generateQRCode = async (
    eventId: number | string,
    customerName: string,
    contact: string,
    guestType: "guest" | "paid" = "guest"
  ) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || "https://pazimo.vercel.app";
      let qrUrl: string;

      if (guestType === "paid") {
        qrUrl = `${baseUrl}/event_detail?id=${eventId}`;
      } else {
        const guestData = {
          eventId,
          customerName,
          contact,
          contactType,
          guestType: "guest",
          eventTitle: selectedEvent?.title || "Event",
          eventDate: selectedEvent?.date || "",
          eventTime: selectedEvent?.time || "",
          eventLocation: selectedEvent?.location || "",
          timestamp: Date.now(),
        };
        qrUrl = `${baseUrl}/guest-invitation?data=${btoa(
          JSON.stringify(guestData)
        )}`;
      }

      const qrCodeImage = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#0D47A1", light: "#FFFFFF" },
      });
      return { url: qrUrl, image: qrCodeImage };
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
      return { url: "", image: "" };
    }
  };

  const createEmailTemplate = (
    customerName: string,
    event: Event | null,
    message: string,
    qrLink: string,
    guestType: "guest" | "paid" = "guest"
  ) => {
    const actionText = "View Invitation";
    const headerTitle = "You're Invited!";
    const headerSubtitle = "Join us for an amazing event";
    const actionLink = qrLink;

    // Format date and time
    const eventDate = event?.startDate
      ? new Date(event.startDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : event?.date || "";

    const eventTime =
      event?.time ||
      (event?.startDate
        ? new Date(event.startDate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "");

    // Check for Signature Event
    const isSignatureEvent =
      event?.title && event.title.toLowerCase().includes("signature");

    if (isSignatureEvent) {
      const signatureEventDate = event?.startDate
        ? new Date(event.startDate).toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : event?.date || "";

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%);
      color: #000000 !important;
      padding: 15px 40px;
      border-radius: 2px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
      transition: all 0.3s ease;
      border: 1px solid #d4af37;
    }
    .button:hover {
      background: #000000;
      color: #d4af37 !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Playfair Display', Georgia, serif; background-color: #111111;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #333333;">
    <!-- Header -->
    <div style="background-color: #000000; padding: 40px 30px; text-align: center; border-bottom: 1px solid #d4af37;">
      <img src="https://www.signaturewellnesseth.com/logo-gold-dark-mode.png" alt="Signature Wellness" style="max-width: 150px; margin-bottom: 20px;" />
      <h1 style="color: #d4af37; margin: 0; font-size: 32px; font-weight: 400; letter-spacing: 2px;">${headerTitle}</h1>
      <p style="color: #888888; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">${headerSubtitle}</p>
    </div>

    <!-- Content -->
    <div style="padding: 50px 40px; text-align: center;">
      <h2 style="color: #ffffff; margin: 0 0 15px 0; font-size: 28px; font-weight: 400;">${
        event?.title
      }</h2>
      <div style="width: 60px; height: 2px; background-color: #d4af37; margin: 0 auto 30px auto;"></div>
        <p style="color: #ffffff; font-size: 18px; margin-bottom: 10px;">Hello, ${customerName}</p>
        <p style="color: #cccccc; margin: 0 0 40px 0; font-size: 16px; line-height: 1.8; font-family: 'Segoe UI', sans-serif; font-weight: 300;">
          We cordially invite you to join us for an evening of elegance and celebration.
        </p>

      ${
        message
          ? `
      <div style="background: #222222; border: 1px solid #333333; padding: 30px; margin: 30px 0;">
        <p style="color: #d4af37; margin: 0 0 10px 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Message from Organizer</p>
        <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6; font-style: italic;">"${message}"</p>
      </div>
      `
          : ""
      }

      <!-- Event Details -->
      <div style="margin: 40px 0; border-top: 1px solid #333333; border-bottom: 1px solid #333333; padding: 30px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; text-align: center; width: 33%;">
              <div style="color: #d4af37; font-size: 14px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">DATE</div>
              <div style="color: #ffffff; margin-top: 5px; font-family: 'Segoe UI', sans-serif;">${signatureEventDate}</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 33%; border-left: 1px solid #333333; border-right: 1px solid #333333;">
              <div style="color: #d4af37; font-size: 14px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">TIME</div>
              <div style="color: #ffffff; margin-top: 5px; font-family: 'Segoe UI', sans-serif;">${eventTime}</div>
            </td>
            <td style="padding: 10px; text-align: center; width: 33%;">
              <div style="color: #d4af37; font-size: 14px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">LOCATION</div>
              <div style="color: #ffffff; margin-top: 5px; font-family: 'Segoe UI', sans-serif;">${
                event?.location || "Venue TBD"
              }</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="margin-top: 40px;">
        <a href="${actionLink}" class="button">${actionText}</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #000000; padding: 30px; text-align: center; border-top: 1px solid #333333;">
      <p style="color: #666666; margin: 0; font-size: 12px; font-family: 'Segoe UI', sans-serif;">
        &copy; ${new Date().getFullYear()} Pazimo. All rights reserved.
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://pazimo.com?uid=${new Date().getTime()}" style="color: #d4af37; text-decoration: none; font-size: 14px; font-family: 'Playfair Display', serif; letter-spacing: 1px;">pazimo.com</a>
      </p>
      <!-- Unique identifier to prevent Gmail clipping/threading -->
      <div style="display:none; opacity:0; font-size:1px; color:#000000;">${new Date().getTime()}-${Math.random()
        .toString(36)
        .substring(7)}</div>
    </div>
  </div>
</body>
</html>
    `;
    }

    return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerTitle}</title>
</head>

<body
  style="margin:0;padding:0;background-color:#f5f7fb; background-color: #f5f7fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- EMAIL CONTAINER -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.08);position:relative;">

          <!-- HEADER / HERO -->
          <tr>
            <td style="padding:40px 32px 32px;text-align:center;position:relative;">

              <!-- Decorative shapes -->
              <!-- Orange circle -->
              <svg width="140" height="140" style="position:absolute;top:-50px;right:-50px;opacity:0.5;">
                <circle cx="70" cy="70" r="70" fill="#fde68a" />
              </svg>
              <!-- Pink square -->
              <svg width="110" height="110" style="position:absolute;bottom:-50px;left:-40px;opacity:0.4;">
                <rect width="110" height="110" rx="20" fill="#fbcfe8" />
              </svg>
              <!-- Ribbon curve -->
              <svg width="400" height="80" style="position:absolute;top=0px;left:-50px;opacity:0.3;">
                <path d="M0,40 Q150,0 300,40" stroke="#fbbf24" stroke-width="8" fill="transparent" />
              </svg>
              <svg width="400" height="80" style="position:absolute;bottom:0px;right:-100px;opacity:0.3;">
                <path d="M0,40 Q150,80 300,40" stroke="#a78bfa" stroke-width="6" fill="transparent" />
              </svg>

              <!-- Logo -->
              <div style="margin-bottom:16px;position:relative;z-index:1;">
                <span style="display:inline-block;background:#ffffff;padding:6px 12px;border-radius:12px;">
                  <img src="https://pazimo.com/logo.png"
                    onerror="this.onerror=null;this.src='https://pazimo.vercel.app/logo.png';" alt="Pazimo"
                    style="height:28px;display:block;" />
                </span>
              </div>

              <p
                style="margin:0;font-size:12px;letter-spacing:3px;color:#2563eb;font-weight:700;position:relative;z-index:1;text-transform:uppercase;">
                ${headerTitle}
              </p>

              <h1 style="margin:16px 0 0;font-size:32px;line-height:1.25;color:#111827;position:relative;z-index:1;">
                ${event?.title}
              </h1>

              <!-- Guest Greeting -->
              <p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                Hello ${customerName},
              </p>

              <!-- Event Message -->
              <p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${headerSubtitle}
              </p>

              <!-- Organizer Message -->
              ${
                message
                  ? `<p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${message}
              </p>`
                  : ""
              }

              <!-- Confetti and shapes below messages -->
              <svg width="100%" height="250" style="position:absolute;top:200px;right:0;pointer-events:none;z-index:0;">
                <circle cx="20" cy="30" r="6" fill="#f59e0b" opacity="0.4" />
                <rect x="60" y="40" width="8" height="8" fill="#f472b6" opacity="0.3" />
                <polygon points="100,10 110,30 90,30" fill="#60a5fa" opacity="0.3" />
                <circle cx="140" cy="50" r="5" fill="#fbbf24" opacity="0.4" />
                <rect x="180" y="30" width="6" height="6" fill="#a78bfa" opacity="0.3" />
                <polygon points="220,20 230,40 210,40" fill="#34d399" opacity="0.3" />
                <circle cx="260" cy="60" r="4" fill="#f87171" opacity="0.3" />
                <rect x="300" y="40" width="7" height="7" fill="#fb923c" opacity="0.4" />
                <polygon points="340,10 350,30 330,30" fill="#fbbf24" opacity="0.3" />
                <circle cx="380" cy="50" r="5" fill="#60a5fa" opacity="0.3" />
                <rect x="420" y="30" width="6" height="6" fill="#f472b6" opacity="0.3" />
                <polygon points="460,20 470,40 450,40" fill="#f59e0b" opacity="0.3" />
              </svg>

            </td>
          </tr>

          <!-- EVENT DETAILS -->
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#eff6ff;border-radius:16px;">
                <tr>
                  <td style="padding:24px 24px 12px;font-size:14px;color:#374151;">
                    <strong style="color:#111827;">Date</strong><br />
                    ${eventDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px;font-size:14px;color:#374151;">
                    <strong style="color:#111827;">Time</strong><br />
                    ${eventTime}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px 24px;font-size:14px;color:#374151;">
                    <strong style="color:#111827;">Location</strong><br />
                    ${event?.location || "Venue TBD"}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:16px 32px 40px;">
              <a href="${actionLink}" style="
                  display:inline-block;
                  background:#2563eb;
                  color:#ffffff;
                  text-decoration:none;
                  padding:16px 36px;
                  border-radius:14px;
                  font-size:16px;
                  font-weight:600;
                ">
                ${actionText}
              </a>

              <p style="margin-top:14px;font-size:13px;color:#6b7280;">
                Confirm your attendance and access your ticket
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#6b7280;">
                Powered by
                <a href="https://pazimo.com" style="color:#2563eb;text-decoration:none;font-weight:600;">
                  Pazimo.com
                </a>
              </p>
              <p style="margin-top:6px;font-size:12px;color:#9ca3af;">
                Where people and events connect.
              </p>
            </td>
          </tr>

        </table>
        <!-- END CONTAINER -->

      </td>
    </tr>
  </table>
</body>

</html>`;
  };

  const sendEmail = async (to: string, subject: string, htmlBody: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/send-invitation-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body: htmlBody }),
        }
      );
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Email send error:", error);
      return false;
    }
  };

  const sendSMS = async (phone: string, message: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/send-sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message }),
        }
      );
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("SMS send error:", error);
      return false;
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^(\+251|0)?[79]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ""));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    fetchPricing(event.eventType || "public");
    setShowInviteModal(true);
  };

  const handleViewDetails = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setShowDetailsModal(true);
  };

  const handleViewQR = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setShowQRModal(true);
  };

  const handleInviteClick = (event: Event) => {
    setSelectedEvent(event);
    fetchPricing(event.eventType || "public");
    setShowInviteModal(true);
  };

  const handleBulkInviteClick = (event: Event) => {
    setSelectedEvent(event);
    setShowBulkModal(true);
  };

  const handleViewAttendees = async (event: Event) => {
    setShowAttendeesModal(true);
    setAttendeesLoading(true);
    setSelectedEventAttendees(event);

    try {
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      if (!userId || !token) {
        setAttendees([]);
        setAttendeesLoading(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${event.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const tickets = data.tickets || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedAttendees = tickets.map((ticket: any) => {
          const name = ticket.user
            ? `${ticket.user.firstName} ${ticket.user.lastName}`
            : ticket.guestName || "Unknown Guest";

          const contact = ticket.user
            ? ticket.user.email
            : ticket.guestEmail || ticket.guestPhone || "No Contact";

          return {
            id: ticket._id,
            customerName: name,
            contact: contact,
            guestType: ticket.isInvitation
              ? "Guest"
              : ticket.ticketType || "Paid",
            confirmedAt:
              ticket.status === "pending" || ticket.status === "cancelled"
                ? "Pending"
                : ticket.createdAt
                ? new Date(ticket.createdAt).toLocaleDateString()
                : "Unknown",
            status: ticket.status || "active",
          };
        });

        // Also fetch invitation records for this event so we show pending/confirmed/declined invitations
        try {
          const invRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/event/${event.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (invRes.ok) {
            const invData = await invRes.json();
            const invitations = invData.data || [];

            const invitationAttendees = invitations
              .filter((inv: any) => {
                // Include invitations that are relevant for attendee view: RSVP pending/confirmed/declined or pending_payment
                const rsvp = (inv.rsvpStatus || "").toLowerCase();
                const st = (inv.status || "").toLowerCase();
                return (
                  ["pending", "confirmed", "declined"].includes(rsvp) ||
                  st === "pending_payment" ||
                  st === "sent" ||
                  st === "delivered"
                );
              })
              .map((inv: any) => ({
                id: inv._id || inv.invitationId,
                customerName: inv.guestName || "Guest",
                contact: inv.guestEmail || inv.guestPhone || "No Contact",
                guestType: inv.guestType === "paid" ? "Paid" : "Guest",
                confirmedAt:
                  inv.rsvpStatus === "pending"
                    ? "Pending"
                    : inv.rsvpConfirmedAt
                    ? new Date(inv.rsvpConfirmedAt).toLocaleDateString()
                    : inv.createdAt
                    ? new Date(inv.createdAt).toLocaleDateString()
                    : "Unknown",
                status:
                  (inv.rsvpStatus && inv.rsvpStatus.toLowerCase()) ||
                  (inv.status && inv.status.toLowerCase()) ||
                  "pending",
              }));

            // Merge tickets and invitations, preferring invitations when duplicates exist
            const merged = [...formattedAttendees];
            // Append invitation-only entries (no ticket created yet)
            invitationAttendees.forEach((invAtt: any) => {
              // Avoid duplicates by contact + guest name
              const exists = merged.some(
                (m) =>
                  (m.contact &&
                    invAtt.contact &&
                    m.contact === invAtt.contact) ||
                  (m.customerName === invAtt.customerName &&
                    m.contact === invAtt.contact)
              );
              if (!exists) merged.push(invAtt);
            });

            setAttendees(merged);
          } else {
            setAttendees(formattedAttendees);
          }
        } catch (invErr) {
          console.error("Error fetching invitations:", invErr);
          setAttendees(formattedAttendees);
        }
      } else {
        setAttendees([]);
      }
    } catch (error) {
      console.error("Error fetching attendees:", error);
      setAttendees([]);
    } finally {
      setAttendeesLoading(false);
    }
  };

  const handleViewEventDetails = async (event: Event) => {
    try {
      setSelectedEventDetails(event);
      setShowEventDetailsModal(true);

      if (typeof window !== "undefined" && (event._id || event.id)) {
        const token = localStorage.getItem("token");
        if (token && process.env.NEXT_PUBLIC_API_URL) {
          const eventId = event._id || event.id;
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`,
            {
              headers: { "Content-Type": "application/json" },
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

  const generateUUID = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  };

  const processPendingInvitation = async (
    data?: typeof pendingInvitation,
    overrideQrLink?: string
  ) => {
    const invitationData = data || pendingInvitation;
    if (!invitationData) return;

    setIsSubmitting(true);

    try {
      const {
        contact,
        customerName,
        message,
        qrCodeCount,
        guestType,
        ticketType,
        contactType,
        selectedEvent,
      } = invitationData;

      // If it's a guest (free) invitation, use the backend endpoint to create ticket and send email
      if (guestType === "guest" && !overrideQrLink) {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Authentication required");
          setIsSubmitting(false);
          return;
        }

        const isEmail = validateEmail(contact);
        const isPhone = validatePhoneNumber(contact);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invite`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              eventId: selectedEvent?.id,
              guestName: customerName,
              guestEmail: isEmail ? contact : undefined,
              guestPhone: isPhone ? contact : undefined,
              ticketCount: qrCodeCount,
              message: message,
              ticketType: ticketType || "Guest",
            }),
          }
        );

        console.log("Sending invitation payload:", {
          eventId: selectedEvent?.id,
          guestName: customerName,
          guestEmail: isEmail ? contact : undefined,
          guestPhone: isPhone ? contact : undefined,
          ticketCount: qrCodeCount,
          message: message,
          ticketType: ticketType || "Guest",
        });

        const result = await response.json();

        if (response.ok && result.success) {
          const newInvitation: Invitation = {
            id: result.ticket?.ticketId || Date.now(),
            eventTitle: selectedEvent?.title || "",
            customerName,
            contact,
            contactType,
            guestType,
            qrCodeCount,
            message,
            sentAt: new Date().toLocaleString(),
            status: "delivered",
            qrCode: "",
            eventId: selectedEvent?.id,
            rsvpLink: "",
          };
          setRawInvitations((prev) => [newInvitation, ...prev]);
          setQrCodeUsage((prev) => ({
            ...prev,
            [contact]: (prev[contact] || 0) + qrCodeCount,
          }));

          setContact("");
          setCustomerName("");
          setMessage("");
          setQrCodeCount(1);
          setGuestType("guest");
          setPendingInvitation(null);
          toast.success(`Invitation sent successfully to ${customerName}!`);
        } else {
          toast.error(result.message || "Failed to send invitation");
        }
        setIsSubmitting(false);
        return;
      }

      let qrCodeLink: string;
      let invitationId = "";

      if (overrideQrLink) {
        qrCodeLink = overrideQrLink;
      } else {
        // Generate UUID for the invitation
        invitationId = generateUUID();
        const baseUrl =
          process.env.NEXT_PUBLIC_FRONTEND_URL || "https://pazimo.vercel.app";

        if (guestType === "paid") {
          qrCodeLink = `${baseUrl}/event_detail?id=${selectedEvent?.id}`;
        } else {
          qrCodeLink = `${baseUrl}/guest-invitation?inv=${invitationId}`;
        }
      }

      const qrCodeImage = await QRCode.toDataURL(qrCodeLink, {
        width: 300,
        margin: 2,
        color: { dark: "#0D47A1", light: "#FFFFFF" },
      });

      const eventDetails = `Event: ${selectedEvent?.title}\nDate: ${selectedEvent?.date} ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}\n\nRSVP Link: ${qrCodeLink}`;
      const smsInviteMessage = message
        ? `${message.trim()}\n\n${eventDetails}`
        : `${eventDetails}`;

      let success = false;

      if (contactType === "email") {
        const subject = `🎉 You're Invited: ${selectedEvent?.title}`;
        // For email, we don't need to append event details to the message as they are already in the template
        const emailBody = createEmailTemplate(
          customerName,
          selectedEvent,
          message, // Pass only the custom message
          qrCodeLink,
          guestType
        );
        success = await sendEmail(contact, subject, emailBody);
      } else {
        let formattedPhone = contact.replace(/\s+/g, "");
        if (formattedPhone.startsWith("0")) {
          formattedPhone = "+251" + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith("+251")) {
          formattedPhone = "+251" + formattedPhone;
        }

        const smsMessage = `Hello, ${customerName}\n\n${smsInviteMessage}`;
        success = await sendSMS(formattedPhone, smsMessage);
      }

      const newInvitation: Invitation = {
        id: Date.now(),
        eventTitle: selectedEvent?.title || "",
        customerName,
        contact,
        contactType,
        guestType,
        qrCodeCount,
        message,
        sentAt: new Date().toLocaleString(),
        status: success ? "delivered" : "failed",
        qrCode: qrCodeLink,
        eventId: selectedEvent?.id,
        rsvpLink: qrCodeLink,
      };

      try {
        const userId = localStorage.getItem("userId");
        const token = localStorage.getItem("token");

        if (userId && token) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invitations`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              invitationId: invitationId || undefined,
              eventId: selectedEvent?.id,
              customerName,
              contact,
              contactType,
              guestType,
              qrCodeCount,
              message,
              status: newInvitation.status,
              qrCode: qrCodeLink,
              organizerId: userId,
              rsvpLink: qrCodeLink,
              paymentStatus: overrideQrLink ? "paid" : "free",
            }),
          });
        }
      } catch (error) {
        console.error("Error saving invitation to database:", error);
      }

      setRawInvitations((prev) => [newInvitation, ...prev]);
      setQrCodeUsage((prev) => ({
        ...prev,
        [contact]: (prev[contact] || 0) + qrCodeCount,
      }));

      setContact("");
      setCustomerName("");
      setMessage("");
      setQrCodeCount(1);
      setGuestType("guest");
      setPendingInvitation(null);

      if (success) {
        toast.success(`Invitation sent successfully to ${customerName}!`);
      } else {
        toast.error(`Failed to send invitation to ${customerName}.`);
      }
    } catch (error) {
      console.error("Send invitation error:", error);
      toast.error("An error occurred while sending the invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!contact || !customerName) {
      toast.error("Please enter customer name and contact information");
      return;
    }

    if (selectedEvent?.status !== "published") {
      toast.error(
        "This event must be published by admin before sending invitations"
      );
      return;
    }

    const currentUsage = qrCodeUsage[contact] || 0;
    // Limit check removed

    if (contactType === "email" && !validateEmail(contact)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (contactType === "phone" && !validatePhoneNumber(contact)) {
      toast.error("Please enter a valid Ethiopian phone number");
      return;
    }
    if (
      contactType === "both" &&
      !validateEmail(contact) &&
      !validatePhoneNumber(contact)
    ) {
      toast.error(
        "Please enter a valid email address or Ethiopian phone number"
      );
      return;
    }

    // Calculate cost to determine if payment is needed
    let cost = 0;
    if (contactType === "email") cost = pricing.email;
    if (contactType === "phone") cost = pricing.sms;

    // Only skip payment if the cost is 0 OR if it's a "Paid Attendee" invitation (Organizer doesn't pay for these)
    const shouldSkipPayment = cost <= 0 || guestType === "paid";

    const invitationData = {
      contact,
      customerName,
      message,
      qrCodeCount,
      guestType,
      ticketType: selectedTicketType,
      contactType,
      selectedEvent,
      event: selectedEvent,
    };

    setPendingInvitation(invitationData);
    setShowInviteModal(false);

    if (shouldSkipPayment) {
      await processPendingInvitation(invitationData);
    } else {
      setShowPaymentModal(true);
    }
  };

  // Helper to handle the async nature of state setting
  const handleSantimPayment = async (paymentDetails: {
    phoneNumber: string;
    paymentMethod: string;
  }) => {
    setIsSantimLoading(true);
    try {
      const { phoneNumber, paymentMethod } = paymentDetails;
      const invitationData = pendingInvitation;

      if (!invitationData) {
        toast.error("No invitation data found");
        return;
      }

      // Calculate cost
      let cost = 0;
      if (invitationData.contactType === "email") cost = pricing.email;
      if (invitationData.contactType === "phone") cost = pricing.sms;
      const amount = cost * (invitationData.qrCodeCount || 1);

      // Initiate Payment with new Direct Payment Endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            amount,
            paymentReason: `Invitation for ${invitationData.selectedEvent?.title}`,
            phoneNumber,
            paymentMethod,
            invitationData: {
              ...invitationData,
              selectedEvent: {
                id: invitationData.selectedEvent?.id,
                title: invitationData.selectedEvent?.title,
              },
              organizerId: localStorage.getItem("userId"),
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Payment initiation failed");

      if (data.transactionId) {
        // Start Polling
        const interval = setInterval(() => {
          pollPaymentStatus(data.transactionId);
        }, 3000);
        setPollingInterval(interval);
        toast.info("Payment initiated. Please confirm on your phone.");
      } else {
        throw new Error("No transaction ID returned");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
      setIsSantimLoading(false);
    }
  };

  const handleDownloadTicket = () => {
    // Placeholder for download logic
    toast.info("Download ticket functionality");
  };

  const [activePaymentProvider, setActivePaymentProvider] = useState<
    "SANTIM" | "CHAPA"
  >("CHAPA");

  return {
    // State
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    attendeesPage,
    setAttendeesPage,
    attendeesPerPage,
    isLoading,
    attendeesLoading,

    // Data
    events,
    sentInvitations,
    attendees,
    filteredEvents,
    filteredInvitations,
    totalPages,
    stats,
    pricing,

    // Modals
    showInviteModal,
    setShowInviteModal,
    showBulkModal,
    setShowBulkModal,
    showQRModal,
    setShowQRModal,
    showDetailsModal,
    setShowDetailsModal,
    showAttendeesModal,
    setShowAttendeesModal,
    showEventDetailsModal,
    setShowEventDetailsModal,
    showPaymentModal,
    setShowPaymentModal,

    // Selection
    selectedEvent,
    setSelectedEvent,
    selectedInvitation,
    setSelectedInvitation,
    selectedEventAttendees,
    setSelectedEventAttendees,
    selectedEventDetails,
    setSelectedEventDetails,
    pendingInvitation,
    setPendingInvitation,
    selectedFile,
    setSelectedFile,

    // Form
    contact,
    setContact,
    contactType,
    setContactType,
    customerName,
    setCustomerName,
    message,
    setMessage,
    qrCodeCount,
    setQrCodeCount,
    guestType,
    setGuestType,
    selectedTicketType,
    setSelectedTicketType,
    isSubmitting,
    isSantimLoading,

    // Handlers
    handleEventSelect,
    handleViewDetails,
    handleViewQR,
    handleInviteClick,
    handleBulkInviteClick,
    handleViewAttendees,
    handleViewEventDetails,
    handleSendInvite,
    handleSantimPayment,
    handleDownloadTicket,
    processPendingInvitation,
    activePaymentProvider,
  };
}
