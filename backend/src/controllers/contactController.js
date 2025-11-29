const { StatusCodes } = require("http-status-codes");
const nodemailer = require("nodemailer");

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "EMAIL_USER/EMAIL_PASS env vars are required for contact emails"
    );
  }
  return nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message, from, to } = req.body || {};

    if (!name || !email || !message) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Name, email and message are required",
      });
    }

    const safeSubject = (subject || "New Contact Message").slice(0, 200);
    const toRecipients =
      to && typeof to === "string" && to.includes("@")
        ? to
        : [process.env.CONTACT_TO_EMAIL, "support@pazimo.com"]
            .filter(Boolean)
            .join(",");

    const transporter = createTransporter();
    const mailOptions = {
      from: `Pazimo Contact <${process.env.EMAIL_USER}>`,
      to: toRecipients,
      subject: `[PAZ Contact] ${safeSubject}`,
      replyTo: email,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="margin-bottom: 8px;">New Contact Message</h2>
          <p style="margin: 0 0 16px 0; color: #555;">You received a new message from the website contact form.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 120px; padding: 6px 8px; color: #555;">Name</td>
              <td style="padding: 6px 8px; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; color: #555;">Email</td>
              <td style="padding: 6px 8px;">${email}</td>
            </tr>
            ${
              from
                ? `
            <tr>
              <td style="padding: 6px 8px; color: #555;">From</td>
              <td style="padding: 6px 8px;">${from}</td>
            </tr>`
                : ""
            }
            ${
              to
                ? `
            <tr>
              <td style="padding: 6px 8px; color: #555;">To</td>
              <td style="padding: 6px 8px;">${to}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding: 6px 8px; color: #555;">Subject</td>
              <td style="padding: 6px 8px;">${safeSubject}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding: 12px; background: #f7f7f8; border-radius: 6px; white-space: pre-wrap;">${message}</div>
        </div>
      `,
    };

    console.log(
      `[Contact] Received message from ${email}. Sending via Zoho to ${toRecipients}...`
    );

    // Send email synchronously to ensure it works and catch errors
    await transporter.sendMail(mailOptions);
    console.log(`[Contact] Email sent successfully to ${toRecipients}`);

    res
      .status(StatusCodes.OK)
      .json({ status: "success", message: "Message sent successfully" });
  } catch (error) {
    console.error(
      "Contact submit error details:",
      JSON.stringify(error, null, 2)
    );
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: error.message || "Failed to submit contact message",
    });
  }
};

module.exports = { submitContact };
