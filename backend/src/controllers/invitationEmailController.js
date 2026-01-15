const { StatusCodes } = require("http-status-codes");
const nodemailer = require("nodemailer");

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER/EMAIL_PASS env vars are required");
  }

  return nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER_ZOHO,
      pass: process.env.EMAIL_PASS_ZOHO,
    },
  });
};

//     service: "gmail",

//     // Use TLS
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });
// };
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

  const displayMessage = message || invitation.message;

  return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerTitle}</title>
</head>

<body
  style="margin:0;padding:0; background:#f5f7fb;background-color:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
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
                ${event.title}
              </h1>

              <!-- Guest Greeting -->
              <p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                Hello ${invitation.guestName},
              </p>

              <!-- Event Message -->
              <p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${
                  headerSubtitle ||
                  "Please join us for a thoughtfully crafted event."
                }
              </p>

              <!-- Organizer Message -->
              ${
                displayMessage
                  ? `<p
                style="margin:16px auto 0;max-width:520px;font-size:16px;line-height:1.6;color:#4b5563;position:relative;z-index:1;">
                ${displayMessage}
              </p>`
                  : ""
              }

              <!-- Confetti and shapes below messages -->
              <svg width="100%" height="250" style="position:absolute;top=200px;right=0;pointer-events:none;z-index:0;">
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
                    ${
                      typeof event.location === "string"
                        ? event.location
                        : event.location?.city ||
                          event.location?.address ||
                          "Venue TBD"
                    }
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
