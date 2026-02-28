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
  message,
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


  let actionLink = invitation.actionLink;
  if (!actionLink) {
  
      actionLink = `${frontendUrl}/guest-invitation?inv=${invitation.uniqueId}`;
  
  }

  const actionText = invitation.actionText || "Confirm Attendance";

  // Determine header text based on action
  const headerTitle =
    actionText === "Buy Ticket" ? "Event Invitation" : "You're Invited!";
  const headerSubtitle =
    actionText === "Buy Ticket"
      ? "Secure your spot today"
      : "Join us for an amazing event";

  


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
