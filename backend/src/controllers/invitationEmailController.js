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

const createEmailTemplate = (event, invitation, qrCodeUrl, eventImage) => {
  // Format date and time
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

  const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.vercel.app";
  const actionLink =
    invitation.actionLink ||
    `${frontendUrl}/guest-invitation?inv=${invitation.uniqueId}`;
  const actionText = invitation.actionText || "Confirm Attendance";

  // Determine header text based on action
  const headerTitle =
    actionText === "Buy Ticket" ? "Event Invitation" : "You're Invited!";
  const headerSubtitle =
    actionText === "Buy Ticket"
      ? "Secure your spot today"
      : "Join us for an amazing event";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
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
      <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
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
