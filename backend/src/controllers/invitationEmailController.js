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

const createEmailTemplate = (
  event,
  invitation,
  qrCodeUrl,
  eventImage,
  message
) => {
  // Format date and time
  const eventDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const eventTime =
    event.time ||
    new Date(event.date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.com";

  // Check for Signature Event
  const isSignatureEvent =
    event.title && event.title.toLowerCase().includes("signature");

  let actionLink = invitation.actionLink;
  if (!actionLink) {
    if (isSignatureEvent && invitation.guestType !== "paid") {
      actionLink = `${frontendUrl}/guest-invitation/signature?inv=${invitation.uniqueId}`;
    } else {
      actionLink = `${frontendUrl}/guest-invitation?inv=${invitation.uniqueId}`;
    }
  }

  const actionText = invitation.actionText || "Confirm Attendance";

  // Determine header text based on action
  const headerTitle =
    actionText === "Buy Ticket" ? "Event Invitation" : "You're Invited!";
  const headerSubtitle =
    actionText === "Buy Ticket"
      ? "Secure your spot today"
      : "Join us for an amazing event";

  const messageSection = message
    ? `
      <div style="background: #fff5f5; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #fc8181;">
        <h3 style="color: #c53030; margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">💬 Message from Organizer</h3>
        <p style="color: #2d3748; margin: 0; font-size: 16px; line-height: 1.6; font-style: italic;">"${message}"</p>
      </div>
  `
    : "";

  // Custom Template for Signature Events
  if (isSignatureEvent) {
    const signatureEventDate = new Date(event.date).toLocaleDateString(
      "en-US",
      {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );

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
        event.title
      }</h2>
      <div style="width: 60px; height: 2px; background-color: #d4af37; margin: 0 auto 30px auto;"></div>
        <p style="color: #ffffff; font-size: 18px; margin-bottom: 10px;">Hello, ${
          invitation.guestName
        }</p>
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
                typeof event.location === "string"
                  ? event.location
                  : event.location?.city ||
                    event.location?.address ||
                    "Venue TBD"
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
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉 ${headerTitle}</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${headerSubtitle}</p>
    </div>
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #1a202c; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${
          event.title
        }</h2>
        <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.5;">We're excited to have you join us!</p>
      </div>

      ${messageSection}

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
            <span style="color: #4a5568;">${event.location}</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎫 ${
            actionText === "Buy Ticket" ? "Get Your Ticket" : "Your Invitation"
          }</h3>
          <p style="color: #f0fff4; margin: 0 0 15px 0; font-size: 14px;">
            ${
              actionText === "Buy Ticket"
                ? "Click below to purchase your ticket"
                : "Click the link below to view your ticket"
            }
          </p>
          <a href="${actionLink}" class="button">${actionText}</a>
        </div>
      </div>
    </div>
    <div style="background: #2d3748; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
      <div style="margin-bottom: 20px;">
        <img src="cid:logo" alt="Pazimo" style="height: 30px; opacity: 0.8;" />
      </div>
      <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
      <!-- Unique identifier to prevent Gmail clipping/threading -->
      <div style="display:none; opacity:0; font-size:1px; color:#000000;">${new Date().getTime()}-${Math.random()
    .toString(36)
    .substring(7)}</div>
    </div>
  </div>
</body>
</html>`;
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
      from: `Pazimo Invitation <${process.env.EMAIL_SENDER_ZOHO}>`,
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
