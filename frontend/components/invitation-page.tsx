"use client";
import { useState, useEffect } from "react";
import type React from "react";
import QRCode from "qrcode";

import {
  Mail,
  Plus,
  Phone,
  Send,
  Upload,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  CheckCircle,
  XCircle,
  DollarSign,
  QrCode,
  Download,
  Search,
  Info,
  CreditCard,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import QRModal from "@/components/QRModal";
import { Button } from "./ui/button";
import FileUploadComponent from "./DocumentPreview";
import BulkInvite from "./bulkInviteModel";
import { useRouter, useSearchParams } from "next/navigation";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  description?: string;
  status?: string;
  eventType?: "public" | "private";
  isPublic?: boolean;
}

export default function InvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pricing, setPricing] = useState({
    email: 2.5,
    sms: 7.5,
  });

  const [events, setEvents] = useState<Event[]>([]);

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

  useEffect(() => {
    const checkAuth = () => {
      const authState = localStorage.getItem("auth-storage");
      if (!authState) {
        return false;
      }

      try {
        const { state } = JSON.parse(authState);
        const { user, token, isAuthenticated } = state;

        if (!isAuthenticated || !token || user.role !== "organizer") {
          return false;
        }

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
      }
    }
    fetchSentInvitations();
  }, []);

  const loadEvents = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

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
          eventType: event.eventType || "public",
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
        const invitations = data.data || data.invitations || [];
        const formattedInvitations = invitations.map((inv: any) => ({
          id: inv._id,
          eventTitle: inv.eventTitle || inv.eventId?.title || "Unknown Event",
          customerName: inv.customerName,
          contact: inv.contact,
          contactType: inv.contactType,
          guestType: inv.guestType || "guest",
          qrCodeCount: inv.qrCodeCount || 1,
          message: inv.message,
          sentAt: new Date(inv.createdAt).toLocaleString(),
          status: inv.status,
          qrCode: inv.qrCode,
        }));
        setSentInvitations(formattedInvitations);
      }
    } catch (error) {
      console.error("Error fetching sent invitations:", error);
    }
  };

  const [contact, setContact] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [qrCodeCount, setQrCodeCount] = useState(1);
  const [guestType, setGuestType] = useState<"guest" | "paid">("guest");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sentInvitations, setSentInvitations] = useState<
    Array<{
      id: number;
      eventTitle: string;
      customerName: string;
      contact: string;
      contactType: "email" | "phone";
      guestType: "guest" | "paid";
      qrCodeCount: number;
      message?: string;
      sentAt: string;
      status: "sent" | "delivered" | "failed";
      qrCode: string;
    }>
  >([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<string>("");
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [qrCodeUsage, setQrCodeUsage] = useState<Record<string, number>>({});
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [qrCodesPage, setQrCodesPage] = useState(1);
  const qrCodesPerPage = 3;
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [selectedEventAttendees, setSelectedEventAttendees] =
    useState<Event | null>(null);
  const [attendees, setAttendees] = useState<
    Array<{
      id: string;
      customerName: string;
      contact: string;
      guestType: string;
      confirmedAt: string;
      status: string;
    }>
  >([]);
  const [attendeesPage, setAttendeesPage] = useState(1);
  const attendeesPerPage = 5;
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any>(null);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSantimLoading, setIsSantimLoading] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState("Telebirr");
  const [payerPhone, setPayerPhone] = useState("");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    setIsMounted(true);
    setMounted(true);
  }, []);

  // Pagination and filtering states
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsFilter, setEventsFilter] = useState("");
  const [invitationsPage, setInvitationsPage] = useState(1);
  const [invitationsFilter, setInvitationsFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "sent" | "delivered" | "failed"
  >("all");
  const [contactTypeFilter, setContactTypeFilter] = useState<
    "all" | "email" | "phone"
  >("all");
  const itemsPerPage = 5;

  const handleInviteClick = (event: Event) => {
    setSelectedEvent(event);
    fetchPricing(event.eventType || "public");
    setShowInviteModal(true);
  };

  const generateQRCode = async (
    eventId: number,
    customerName: string,
    contact: string,
    guestType: "guest" | "paid" = "guest"
  ) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;

      let qrUrl: string;
      if (guestType === "paid") {
        qrUrl = `${baseUrl}/event_detail?id=${eventId}`;
      } else {
        // For guest type, include event and customer details in QR code
        const guestData = {
          eventId,
          customerName,
          contact,
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
        color: {
          dark: "#0D47A1",
          light: "#FFFFFF",
        },
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
    qrLink: string
  ) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 50px; margin-bottom: 20px;" />
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉 You're Invited!</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Join us for an amazing event</p>
    </div>
    
    <!-- Content -->
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
      
      <!-- RSVP Section -->
      <div style="text-align: center; margin: 30px 0;">
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎫 Quick RSVP</h3>
          <p style="color: #f0fff4; margin: 0 0 15px 0; font-size: 14px;">Scan the QR code or click the link below to confirm your attendance</p>
          <a href="${qrLink}" style="display: inline-block; background: #ffffff; color: #38a169; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease;">🔗 RSVP Now</a>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #2d3748; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
      <div style="margin-bottom: 20px;">
        <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 30px; opacity: 0.8;" />
      </div>
      <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
      <p style="color: #718096; margin: 0; font-size: 12px;">Professional event management platform</p>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #4a5568;">
        <p style="color: #718096; margin: 0; font-size: 11px;">This invitation was sent via Pazimo Events Platform. If you have any questions, please contact the event organizer.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  const sendEmail = async (to: string, subject: string, htmlBody: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/send-invitation-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone,
            message: message,
          }),
        }
      );
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("SMS send error:", error);
      return false;
    }
  };

  const handleSendInvite = async () => {
    if (!contact || !customerName) {
      alert("Please enter customer name and contact information");
      return;
    }

    // Check if event is published
    if (selectedEvent?.status !== "published") {
      alert("This event must be published by admin before sending invitations");
      return;
    }

    // Check QR code limit for this contact
    const currentUsage = qrCodeUsage[contact] || 0;
    if (currentUsage + qrCodeCount > 6) {
      alert(
        `Cannot send ${qrCodeCount} QR codes. This contact can only receive ${
          6 - currentUsage
        } more QR codes (maximum 6 total)`
      );
      return;
    }

    // Validate contact based on type
    if (contactType === "email" && !validateEmail(contact)) {
      alert("Please enter a valid email address");
      return;
    }

    if (contactType === "phone" && !validatePhoneNumber(contact)) {
      alert(
        "Please enter a valid Ethiopian phone number (+251911234567 or 0911234567)"
      );
      return;
    }

    // Check if payment should be skipped
    const shouldSkipPayment =
      (selectedEvent?.eventType === "private" ||
        selectedEvent?.eventType === "public") &&
      guestType === "paid" &&
      selectedEvent?.ticketTypes?.some((ticket: any) => ticket.price > 0);

    // Store invitation data
    setPendingInvitation({
      contact,
      customerName,
      message,
      qrCodeCount,
      guestType,
      contactType,
      selectedEvent,
    });

    setShowInviteModal(false);

    if (shouldSkipPayment) {
      // Skip payment and send invitation directly
      await processPendingInvitation();
    } else {
      // Show payment modal
      setShowPaymentModal(true);
    }
  };

  const processPendingInvitation = async () => {
    if (!pendingInvitation) return;

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
      } = pendingInvitation;

      // Generate single QR code
      const qrCodeData = await generateQRCode(
        selectedEvent?.id || 0,
        customerName,
        contact,
        guestType
      );
      const qrCodeLink = qrCodeData.url;
      const eventDetails = `Event: ${selectedEvent?.title}\nDate: ${selectedEvent?.date}\nTime: ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}\n\nRSVP Link: ${qrCodeLink}`;
      const inviteMessage = message
        ? `${message}\n\n${eventDetails}`
        : `You're invited to ${selectedEvent?.title}!\n\n${eventDetails}`;

      let success = false;

      if (contactType === "email") {
        const subject = `🎉 You're Invited: ${selectedEvent?.title}`;
        const emailBody = createEmailTemplate(
          customerName,
          selectedEvent,
          inviteMessage,
          qrCodeLink
        );
        success = await sendEmail(contact, subject, emailBody);
      } else {
        // Format phone number for SMS API
        let formattedPhone = contact.replace(/\s+/g, "");
        if (formattedPhone.startsWith("0")) {
          formattedPhone = "+251" + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith("+251")) {
          formattedPhone = "+251" + formattedPhone;
        }

        const smsMessage = `Hi ${customerName}, ${inviteMessage}`;
        success = await sendSMS(formattedPhone, smsMessage);
      }

      const newInvitation = {
        id: Date.now(),
        eventId: selectedEvent?.id,
        eventTitle: selectedEvent?.title || "",
        customerName,
        contact,
        contactType,
        guestType,
        qrCodeCount,
        message,
        sentAt: new Date().toLocaleString(),
        status: success ? ("delivered" as const) : ("failed" as const),
        qrCode: qrCodeLink,
      };

      // Save to database
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
            }),
          });
        }
      } catch (error) {
        console.error("Error saving invitation to database:", error);
      }

      setSentInvitations((prev) => [newInvitation, ...prev]);

      // Update QR code usage
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
        alert(
          `Invitation sent successfully to ${customerName} via ${contactType}!`
        );
      } else {
        alert(
          `Failed to send invitation to ${customerName}. Please try again.`
        );
      }
    } catch (error) {
      console.error("Send invitation error:", error);
      alert(
        "An error occurred while sending the invitation. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkInviteClick = (event: Event) => {
    setSelectedEvent(event);
    setShowBulkModal(true);
  };

  const handleViewAttendees = async (event: Event) => {
    setSelectedEventAttendees(event);
    setShowAttendeesModal(true);

    try {
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      if (!userId || !token) {
        setAttendees([]);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/event/${event.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const invitations = data.data || data.invitations || [];
        const formattedAttendees = invitations.map((inv: any) => ({
          id: inv._id,
          customerName: inv.customerName,
          contact: inv.contact,
          guestType: inv.guestType || "guest",
          confirmedAt: inv.rsvpConfirmedAt
            ? new Date(inv.rsvpConfirmedAt).toLocaleDateString()
            : "Not confirmed",
          status: inv.rsvpStatus || "pending",
        }));
        setAttendees(formattedAttendees);
      } else {
        setAttendees([]);
      }
    } catch (error) {
      console.error("Error fetching attendees:", error);
      setAttendees([]);
    }
  };

  const handleViewEventDetails = async (event: any) => {
    try {
      // Show modal with event info immediately
      setSelectedEventDetails({
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        status: event.status,
        eventType: event.eventType,
        capacity: event.capacity,
        ticketTypes: event.ticketTypes || [],
        tags: event.tags || [],
        category: event.category,
        ageRestriction: event.ageRestriction,
      });
      setShowEventDetailsModal(true);

      // Try to fetch detailed info from API if available
      if (typeof window !== "undefined" && (event._id || event.id)) {
        const token = localStorage.getItem("token");

        if (token && process.env.NEXT_PUBLIC_API_URL) {
          const eventId = event._id || event.id;
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`,
            {
              headers: {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (
        validTypes.includes(file.type) ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")
      ) {
        setSelectedFile(file);
      } else {
        alert("Please select a valid CSV or Excel file");
      }
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // Ethiopian phone number validation
    const phoneRegex = /^(\+251|0)?[79]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ""));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const processBulkFile = (
    file: File
  ): Promise<
    Array<{
      name: string;
      contact: string;
      type: "email" | "phone";
      message?: string;
    }>
  > => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").slice(1); // Skip header
          const contacts = lines
            .filter((line) => line.trim())
            .map((line) => {
              const [name, contact, type, message] = line.split(",");
              const cleanContact = contact?.trim();
              const contactType = type?.trim() as "email" | "phone";

              // Validate contact based on type
              let isValid = false;
              if (contactType === "email") {
                isValid = validateEmail(cleanContact);
              } else if (contactType === "phone") {
                isValid = validatePhoneNumber(cleanContact);
              }

              return {
                name: name?.trim(),
                contact: cleanContact,
                type: contactType,
                message: message?.trim(),
                isValid,
              };
            })
            .filter(
              (contact) =>
                contact.name &&
                contact.contact &&
                contact.isValid &&
                (contact.type === "email" || contact.type === "phone")
            );
          resolve(contacts);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleBulkSend = async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    // Check if event is published
    if (selectedEvent?.status !== "published") {
      alert("This event must be published by admin before sending invitations");
      return;
    }

    setIsSubmitting(true);

    try {
      const contacts = await processBulkFile(selectedFile);
      const eventDetails = `Event: ${selectedEvent?.title}\nDate: ${selectedEvent?.date}\nTime: ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}`;

      // Filter contacts based on QR code limits
      const validContacts = contacts.filter((contact) => {
        const currentUsage = qrCodeUsage[contact.contact] || 0;
        return currentUsage < 6;
      });

      if (validContacts.length < contacts.length) {
        const skippedCount = contacts.length - validContacts.length;
        alert(
          `${skippedCount} contacts skipped due to QR code limit (6 per contact)`
        );
      }

      const results = await Promise.allSettled(
        validContacts.map(async (contact) => {
          const qrCodeData = await generateQRCode(
            selectedEvent?.id || 0,
            contact.name,
            contact.contact,
            "guest"
          );
          const qrCodeLink = qrCodeData.url;
          const eventDetailsWithQR = `Event: ${selectedEvent?.title}\nDate: ${selectedEvent?.date}\nTime: ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}\n\nRSVP Link: ${qrCodeLink}`;
          const inviteMessage = contact.message
            ? `${contact.message}\n\n${eventDetailsWithQR}`
            : `You're invited to ${selectedEvent?.title}!\n\n${eventDetailsWithQR}`;

          let success = false;
          if (contact.type === "email") {
            const subject = `🎉 You're Invited: ${selectedEvent?.title}`;
            const emailBody = createEmailTemplate(
              contact.name,
              selectedEvent,
              inviteMessage,
              qrCodeLink
            );
            success = await sendEmail(contact.contact, subject, emailBody);
          } else {
            // Format phone number for SMS API
            let formattedPhone = contact.contact.replace(/\s+/g, "");
            if (formattedPhone.startsWith("0")) {
              formattedPhone = "+251" + formattedPhone.substring(1);
            } else if (!formattedPhone.startsWith("+251")) {
              formattedPhone = "+251" + formattedPhone;
            }

            const smsMessage = `Hi ${contact.name}, ${inviteMessage}`;
            success = await sendSMS(formattedPhone, smsMessage);
          }

          return {
            id: Date.now() + Math.random(),
            eventTitle: selectedEvent?.title || "",
            customerName: contact.name,
            contact: contact.contact,
            contactType: contact.type,
            message: contact.message,
            sentAt: new Date().toLocaleString(),
            status: success ? ("delivered" as const) : ("failed" as const),
            qrCode: qrCodeData.url,
          };
        })
      );

      const bulkInvitations = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      setSentInvitations((prev) => [...bulkInvitations, ...prev]);

      // Update QR code usage for all processed contacts
      const usageUpdates: Record<string, number> = {};
      validContacts.forEach((contact) => {
        usageUpdates[contact.contact] = (qrCodeUsage[contact.contact] || 0) + 1;
      });
      setQrCodeUsage((prev) => ({ ...prev, ...usageUpdates }));

      const successCount = bulkInvitations.filter(
        (inv) => inv.status === "delivered"
      ).length;
      const failCount = bulkInvitations.length - successCount;

      setSelectedFile(null);
      setShowBulkModal(false);
      alert(
        `Bulk invitations processed: ${successCount} sent successfully, ${failCount} failed.`
      );
    } catch (error) {
      console.error("Bulk send error:", error);
      alert(
        "Error processing bulk invitations. Please check your file format."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = (type: "mixed" | "email" | "phone") => {
    let csvContent = "";
    let filename = "";

    if (type === "email") {
      csvContent = `Customer Name,Email,Contact Type,Message
John Doe,john@example.com,email,Welcome to our amazing event!
Jane Smith,jane@company.com,email,You're invited to join us
Mike Johnson,mike.johnson@company.com,email,Looking forward to seeing you there
Sarah Wilson,sarah@email.com,email,Don't miss this exclusive event
David Brown,david@email.com,email,Save the date for our special gathering`;
      filename = "email-invitation-template.csv";
    } else if (type === "phone") {
      csvContent = `Customer Name,Phone,Contact Type,Message
John Doe,+251911234567,phone,Welcome to our amazing event!
Jane Smith,0922345678,phone,You're invited to join us
Mike Johnson,+251933456789,phone,Looking forward to seeing you there
Sarah Wilson,0944567890,phone,Don't miss this exclusive event
David Brown,+251955678901,phone,Save the date for our special gathering`;
      filename = "sms-invitation-template.csv";
    } else {
      csvContent = `Customer Name,Email or Phone,Contact Type,Message
John Doe,john@example.com,email,Welcome to our amazing event!
Jane Smith,+251911234567,phone,Don't miss this exclusive gathering
Mike Johnson,mike.johnson@company.com,email,You're invited to join us
Sarah Wilson,0922345678,phone,Save the date for our special event
David Brown,david@email.com,email,Looking forward to seeing you there`;
      filename = "mixed-invitation-template.csv";
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter and paginate events
  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(eventsFilter.toLowerCase()) ||
      event.organizer.toLowerCase().includes(eventsFilter.toLowerCase()) ||
      event.location.toLowerCase().includes(eventsFilter.toLowerCase())
  );
  const eventsStartIndex = (eventsPage - 1) * itemsPerPage;
  const paginatedEvents = filteredEvents.slice(
    eventsStartIndex,
    eventsStartIndex + itemsPerPage
  );
  const totalEventsPages = Math.ceil(filteredEvents.length / itemsPerPage);

  // Filter and paginate invitations
  const filteredInvitations = sentInvitations.filter((inv) => {
    const matchesSearch =
      inv.eventTitle.toLowerCase().includes(invitationsFilter.toLowerCase()) ||
      inv.customerName
        .toLowerCase()
        .includes(invitationsFilter.toLowerCase()) ||
      inv.contact.toLowerCase().includes(invitationsFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesContactType =
      contactTypeFilter === "all" || inv.contactType === contactTypeFilter;
    return matchesSearch && matchesStatus && matchesContactType;
  });
  const invitationsStartIndex = (invitationsPage - 1) * itemsPerPage;
  const paginatedInvitations = filteredInvitations.slice(
    invitationsStartIndex,
    invitationsStartIndex + itemsPerPage
  );
  const totalInvitationsPages = Math.ceil(
    filteredInvitations.length / itemsPerPage
  );

  const totalInvitations = sentInvitations.length;
  const emailInvitations = sentInvitations.filter(
    (inv) => inv.contactType === "email"
  ).length;
  const smsInvitations = sentInvitations.filter(
    (inv) => inv.contactType === "phone"
  ).length;
  const deliveredInvitations = sentInvitations.filter(
    (inv) => inv.status === "delivered"
  ).length;
  const deliveryRate =
    totalInvitations > 0
      ? Math.round((deliveredInvitations / totalInvitations) * 100)
      : 0;
  const publicEvents = events.filter(
    (event) => event.eventType === "public"
  ).length;
  const privateEvents = events.filter(
    (event) => event.eventType === "private"
  ).length;

  const emailCost = emailInvitations * pricing.email;
  const smsCost = smsInvitations * pricing.sms;
  const totalCost = emailCost + smsCost;

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
      } else if (data.status === "FAILED") {
        if (pollingInterval) clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsSantimLoading(false);
        toast.error("Payment failed. Please try again.");
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  const handleSantimPayment = async () => {
    if (!pendingInvitation) return;
    if (!payerPhone) {
      toast.error("Please enter a payer phone number");
      return;
    }

    setIsSantimLoading(true);
    try {
      const { contact, customerName, qrCodeCount, contactType, selectedEvent } =
        pendingInvitation;

      const pricePerInvite =
        contactType === "email" ? pricing.email : pricing.sms;
      const amount = pricePerInvite * (qrCodeCount || 1);

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
            paymentReason: `Invitation for ${selectedEvent?.title}`,
            phoneNumber: payerPhone,
            invitationData: {
              ...pendingInvitation,
              selectedEvent: {
                id: selectedEvent?.id,
                title: selectedEvent?.title,
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
      } else {
        throw new Error("No transaction ID returned");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
      setIsSantimLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Total Invitations
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalInvitations}
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Email Invitations
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {emailInvitations}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {emailCost.toFixed(2)} ETB
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  SMS Invitations
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {smsInvitations}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {smsCost.toFixed(2)} ETB
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Delivery Rate
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {deliveryRate}%
                </p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalCost.toFixed(2)} ETB
                </p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Public Events
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {publicEvents}
                </p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Private Events
                </p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {privateEvents}
                </p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Events Table Section */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Events</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={eventsFilter}
                    onChange={(e) => setEventsFilter(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organizer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewEventDetails(event)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {event.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {event.description || "No description"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{event.date}</div>
                      <div className="text-sm text-gray-500">{event.time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {event.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.isPublic === false
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {event.isPublic === false ? "private" : "public"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {event.organizer}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.status === "active"
                            ? "bg-green-100 text-green-800"
                            : event.status === "upcoming"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {event.status || "upcoming"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInviteClick(event);
                        }}
                        disabled={event.status !== "published"}
                        className={`mr-3 ${
                          event.status === "published"
                            ? "text-blue-600 hover:text-blue-900"
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          event.status !== "published"
                            ? "Event must be published by admin first"
                            : ""
                        }
                      >
                        Send Invites
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBulkInviteClick(event);
                        }}
                        disabled={event.status !== "published"}
                        className={
                          event.status === "published"
                            ? "text-gray-600 hover:text-gray-900"
                            : "text-gray-400 cursor-not-allowed"
                        }
                        title={
                          event.status !== "published"
                            ? "Event must be published by admin first"
                            : ""
                        }
                      >
                        Bulk Invite
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAttendees(event);
                        }}
                        className="text-green-600 hover:text-green-900 ml-3"
                      >
                        View Attendees
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Events Pagination */}
          {totalEventsPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {eventsStartIndex + 1} to{" "}
                {Math.min(
                  eventsStartIndex + itemsPerPage,
                  filteredEvents.length
                )}{" "}
                of {filteredEvents.length} events
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEventsPage(Math.max(1, eventsPage - 1))}
                  disabled={eventsPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {eventsPage} of {totalEventsPages}
                </span>
                <button
                  onClick={() =>
                    setEventsPage(Math.min(totalEventsPages, eventsPage + 1))
                  }
                  disabled={eventsPage === totalEventsPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {mounted && showInviteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full p-6 md:p-8 shadow-xl">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                Professional Invitation
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Sending invitation for:{" "}
                <strong className="text-gray-900">
                  {selectedEvent?.title}
                </strong>
              </p>

              <div className="space-y-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                    required
                  />
                </div>

                {/* Contact Method and Guest Type Row */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Contact Method
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="contactType"
                          value="email"
                          checked={contactType === "email"}
                          onChange={(e) =>
                            setContactType(e.target.value as "email" | "phone")
                          }
                          className="w-4 h-4"
                        />
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-900">
                          Email ({pricing.email} ETB)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="contactType"
                          value="phone"
                          checked={contactType === "phone"}
                          onChange={(e) =>
                            setContactType(e.target.value as "email" | "phone")
                          }
                          className="w-4 h-4"
                        />
                        <Phone className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-900">
                          SMS ({pricing.sms} ETB)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Guest Type
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="guestType"
                          value="guest"
                          checked={guestType === "guest"}
                          onChange={(e) =>
                            setGuestType(e.target.value as "guest" | "paid")
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-900">
                          Guest (Free)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="guestType"
                          value="paid"
                          checked={guestType === "paid"}
                          onChange={(e) =>
                            setGuestType(e.target.value as "guest" | "paid")
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-900">
                          Paid Attendee
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Contact Input and QR Code Count Row */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      {contactType === "email"
                        ? "Email Address"
                        : "Phone Number"}
                    </label>
                    <input
                      type={contactType === "email" ? "email" : "tel"}
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder={
                        contactType === "email"
                          ? "Enter email address"
                          : "Enter phone number (+251911234567)"
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      required
                    />
                    {contactType === "phone" && (
                      <p className="text-xs text-gray-600 mt-1">
                        Ethiopian format: +251911234567 or 0911234567
                      </p>
                    )}
                  </div>

                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      QR Codes
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={qrCodeCount}
                      onChange={(e) =>
                        setQrCodeCount(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-600 mt-1">Max 10</p>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal message to the invitation"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  />
                </div>

                {/* Cost Summary */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {(() => {
                    const shouldSkipPayment =
                      (selectedEvent?.eventType === "private" ||
                        selectedEvent?.eventType === "public") &&
                      guestType === "paid" &&
                      selectedEvent?.ticketTypes?.some(
                        (ticket: any) => ticket.price > 0
                      );

                    if (shouldSkipPayment) {
                      return (
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600 mb-2">
                            FREE INVITATION
                          </div>
                          <div className="text-xs text-gray-500">
                            No charges for paid attendees in events with paid
                            tickets
                          </div>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span>Invitation Cost:</span>
                          <span className="font-medium text-gray-900">
                            {(
                              (contactType === "email"
                                ? pricing.email
                                : pricing.sms) * qrCodeCount
                            ).toFixed(2)}{" "}
                            ETB
                          </span>
                        </div>
                        <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-gray-900">
                            {(
                              (contactType === "email"
                                ? pricing.email
                                : pricing.sms) * qrCodeCount
                            ).toFixed(2)}{" "}
                            ETB
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {qrCodeCount} QR code{qrCodeCount > 1 ? "s" : ""} via{" "}
                          {contactType === "email" ? "Email" : "SMS"}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={!contact || !customerName || isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                >
                  {isSubmitting
                    ? "Processing..."
                    : //FIXME:

                    (selectedEvent?.eventType === "private" ||
                        selectedEvent?.eventType === "public") &&
                      guestType === "paid" &&
                      selectedEvent?.ticketTypes?.some(
                        (ticket: any) => ticket.price > 0
                      )
                    ? "Send Invitation"
                    : "Proceed to Payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {mounted && showBulkModal && (
          <BulkInvite
            setShowBulkModal={setShowBulkModal}
            event={selectedEvent}
          />
        )}

        <div className="mt-8 md:mt-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl md:text-md font-bold text-gray-900">
              Sent Invitations
            </h2>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-gray-900 font-medium">
                  {deliveredInvitations} Delivered
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                <XCircle className="h-4 w-4 text-gray-600" />
                <span className="text-gray-900 font-medium">
                  {totalInvitations - deliveredInvitations} Pending
                </span>
              </div>
            </div>
          </div>

          {/* Invitations Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by event, customer, or contact..."
              value={invitationsFilter}
              onChange={(e) => setInvitationsFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "sent" | "delivered" | "failed"
                )
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={contactTypeFilter}
              onChange={(e) =>
                setContactTypeFilter(
                  e.target.value as "all" | "email" | "phone"
                )
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Methods</option>
              <option value="email">Email</option>
              <option value="phone">SMS</option>
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                      Event
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden sm:table-cell">
                      Customer
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                      Contact
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden md:table-cell">
                      Method
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                      Guest Type
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                      QR Count
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                      Sent At
                    </th>
                    <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvitations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 md:px-6 py-8 text-center text-gray-500"
                      >
                        {sentInvitations.length === 0
                          ? "No invitations sent yet"
                          : "No invitations match your filters"}
                      </td>
                    </tr>
                  ) : (
                    paginatedInvitations.map((invitation) => (
                      <tr
                        key={invitation.id}
                        onClick={() => {
                          setSelectedInvitation(invitation);
                          setShowDetailsModal(true);
                        }}
                        className="border-t border-gray-200 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="px-4 md:px-6 py-4">
                          <div className="font-medium text-gray-900 text-sm md:text-base">
                            {invitation.eventTitle}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 hidden sm:table-cell">
                          {invitation.customerName}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {invitation.contact}
                          </div>
                          {invitation.message && (
                            <div className="text-xs text-gray-600 mt-1">
                              "{invitation.message}"
                            </div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            {invitation.contactType === "email" ? (
                              <Mail className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Phone className="h-4 w-4 text-blue-600" />
                            )}
                            <span className="capitalize">
                              {invitation.contactType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              invitation.guestType === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {invitation.guestType === "paid" ? "Paid" : "Guest"}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm text-gray-900">
                            {invitation.qrCodeCount}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-600 hidden lg:table-cell">
                          {invitation.sentAt}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${
                              invitation.status === "sent"
                                ? "bg-blue-50 text-blue-600 border border-blue-200"
                                : invitation.status === "delivered"
                                ? "bg-green-50 text-green-600 border border-green-200"
                                : "bg-red-50 text-red-600 border border-red-200"
                            }`}
                          >
                            {invitation.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Invitations Pagination */}
            {totalInvitationsPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {invitationsStartIndex + 1} to{" "}
                  {Math.min(
                    invitationsStartIndex + itemsPerPage,
                    filteredInvitations.length
                  )}{" "}
                  of {filteredInvitations.length} invitations
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setInvitationsPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={invitationsPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm">
                    Page {invitationsPage} of {totalInvitationsPages}
                  </span>
                  <button
                    onClick={() =>
                      setInvitationsPage((prev) =>
                        Math.min(prev + 1, totalInvitationsPages)
                      )
                    }
                    disabled={invitationsPage === totalInvitationsPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {mounted && showQRModal && selectedInvitation && (
          <QRModal
            invitation={selectedInvitation}
            onClose={() => {
              setShowQRModal(false);
              setQrCodesPage(1);
            }}
          />
        )}

        {mounted && showAttendeesModal && selectedEventAttendees && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                  Event Attendees
                </h3>
                <button
                  onClick={() => setShowAttendeesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <h4 className="font-medium text-gray-900">
                  {selectedEventAttendees.title}
                </h4>
                <p className="text-sm text-gray-600">
                  {selectedEventAttendees.date} at {selectedEventAttendees.time}
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Contact
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-6 text-center text-gray-500"
                          >
                            No attendees found
                          </td>
                        </tr>
                      ) : (
                        attendees
                          .slice(
                            (attendeesPage - 1) * attendeesPerPage,
                            attendeesPage * attendeesPerPage
                          )
                          .map((attendee) => (
                            <tr key={attendee.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {attendee.customerName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {attendee.guestType === "paid"
                                    ? "Paid"
                                    : "Guest"}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="text-sm text-gray-900">
                                  {attendee.contact}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {attendee.confirmedAt}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    attendee.status === "confirmed"
                                      ? "bg-green-100 text-green-800"
                                      : attendee.status === "declined"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {attendee.status.charAt(0).toUpperCase() +
                                    attendee.status.slice(1)}
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Total: {attendees.length} | Page {attendeesPage} of{" "}
                  {Math.ceil(attendees.length / attendeesPerPage) || 1}
                </div>
                <div className="flex gap-2">
                  {Math.ceil(attendees.length / attendeesPerPage) > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setAttendeesPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={attendeesPage === 1}
                        className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() =>
                          setAttendeesPage((prev) =>
                            Math.min(
                              prev + 1,
                              Math.ceil(attendees.length / attendeesPerPage)
                            )
                          )
                        }
                        disabled={
                          attendeesPage ===
                          Math.ceil(attendees.length / attendeesPerPage)
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowAttendeesModal(false)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mounted && showDetailsModal && selectedInvitation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 md:p-8 shadow-xl">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-6">
                Invitation Details
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Customer
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedInvitation.customerName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Event
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedInvitation.eventTitle}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Contact Method
                    </label>
                    <div className="flex items-center gap-1">
                      {selectedInvitation.contactType === "email" ? (
                        <Mail className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Phone className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-sm text-gray-900 capitalize">
                        {selectedInvitation.contactType}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Guest Type
                    </label>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        selectedInvitation.guestType === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {selectedInvitation.guestType === "paid"
                        ? "Paid Attendee"
                        : "Guest (Free)"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      QR Codes
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedInvitation.qrCodeCount}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Status
                    </label>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        selectedInvitation.status === "delivered"
                          ? "bg-green-100 text-green-800"
                          : selectedInvitation.status === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selectedInvitation.status.charAt(0).toUpperCase() +
                        selectedInvitation.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Contact
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedInvitation.contact}
                  </p>
                </div>

                {selectedInvitation.message && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Message
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {selectedInvitation.message}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Sent At
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedInvitation.sentAt}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowQRModal(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  View QR Codes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        {mounted && showEventDetailsModal && selectedEventDetails && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-4xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Event Details
                </h3>
                <button
                  onClick={() => setShowEventDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

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
                        <p className="text-gray-900">
                          {selectedEventDetails.title}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Description
                        </p>
                        <p className="text-gray-600">
                          {selectedEventDetails.description ||
                            "No description available"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Category
                        </p>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                          {selectedEventDetails.category?.name ||
                            "Uncategorized"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Status
                        </p>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            selectedEventDetails.status === "published"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : selectedEventDetails.status === "draft"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : selectedEventDetails.status === "cancelled"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {selectedEventDetails.status}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Date & Time
                        </p>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>
                            Start:{" "}
                            {selectedEventDetails.startDate
                              ? new Date(
                                  selectedEventDetails.startDate
                                ).toLocaleDateString("en-US")
                              : selectedEventDetails.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 mt-1">
                          <span>
                            End:{" "}
                            {selectedEventDetails.endDate
                              ? new Date(
                                  selectedEventDetails.endDate
                                ).toLocaleDateString("en-US")
                              : "Same day"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Location
                        </p>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>
                            {selectedEventDetails.location?.address ||
                              selectedEventDetails.location ||
                              "No address"}
                            , {selectedEventDetails.location?.city || "No city"}
                            ,{" "}
                            {selectedEventDetails.location?.country ||
                              "No country"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Capacity
                        </p>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>{selectedEventDetails.capacity || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedEventDetails.tags &&
                  selectedEventDetails.tags.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-500">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEventDetails.tags.map(
                          (tag: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                            >
                              <span>{tag}</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Ticket Types */}
                {selectedEventDetails.ticketTypes &&
                  selectedEventDetails.ticketTypes.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold">Ticket Types</h3>
                      <div className="grid gap-4">
                        {selectedEventDetails.ticketTypes.map(
                          (ticket: any, index: number) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {ticket.name}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {ticket.description}
                                  </p>
                                  {ticket.startDate && ticket.endDate && (
                                    <p className="text-xs text-gray-400">
                                      Available:{" "}
                                      {new Date(
                                        ticket.startDate
                                      ).toLocaleDateString("en-US")}{" "}
                                      -{" "}
                                      {new Date(
                                        ticket.endDate
                                      ).toLocaleDateString("en-US")}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">
                                    {ticket.price} ETB
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Quantity: {ticket.quantity}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Available: {ticket.available ? "Yes" : "No"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowEventDetailsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {mounted && showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Payment Required
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Complete payment to send invitation for:{" "}
                <strong>{pendingInvitation?.selectedEvent?.title}</strong>
              </p>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Invitation Cost:</span>
                  <span>
                    {(
                      (pendingInvitation?.contactType === "email"
                        ? pricing.email
                        : pricing.sms) * (pendingInvitation?.qrCodeCount || 1)
                    ).toFixed(2)}{" "}
                    ETB
                  </span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>
                    {(
                      (pendingInvitation?.contactType === "email"
                        ? pricing.email
                        : pricing.sms) * (pendingInvitation?.qrCodeCount || 1)
                    ).toFixed(2)}{" "}
                    ETB
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payer Phone Number
                </label>
                <input
                  type="tel"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder="Enter phone number to charge (e.g., 09...)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Payment Method
                </label>
                <PaymentMethodSelector
                  phoneNumber={payerPhone}
                  selectedMethod={selectedPaymentMethod}
                  onSelect={setSelectedPaymentMethod}
                />
              </div>

              <Button
                onClick={handleSantimPayment}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg mb-4"
                disabled={isSantimLoading}
              >
                {isSantimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" /> Pay with SantimPay
                  </>
                )}
              </Button>

              <div className="mt-2">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPendingInvitation(null);
                    setShowInviteModal(true);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SantimPay Payment Handling */}
        {mounted && isSantimLoading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Processing Payment...
                </h3>
                <button
                  onClick={() => setIsSantimLoading(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600 text-center">
                  Please do not close this window. We are processing your
                  payment securely.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
