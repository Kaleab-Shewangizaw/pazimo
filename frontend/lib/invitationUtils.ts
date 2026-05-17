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
  eventLocation: string = "",
  eventUrl?: string
) => {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
    let qrUrl: string;

    if (guestType === "paid") {
      qrUrl = eventUrl || `${baseUrl}/event_explore`;
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
  style="margin:0;padding:0;background-color:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
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
              <svg width="400" height="80" style="position:absolute;top:0px;left:-50px;opacity:0.3;">
                <path d="M0,40 Q150,0 300,40" stroke="#fbbf24" stroke-width="8" fill="transparent" />
              </svg>
              <svg width="400" height="80" style="position:absolute;bottom:0px;right:-100px;opacity:0.3;">
                <path d="M0,40 Q150,80 300,40" stroke="#a78bfa" stroke-width="6" fill="transparent" />
              </svg>

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

              <!-- Organizer Message -->
              ${
                message
                  ? `<p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${message}
              </p>`
                  : ""
              }

              <!-- Event Message -->
              <p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${headerSubtitle}
              </p>

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

export const createRsvpEmailTemplate = (
  customerName: string,
  event: Event | null,
  message: string,
  rsvpLink: string
) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSVP Required: ${event?.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 50px; margin-bottom: 20px;" />
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Action Required: RSVP</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Please confirm your attendance to receive your ticket</p>
    </div>
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #1a202c; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${
          event?.title
        }</h2>
        <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.5;">${
          event?.description || "You have been invited as a special guest!"
        }</p>
      </div>
      
      <div style="background: #fff5f5; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #fc8181;">
        <p style="color: #c53030; margin: 0; font-weight: 600;">⚠️ Important:</p>
        <p style="color: #2d3748; margin: 5px 0 0 0;">This is not your ticket. You must confirm your attendance to receive your QR code entry ticket.</p>
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
        <h4 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Message from Organizer:</h4>
        <p style="color: #4a5568; margin: 0; line-height: 1.6; font-style: italic;">${message}</p>
      </div>`
          : ""
      }
      <div style="text-align: center; margin: 30px 0;">
        <a href="${rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 40px; border-radius: 30px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">✅ Confirm Attendance</a>
        <p style="color: #718096; margin: 15px 0 0 0; font-size: 13px;">Clicking this link will generate your official ticket.</p>
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
    const eventDetails = `Event: ${selectedEvent?.title}\nDate: ${selectedEvent?.date} ${selectedEvent?.time}\nLocation: ${selectedEvent?.location}\n\nRSVP Link: ${qrCodeLink}`;
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

      const smsMessage = `Hello, ${customerName}\n\n${inviteMessage}`;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createGuestTicket = async (data: any) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/guest-ticket`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );
  return response.json();
};

export const sendGuestInvitation = async (ticketId: string) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/guest-ticket/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticketId }),
    }
  );
  return response.json();
};
