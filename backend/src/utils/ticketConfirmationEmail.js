const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const { Jimp } = require("jimp");

const PLACEHOLDER_EMAIL_PREFIX = "customerpazimo";

// True when the email is missing or is one of our auto-generated
// "customerpazimo######@gmail.com" stand-ins (i.e. the buyer never gave us a real address).
const isPlaceholderEmail = (email) => {
  if (!email) return true;
  return email.toLowerCase().trim().startsWith(PLACEHOLDER_EMAIL_PREFIX);
};

const createTransporter = () => {
  if (!process.env.EMAIL_USER_ZOHO || !process.env.EMAIL_PASS_ZOHO) {
    throw new Error("EMAIL_USER_ZOHO/EMAIL_PASS_ZOHO env vars are required");
  }

  return nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER_ZOHO,
      pass: process.env.EMAIL_PASS_ZOHO,
    },
  });
};

// Mirrors frontend/app/ticket/[ticketId]/TicketDetailClient.tsx's formatEventDate exactly,
// so the email and the live ticket page always read the same.
const formatEventDate = (isoDate) => {
  if (!isoDate) return "DATE TBD";
  const date = new Date(isoDate);
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const day = date.getDate().toString().padStart(2, "0");
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

const formatEventLocation = (event) => {
  if (typeof event.location === "string") return event.location;
  return event.location?.address || event.location?.city || "Venue TBD";
};

// Brand navy (footer / organizer pages) and its lighter gradient partner.
const BRAND_BLUE_DARK = "#06283D";
const BRAND_BLUE_LIGHT = "#1A5D8C";
const PAGE_BG = "#f5f7fb";

// Solid-color fallback + gradient: Outlook desktop ignores background-image on
// table cells and falls back to background-color, everything else gets the gradient.
const CARD_BG = `background-color:${BRAND_BLUE_DARK};background-image:linear-gradient(135deg, ${BRAND_BLUE_DARK}, ${BRAND_BLUE_LIGHT});`;

const buildTicketEmailHtml = ({
  event,
  ticket,
  recipientName,
  ticketCount,
  ticketLink,
}) => {
  const dateLine = `${formatEventDate(event.startDate)}${
    event.startTime ? `, ${event.startTime}` : ""
  }`;
  const eventLocation = formatEventLocation(event).toUpperCase();
  const orderId = ticket.ticketId.slice(-6).toUpperCase();
  const attendee = (recipientName || "Guest").toUpperCase();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ticket for ${event.title}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:${BRAND_BLUE_DARK};font-weight:700;text-transform:uppercase;">
                Ticket Confirmed
              </p>
              
            </td>
          </tr>
        </table>

        <!-- TICKET CARD (die-cut pass look, matches the live ticket page) -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:400px;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(6,40,61,0.25);">

          <!-- HEADER: title, badge, detail grid -->
          <tr>
            <td style="${CARD_BG}padding:28px 28px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="top">
                    <h2 style="margin:0;font-size:22px;line-height:1.25;color:#ffffff;font-weight:800;">
                      ${event.title}
                    </h2>
                  </td>
                  <td valign="top" align="right" style="white-space:nowrap;">
                    <span style="display:inline-block;border:1px solid rgba(255,255,255,0.5);border-radius:999px;padding:5px 12px;font-size:10px;letter-spacing:1px;color:#ffffff;font-weight:700;">
                      OFFICIAL PASS
                    </span>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:22px;">
                <tr>
                  <td width="55%" valign="top" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);padding-bottom:16px;">
                    DATE &amp; TIME<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${dateLine}</span>
                  </td>
                  <td width="45%" valign="top" align="right" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);padding-bottom:16px;">
                    VENUE<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${eventLocation}</span>
                  </td>
                </tr>
                <tr>
                  <td width="55%" valign="top" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);padding-bottom:16px;">
                    TICKET TYPE<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${ticket.ticketType}</span>
                  </td>
                  <td width="45%" valign="top" align="right" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);padding-bottom:16px;">
                    QUANTITY<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${ticketCount.toString().padStart(2, "0")} ${ticketCount > 1 ? "PASSES" : "PASS"}</span>
                  </td>
                </tr>
                <tr>
                  <td width="55%" valign="top" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);">
                    ORDER ID<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${orderId}</span>
                  </td>
                  <td width="45%" valign="top" align="right" style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.65);">
                    ATTENDEE<br />
                    <span style="font-size:14px;color:#ffffff;font-weight:700;letter-spacing:0;">${attendee}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PERFORATION WITH DIE-CUT NOTCHES -->
          <!-- Built with a 3-column table + asymmetric border-radius instead of
               position:absolute, since Gmail strips "position" from inline styles. -->
          <tr>
            <td style="${CARD_BG}padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="20" style="padding:0;line-height:0;">
                    <div style="width:20px;height:20px;background:${PAGE_BG};border-radius:0 20px 20px 0;"></div>
                  </td>
                  <td style="padding:0 6px;line-height:0;">
                    <div style="border-top:2px dashed rgba(255,255,255,0.35);"></div>
                  </td>
                  <td width="20" style="padding:0;line-height:0;">
                    <div style="width:20px;height:20px;background:${PAGE_BG};border-radius:20px 0 0 20px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR + CTA -->
          <tr>
            <td align="center" style="${CARD_BG}padding:28px 28px 32px;">
              <img src="cid:ticketqr" alt="Ticket QR code" width="170" height="170" style="width:170px;height:170px;display:block;" />
              <p style="margin:16px 0 0;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.55);font-weight:700;">
                &mdash;&mdash; SCAN FOR ENTRY &mdash;&mdash;
              </p>
              <a href="${ticketLink}" style="display:inline-block;margin-top:16px;background:#06283D;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 8px 16px rgba(0,0,0,0.25);">
                View Ticket Online
              </a>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:400px;">
          <tr>
            <td align="center" style="padding:20px 24px 0;">
              <p style="margin:0;font-size:13px;color:#6b7280;">
                Powered by <a href="https://pazimo.com" style="color:${BRAND_BLUE_DARK};text-decoration:none;font-weight:600;">Pazimo.com</a>
              </p>
              <p style="margin-top:6px;font-size:12px;color:#9ca3af;">Keep this email safe — your QR code is your entry pass.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Same logo lookup as the qrCode pre-save hook in models/Ticket.js.
