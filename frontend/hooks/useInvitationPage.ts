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
  contactType: "email" | "phone";
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
  };

  useEffect(() => {
    setMounted(true);

    const checkAuth = () => {
      const authState = localStorage.getItem("auth-storage");
      if (!authState) return false;

      try {
        const { state } = JSON.parse(authState);
        const { user, token, isAuthenticated } = state;

        if (!isAuthenticated || !token || user.role !== "organizer")
          return false;

        localStorage.setItem("userId", user._id);
        localStorage.setItem("userRole", user.role);
        localStorage.setItem("token", token);

        return true;
      } catch (error) {
        console.error("Error parsing auth state:", error);
        return false;
      }
    };

    if (checkAuth()) {
      const userId = localStorage.getItem("userId");
      if (userId) {
        loadEvents(userId);
        // Fetch invitations after auth is confirmed
        fetchSentInvitations();
      }
    } else {
      // Try fetching anyway if userId exists in localStorage
      fetchSentInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const actionText =
      guestType === "paid" ? "Buy Ticket" : "Confirm Attendance";
    const actionDescription =
      guestType === "paid"
        ? "Click below to purchase your ticket"
        : "Click the link below to confirm your attendance";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Invitation</title>
  <style>
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      padding: 15px 40px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: 700;
      font-size: 18px;
      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(102, 126, 234, 0.6);
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉 You're Invited!</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Join us for an amazing event</p>
    </div>
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #1a202c; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${
          event?.title
        }</h2>
        <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.5;">${
          event?.description || "We're excited to have you join us!"
        }</p>
      </div>
      <div style="background: #f7fafc; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
        <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📅 Event Details</h3>
        <div style="display: grid; gap: 10px;">
          <div style="display: flex; align-items: center;">
            <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">📆 Date:</span>
            <span style="color: #4a5568;">${event?.date}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">⏰ Time:</span>
            <span style="color: #4a5568;">${event?.time}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">📍 Location:</span>
            <span style="color: #4a5568;">${event?.location}</span>
          </div>
        </div>
      </div>
      ${
        message
          ? `<div style="background: #edf2f7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 3px solid #4299e1;">
        <h4 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Personal Message:</h4>
        <p style="color: #4a5568; margin: 0; line-height: 1.6; font-style: italic;">${message}</p>
      </div>`
          : ""
      }
      <div style="text-align: center; margin: 30px 0;">
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎫 ${
            guestType === "paid" ? "Get Your Ticket" : "Quick RSVP"
          }</h3>
          <p style="color: #f0fff4; margin: 0 0 15px 0; font-size: 14px;">${actionDescription}</p>
          <a href="${qrLink}" class="button">${actionText}</a>
        </div>
      </div>
    </div>
    <div style="background: #2d3748; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
      <div style="margin-bottom: 20px;">
        <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 30px; opacity: 0.8;" />
      </div>
      <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
    </div>
  </div>
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

  const handleViewAttendees = (event: Event) => {
    setShowAttendeesModal(true);
    setSelectedEventAttendees(event);

    try {
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      if (!userId || !token) {
        setAttendees([]);
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
        setAttendees(formattedAttendees);
      } else {
        setAttendees([]);
      }
    } catch (error) {
      console.error("Error fetching attendees:", error);
      setAttendees([]);
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
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation`,
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
              ticketType: "Guest",
            }),
          }
        );

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

      const eventDetails = `Event: ${selectedEvent?.title}\nDate and Time: ${selectedEvent?.date} ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}\n\nRSVP Link: ${qrCodeLink}`;
      const smsInviteMessage = message
        ? `${message}\n\n${eventDetails}`
        : `\n\n${eventDetails}`;

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

        const smsMessage = `Hi ${customerName}, ${smsInviteMessage}`;
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
    if (currentUsage + qrCodeCount > 6) {
      toast.error(`Cannot send ${qrCodeCount} QR codes. Max 6 per contact.`);
      return;
    }

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
  };
}
