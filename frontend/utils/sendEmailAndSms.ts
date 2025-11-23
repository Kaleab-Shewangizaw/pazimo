"use server";

import nodemailer from "nodemailer";

// ==========================
// SEND EMAIL (ZOHO SMTP)
// ==========================
export const sendEmail = async (
  email: string,
  message: string,
  subject: string
): Promise<void> => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error(
        "Email credentials missing. Set EMAIL_USER and EMAIL_PASS in .env."
      );
    }

    // ZOHO SMTP Transport (App Password required)
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // MUST be Zoho App Password
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html: message,
    });

    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// ==========================
// SEND SMS (GEEZ SMS)
// ==========================
export const sendSms = async (
  phone_number: string,
  message: string
): Promise<void> => {
  try {
    const apiKey = process.env.GEEZ_SMS_API_KEY;
    if (!apiKey) {
      throw new Error("GEEZ_SMS_API_KEY missing in environment variables.");
    }

    // Correct GeezSMS API Request
    const response = await fetch(
      "https://api.geezsms.com/api/v1/sms/send/bulk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GeezSMS-Key": apiKey, // Correct header
        },
        body: JSON.stringify({
          token: apiKey, // required by GeezSMS
          contacts: [{ phone_number }],
          msg: message,
          sender: "PAZ", // short sender ID only
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GeezSMS error: ${response.status} - ${errorText}`);
    }

    console.log(`SMS sent successfully to ${phone_number}`);
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
};

// ==========================
// SEND BOTH EMAIL AND SMS
// ==========================
export const sendEmailAndSms = async (
  email: string,
  phone_number: string,
  emailMessage: string,
  smsMessage: string,
  subject: string
): Promise<void> => {
  const emailPromise = sendEmail(email, emailMessage, subject);
  const smsPromise = sendSms(phone_number, smsMessage);

  await Promise.all([emailPromise, smsPromise]);
};

// export const createEmailTemplate = (
//   customerName: string,
//   event: Event | null,
//   message: string,
//   qrLink: string
// ) => {
//   return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Event Invitation</title>
// </head>
// <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
//   <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
//     <!-- Header -->
//     <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
//       <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 50px; margin-bottom: 20px;" />
//       <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎉 You're Invited!</h1>
//       <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Join us for an amazing event</p>
//     </div>

//     <!-- Content -->
//     <div style="padding: 40px 30px;">
//       <div style="text-align: center; margin-bottom: 30px;">
//         <h2 style="color: #1a202c; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${
//           event?.title
//         }</h2>
//         <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.5;">${
//           event?.description || "We're excited to have you join us!"
//         }</p>
//       </div>

//       <div style="background: #f7fafc; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
//         <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📅 Event Details</h3>
//         <div style="display: grid; gap: 10px;">
//           <div style="display: flex; align-items: center;">
//             <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">📆 Date:</span>
//             <span style="color: #4a5568;">${event?.startDate}</span>
//           </div>
//           <div style="display: flex; align-items: center;">
//             <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">⏰ Time:</span>
//             <span style="color: #4a5568;">${event?.startDate}</span>
//           </div>
//           <div style="display: flex; align-items: center;">
//             <span style="color: #667eea; font-weight: 600; width: 80px; display: inline-block;">📍 Location:</span>
//             <span style="color: #4a5568;">${event?.location}</span>
//           </div>
//         </div>
//       </div>

//       ${
//         message
//           ? `<div style="background: #edf2f7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 3px solid #4299e1;">
//         <h4 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Personal Message:</h4>
//         <p style="color: #4a5568; margin: 0; line-height: 1.6; font-style: italic;">${message}</p>
//       </div>`
//           : ""
//       }

//       <!-- RSVP Section -->
//       <div style="text-align: center; margin: 30px 0;">
//         <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px; padding: 20px; margin: 20px 0;">
//           <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎫 Quick RSVP</h3>
//           <p style="color: #f0fff4; margin: 0 0 15px 0; font-size: 14px;">Scan the QR code or click the link below to confirm your attendance</p>
//           <a href="${qrLink}" style="display: inline-block; background: #ffffff; color: #38a169; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease;">🔗 RSVP Now</a>
//         </div>
//       </div>
//     </div>

//     <!-- Footer -->
//     <div style="background: #2d3748; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
//       <div style="margin-bottom: 20px;">
//         <img src="https://pazimo.com/logo.png" alt="Pazimo" style="height: 30px; opacity: 0.8;" />
//       </div>
//       <p style="color: #a0aec0; margin: 0 0 10px 0; font-size: 14px;">Powered by <strong style="color: #ffffff;">Pazimo Events</strong></p>
//       <p style="color: #718096; margin: 0; font-size: 12px;">Professional event management platform</p>
//       <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #4a5568;">
//         <p style="color: #718096; margin: 0; font-size: 11px;">This invitation was sent via Pazimo Events Platform. If you have any questions, please contact the event organizer.</p>
//       </div>
//     </div>
//   </div>
// </body>
// </html>
//     `;
// };