const resolveLogoPath = () => {
  const primary = path.join(__dirname, "../../uploads/logo/miniLogo.png");
  if (fs.existsSync(primary)) return primary;
  const fallback = path.join(__dirname, "../../../frontend/public/logo.png");
  return fs.existsSync(fallback) ? fallback : null;
};

// Renders a scannable QR PNG with the Pazimo logo composited at the center,
// on a white circular backdrop so it stays legible against the black modules.
const buildQrPngWithLogo = async (payload) => {
  const qrBuffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "H", // high error correction tolerates the logo overlay
    type: "png",
    margin: 1,
    width: 400,
  });

  const logoPath = resolveLogoPath();
  if (!logoPath) return qrBuffer;

  const qrImage = await Jimp.read(qrBuffer);
  const logoImage = await Jimp.read(logoPath);

  const logoSize = Math.round(qrImage.bitmap.width * 0.22);
  logoImage.resize({ w: logoSize, h: logoSize });

  const padding = Math.round(logoSize * 0.22);
  const backdropSize = logoSize + padding * 2;
  const backdrop = new Jimp({
    width: backdropSize,
    height: backdropSize,
    color: 0xffffffff,
  });
  backdrop.circle();
  backdrop.composite(logoImage, padding, padding);

  const offset = Math.round((qrImage.bitmap.width - backdropSize) / 2);
  qrImage.composite(backdrop, offset, offset);

  return qrImage.getBuffer("image/png");
};

// Sends a ticket-styled confirmation email (with an inline scannable QR code)
// to buyers who provided a real email address (i.e. not our auto-generated placeholder).
const sendTicketConfirmationEmail = async ({
  event,
  ticket,
  recipientEmail,
  recipientName,
  ticketCount,
}) => {
  const ticketLink = `${
    process.env.FRONTEND_URL || "https://pazimo.com"
  }/ticket/${ticket.ticketId}`;

  const qrPayload = JSON.stringify({
    tid: ticket.ticketId,
    nm: recipientName,
    tp: ticket.isInvitation ? "guest" : "user",
    tip: ticket.ticketType,
    qty: ticketCount,
  });

  const qrBuffer = await buildQrPngWithLogo(qrPayload);

  const html = buildTicketEmailHtml({
    event,
    ticket,
    recipientName,
    ticketCount,
    ticketLink,
  });

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `Pazimo Tickets <${process.env.EMAIL_SENDER_ZOHO}>`,
    to: recipientEmail,
    subject: `Your ticket for ${event.title} is confirmed 🎟️`,
    html,
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrBuffer,
        cid: "ticketqr",
      },
    ],
  });

  return { success: true };
};

module.exports = { sendTicketConfirmationEmail, isPlaceholderEmail };
