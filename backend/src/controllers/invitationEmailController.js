const { StatusCodes } = require("http-status-codes");
const nodemailer = require("nodemailer");

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER/EMAIL_PASS env vars are required");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const createEmailTemplate = (eventOrData, invitationData, qrCodeUrl) => {
  // Handle the case where the first argument is an object with named properties (legacy/RSVP call)
  if (eventOrData.isRsvp || (eventOrData.eventName && !eventOrData.title)) {
    const {
      guestName,
      eventName,
      eventDate,
      eventTime,
      location,
      rsvpLink,
      amount,
      message,
    } = eventOrData;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSVP Required: ${eventName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Action Required: RSVP</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Please confirm your attendance to receive your ticket</p>
    </div>
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #1a202c; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${eventName}</h2>
        <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.5;">You have been invited as a special guest!</p>
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
            <span style="color: #4a5568;">${eventDate}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">⏰ Time:</span>
            <span style="color: #4a5568;">${eventTime}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">📍 Location:</span>
            <span style="color: #4a5568;">${location}</span>
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
      <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
    </div>
  </div>
</body>
</html>`;
  }

  // Handle the new signature: (event, invitation, qrCodeUrl, eventImage)
  const event = eventOrData;
  const invitation = invitationData;
  // Use the passed eventImage or fallback to a placeholder if needed
  // If eventImage is not passed as 4th arg, check if it's in event object
  const eventImage =
    qrCodeUrl && typeof qrCodeUrl === "string" && !qrCodeUrl.startsWith("data:")
      ? qrCodeUrl
      : event.image || "https://pazimo.vercel.app/images/default-event.jpg";

  // If the 3rd argument was the QR code (data URL), keep it. If it was the image (string url), we might have swapped them.
  // But let's stick to the signature: createEmailTemplate(event, invitation, qrCodeUrl, eventImage)
  // To be safe with existing calls, we'll check arguments.

  let finalQrCodeUrl = qrCodeUrl;
  let finalEventImage =
    event.image || "https://pazimo.vercel.app/images/default-event.jpg";

  // If the function is called with 4 arguments: createEmailTemplate(event, invitation, qrCode, image)
  if (arguments.length >= 4) {
    finalEventImage = arguments[3];
  }

  const eventDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const eventTime = new Date(event.date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const frontendUrl = "https://pazimo.vercel.app";
  // Use provided actionLink or fallback to guest invitation
  const actionLink =
    invitation.actionLink ||
    `${frontendUrl}/guest-invitation?inv=${invitation.uniqueId}`;

  const actionText = invitation.actionText || "Confirm Attendance";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited!</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          padding: 0;
          text-align: center;
        }
        .header-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        .header-content {
          padding: 30px 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 10px 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 25px;
          color: #1f2937;
        }
        .event-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .event-title {
          font-size: 20px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 15px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .event-detail {
          display: flex;
          margin-bottom: 10px;
          align-items: flex-start;
        }
        .detail-label {
          font-weight: 600;
          width: 80px;
          color: #6b7280;
          flex-shrink: 0;
        }
        .detail-value {
          color: #374151;
        }
        .qr-section {
          text-align: center;
          margin: 35px 0;
          padding: 20px;
          background-color: #ffffff;
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
        }
        .qr-code {
          width: 200px;
          height: 200px;
          margin-bottom: 15px;
        }
        .ticket-id {
          font-family: monospace;
          background-color: #f3f4f6;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          color: #4b5563;
        }
        .footer {
          background-color: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
        }
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
          margin-top: 20px;
          text-align: center;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 8px rgba(102, 126, 234, 0.6);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${
            finalEventImage
              ? `<img src="${finalEventImage}" alt="${event.title}" class="header-image" />`
              : ""
          }
          <div class="header-content">
            <h1>You're Invited!</h1>
            <p>You have received a special invitation</p>
          </div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello <strong>${invitation.guestName}</strong>,
          </div>
          
          <p>We are delighted to invite you to an upcoming event. Your presence would mean a lot to us!</p>
          
          <div class="event-card">
            <div class="event-title">${event.title}</div>
            
            <div class="event-detail">
              <span class="detail-label">When:</span>
              <span class="detail-value">${eventDate} at ${eventTime}</span>
            </div>
            
            <div class="event-detail">
              <span class="detail-label">Where:</span>
              <span class="detail-value">${event.location}</span>
            </div>
            
            <div class="event-detail">
              <span class="detail-label">Type:</span>
              <span class="detail-value">${invitation.ticketType} Ticket</span>
            </div>
          </div>

          <div class="qr-section">
            <p style="margin-top: 0; margin-bottom: 15px; font-weight: 600; color: #4b5563;">
              ${
                actionText === "Buy Ticket"
                  ? "Click below to purchase your ticket"
                  : "Your Entry Ticket - Please Confirm"
              }
            </p>
            
            <div style="text-align: center;">
              <a href="${actionLink}" class="button">${actionText}</a>
            </div>
            
            <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
              ${
                actionText === "Buy Ticket"
                  ? "You will receive your QR code after payment."
                  : "Please present your QR code at the entrance."
              }
            </p>
          </div>

          <p>We look forward to seeing you there!</p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} PAZ Events. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendInvitationEmail = async (req, res) => {
  try {
    // Support both direct call and internal call
    let data = req;

    // Check if it's an Express request object (has headers, method, etc.)
    if (req.headers && req.method && req.body) {
      data = req.body;
    }

    const { to, subject, body, attachments } = data;

    if (!to || !subject || !body) {
      if (res) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "To, subject and body are required",
        });
      }
      throw new Error("To, subject and body are required");
    }

    const transporter = createTransporter();
    const mailOptions = {
      from: `PAZ Events <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: body,
      attachments: attachments || [],
    };

    await transporter.sendMail(mailOptions);

    if (res) {
      res.status(StatusCodes.OK).json({ success: true });
    }
    return { success: true };
  } catch (error) {
    console.error("Invitation email error:", error);
    if (res) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send invitation email",
      });
    }
    throw error;
  }
};

module.exports = { sendInvitationEmail, createEmailTemplate };
