import QRCode from "qrcode";
import { toast } from "sonner";
import { Event, Invitation } from "@/types/invitation";

export const generateQRCode = async (
  eventId: number | string,
  customerName: string,
  contact: string,
  guestType: "guest" | "paid" = "guest",
  eventTitle: string = "Event",
  eventDate: string = "",
  eventTime: string = "",
  eventLocation: string = ""
) => {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
    let qrUrl: string;

    if (guestType === "paid") {
      qrUrl = `${baseUrl}/event_detail?id=${eventId}`;
    } else {
      const guestData = {
        eventId,
        customerName,
        contact,
        guestType: "guest",
        eventTitle,
        eventDate,
        eventTime,
        eventLocation,
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
    return { url: "", image: "" };
  }
};

export const createEmailTemplate = (
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
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 50px; margin-bottom: 20px;" />
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
          <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎫 Quick RSVP</h3>
          <p style="color: #f0fff4; margin: 0 0 15px 0; font-size: 14px;">Scan the QR code or click the link below to confirm your attendance</p>
          <a href="${qrLink}" style="display: inline-block; background: #ffffff; color: #38a169; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease;">🔗 RSVP Now</a>
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

export const sendEmail = async (
  to: string,
  subject: string,
  htmlBody: string
) => {
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

export const sendSMS = async (phone: string, message: string) => {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processInvitation = async (invitationData: any) => {
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

    const qrCodeData = await generateQRCode(
      selectedEvent?.id || selectedEvent?._id || 0,
      customerName,
      contact,
      guestType,
      selectedEvent?.title,
      selectedEvent?.date,
      selectedEvent?.time,
      selectedEvent?.location
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
      let formattedPhone = contact.replace(/\s+/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+251" + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith("+251")) {
        formattedPhone = "+251" + formattedPhone;
      }

      const smsMessage = `Hi ${customerName}, ${inviteMessage}`;
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
      eventId: selectedEvent?.id || selectedEvent?._id,
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
            eventId: selectedEvent?.id || selectedEvent?._id,
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

    return success;
  } catch (error) {
    console.error("Send invitation error:", error);
    return false;
  }
};
