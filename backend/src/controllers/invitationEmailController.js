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
    if (isSignatureEvent) {
      // For Signature event, use the custom link for both paid and guest
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
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #12143e;
      font-family: 'Inter', system-ui, sans-serif;
      color: #f5f6ff;
    }

    .container {
      max-width: 620px;
      margin: 32px auto;
      background: #1b1c44;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
      position: relative;
    }

    .top-strip {
      height: 8px;
      background: #5b5fdd;
    }

    /* HEADER */
    .header {
      padding: 26px 28px 22px;
      text-align: center;
      position: relative;
    }

    .decor-circle {
      width: 80px;
      height: 80px;
      background: #ffd966;
      border-radius: 50%;
      position: absolute;
      top: -30px;
      right: -30px;
    }

    .decor-triangle {
      width: 0;
      height: 0;
      border-left: 25px solid transparent;
      border-right: 25px solid transparent;
      border-bottom: 45px solid #5b5fdd;
      position: absolute;
      bottom: -20px;
      left: -15px;
    }

    .logo {
      margin-bottom: 14px;
    }

    .subtitle {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffd966;
      margin-bottom: 6px;
    }

    .headline {
      font-size: 24px;
      font-weight: 800;
      margin: 0;
      color: #f5f6ff;
    }

    /* EVENT HERO */
    .event-hero {
      padding: 28px;
      background: #32325E;
      color: #ffffff;
      border-radius: 18px;
      position: relative;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .event-hero::before {
      content: "";
      position: absolute;
      width: 60px;
      height: 60px;
      background: #ffd966;
      border-radius: 50%;
      top: -20px;
      left: -20px;
      opacity: 0.6;
    }

    .event-hero::after {
      content: "";
      position: absolute;
      width: 50px;
      height: 50px;
      background: #ff6f61;
      border-radius: 14px;
      bottom: -15px;
      right: -15px;
      opacity: 0.6;
    }

    .event-title {
      font-size: 28px;
      font-weight: 900;
      margin-bottom: 14px;
      line-height: 1.2;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .event-info {
      font-size: 15px;
      line-height: 1.6;
      background: #1b1c44;
      padding: 14px 16px;
      border-radius: 12px;
      color: #ffd966;
      display: inline-block;
      box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
    }

    /* CTA */
    .cta-wrap {
      text-align: center;
      padding: 18px 0;
      border-radius: 50px;
    }

    .cta {
      display: inline-block;
      padding: 14px 36px;
      font-size: 16px;
      font-weight: 800;
      background: #ffd966;
      color: #1b1c44;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 10px 24px rgba(255, 217, 102, 0.55);
    }

    /* MESSAGE */
    .message {
      padding: 22px 28px;
      background: #1b1c44;
      border-radius: 16px;
      margin-bottom: 24px;
      border-left: 4px solid #5b5fdd;
    }

    .message-label {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffd966;
      margin-bottom: 8px;
    }

    .message-text {
      font-size: 14px;
      line-height: 1.7;
      color: #f5f6ff;
      background: #12143e;
      padding: 14px 16px;
      border-radius: 12px;
    }

    /* FOOTER */
    .footer {
      padding: 22px;
      text-align: center;
      font-size: 13px;
      color: #f5f6ffaa;
      border-top: 1px solid #5b5fdd;
    }

    .footer a {
      color: #ffd966;
      font-weight: 600;
      text-decoration: none;
    }
  </style>
</head>

<body>
  <div class="container">

    <div class="top-strip"></div>

    <!-- HEADER -->
    <div class="header">
      <div class="decor-circle"></div>
      <div class="decor-triangle"></div>

      <!-- LOGO WITH LIGHT BACKGROUND -->
      <div class="logo">
        <div style="background: #ffffff; padding: 6px 12px; border-radius: 12px; display: inline-block;">
          <img src="https://pazimo.com/logo.png"
            onerror="this.onerror=null;this.src='https://pazimo.vercel.app/logo.png';" alt="Pazimo"
            style="height:30px; display:block;" />
        </div>
      </div>

      <div class="subtitle">${headerSubtitle}</div>
      <h1 class="headline">${headerTitle}</h1>
    </div>

    <!-- EVENT HERO -->
    <div class="event-hero">
      <div class="event-title">${event.title}</div>
      <div class="event-info">
        ${eventDate}<br />
        ${eventTime}<br />
        ${event.location}
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-wrap">
      <a href="${actionLink}" class="cta">${actionText}</a>
    </div>

    <!-- MESSAGE -->
    ${
      message
        ? `
    <div class="message">
      <div class="message-label">Message from the Organizer</div>
      <div class="message-text">${message}</div>
    </div>
    `
        : ""
    }

    <!-- FOOTER -->
    <div class="footer">
      Powered by <a href="https://pazimo.com" target="_blank">pazimo.com</a><br />
      Where people and events connect.
      <div style="display:none;">${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}</div>
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
