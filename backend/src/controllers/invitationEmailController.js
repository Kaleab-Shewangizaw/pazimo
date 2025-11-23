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

const createEmailTemplate = ({
  guestName,
  eventName,
  eventDate,
  eventTime,
  location,
  rsvpLink,
  amount,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #333;">Invitation to ${eventName}</h2>
      <p>Hi ${guestName},</p>
      <p>You are invited to attend <strong>${eventName}</strong>.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${eventTime}</p>
        <p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>
      </div>

      <p>Your invitation QR code is attached.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${rsvpLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Invitation & QR Code</a>
      </div>

      <p style="font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
        Please present this invitation at the event. If you are bringing family, your QR includes an allowed amount of ${amount}.
      </p>
    </div>
  `;
};

const sendInvitationEmail = async (req, res) => {
  try {
    // Support both direct call and internal call
    const { to, subject, body, attachments } = req.body || req;

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
