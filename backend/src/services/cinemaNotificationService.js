const { sendSMS } = require("../utils/sms");
const { isPlaceholderEmail } = require("../utils/ticketConfirmationEmail");

// Telling a customer their cinema tickets are ready.
//
// EVERY SEND IS BEST EFFORT AND NEVER BLOCKS.
//
// The tickets already exist and are already readable from the order page and
// from /ticket/{id}. A confirmation is a convenience on top of that, so an SMS
// gateway being slow must not delay the response, and an SMTP failure must not
// look to the caller like the sale went wrong. Failures are logged with the
// reference so they can be chased; nothing here throws.
//
// One message per ORDER, not per ticket. A family buying four seats gets one
// text with one link, not four texts — which is both what a person expects and
// what stops a four-seat booking costing four SMS.

/** Ethiopian numbers only — the gateway cannot deliver anywhere else. */
const isEthiopianNumber = (phone) => {
  if (!phone) return false;
  const normalized = phone.toString().replace(/[\s+]/g, "");
  return (
    normalized.startsWith("251") ||
    normalized.startsWith("09") ||
    normalized.startsWith("07") ||
    /^[97]\d{8}$/.test(normalized)
  );
};

const ticketLink = (ticketId) =>
  `${process.env.FRONTEND_URL || "https://pazimo.com"}/ticket/${ticketId}`;

const orderLink = (reference) =>
  `${process.env.FRONTEND_URL || "https://pazimo.com"}/cinema/order/${reference}`;

const formatWhen = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  });
};

// One ticket can now cover several seats (every seat bought in the same price
// category in one order). Falls back to the old singular `seat` field so a
// ticket written before this changed still prints correctly.
const seatsOf = (ticket) =>
  ticket.seats?.length ? ticket.seats : ticket.seat ? [ticket.seat] : [];

/**
 * The one line that matters: where to sit.
 *
 * A single seat is named outright; several are listed; a general-admission
 * ticket says how many it admits instead. Anything else would either bury the
 * seat or print a list of "undefined".
 */
const describeSeats = (tickets) => {
  // Filtered on the fields actually printed below, not on seatKey. They are
  // always written together by the checkout, but a seat that somehow carried
  // one and not the other would otherwise print "Seat undefinedundefined".
  const seated = tickets
    .flatMap((t) => seatsOf(t))
    .filter((s) => s?.row && s?.number);
  if (!seated.length) {
    const admits = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
    return `Admits ${admits}`;
  }
  if (seated.length === 1) {
    return `Seat ${seated[0].row}${seated[0].number}`;
  }
  return `Seats ${seated.map((s) => `${s.row}${s.number}`).join(", ")}`;
};

/**
 * Confirm a settled cinema order by SMS and email.
 *
 * Called after the tickets exist, never before — a confirmation for a ticket
 * that failed to write would be worse than no confirmation.
 */
const sendCinemaOrderConfirmation = async ({
  tickets,
  concessions = [],
  reference,
  customerName,
  customerPhone,
  customerEmail,
}) => {
  if (!tickets?.length) return;

  const first = tickets[0];
  const name = (customerName || "there").split(/\s+/)[0];
  const seats = describeSeats(tickets);
  const when = formatWhen(first.showtimeStartsAt);

  // --- SMS ---------------------------------------------------------------
  if (customerPhone && isEthiopianNumber(customerPhone)) {
    // One ticket links straight to it; several link to the order, which lists
    // them all. Sending four links in one text is unreadable on a feature phone.
    const link = tickets.length === 1 ? ticketLink(first.ticketId) : orderLink(reference);

    let message =
      `Hi ${name} 👋\n` +
      `Your ${tickets.length > 1 ? `${tickets.length} tickets` : "ticket"} for ` +
      `${first.movieTitle} ${tickets.length > 1 ? "are" : "is"} confirmed 🎬\n` +
      `${when}${first.hallName ? ` · ${first.hallName}` : ""}\n` +
      `${seats}\n\n` +
      `Show the QR at the door:\n${link}`;

    if (concessions.length) {
      const items = concessions
        .map((c) => `${c.quantity} × ${c.beverageName || c.name}`)
        .join(", ");
      message += `\n\n🍿 Collect at the counter: ${items}`;
    }

    message += `\n\n⚠️ Keep this link safe — it opens your ticket.\nPazimo`;

    sendSMS(customerPhone, message)
      .then((result) => {
        if (result?.success) console.log(`[CINEMA-SMS] ✅ sent for ${reference}`);
        else console.error(`[CINEMA-SMS] ❌ ${reference}: ${result?.error}`);
      })
      .catch((error) =>
        console.error(`[CINEMA-SMS] ❌ ${reference}:`, error.message)
      );
  }

  // --- Email -------------------------------------------------------------
  const email = String(customerEmail || "").toLowerCase().trim();
  // Skips our own auto-generated placeholders, the same test the event side
  // applies — mailing them bounces and pollutes the sending reputation.
  if (email && !isPlaceholderEmail(email)) {
    sendCinemaTicketEmail({ tickets, concessions, reference, name, seats, when, to: email })
      .then(() => console.log(`[CINEMA-EMAIL] ✅ sent to ${email} for ${reference}`))
      .catch((error) =>
        console.error(`[CINEMA-EMAIL] ❌ ${reference}:`, error.message)
      );
  }
};

/** The email itself. Split out so the SMS path does not pay for nodemailer. */
const sendCinemaTicketEmail = async ({ tickets, concessions, name, seats, when, to }) => {
  const nodemailer = require("nodemailer");
  const first = tickets[0];

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const rows = tickets
    .map((t) => {
      const seatList = seatsOf(t);
      const seatText = !seatList.length
        ? t.ticketType
        : seatList.length === 1
          ? `Row ${seatList[0].row} · Seat ${seatList[0].number}`
          : `Seats ${seatList.map((s) => `${s.row}${s.number}`).join(", ")}`;
      const categoryLabel = seatList[0]?.categoryLabel || t.ticketType;
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee">
          <div style="font-weight:600">${seatText}</div>
          <div style="color:#666;font-size:13px">${categoryLabel}</div>
          <a href="${ticketLink(t.ticketId)}" style="color:#4f46e5;font-size:13px">Open ticket ${t.ticketId}</a>
        </td>
      </tr>`;
    })
    .join("");

  const snacks = concessions.length
    ? `<p style="margin:16px 0 0;color:#444">🍿 <strong>Collect at the counter:</strong> ${concessions
        .map((c) => `${c.quantity} × ${c.beverageName || c.name}`)
        .join(", ")}</p>`
    : "";

  await transporter.sendMail({
    from: `"Pazimo" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your tickets for ${first.movieTitle}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="font-size:22px;margin:0 0 4px">You're going to the movies 🎬</h1>
        <p style="color:#666;margin:0 0 20px">Hi ${name}, your booking is confirmed.</p>
        <div style="border:1px solid #eee;border-radius:12px;padding:20px">
          <div style="font-size:18px;font-weight:700">${first.movieTitle}</div>
          <div style="color:#666;margin-top:4px">${when}${first.hallName ? ` · ${first.hallName}` : ""}</div>
          <div style="margin-top:8px;font-weight:600">${seats}</div>
          <table style="width:100%;margin-top:16px;border-collapse:collapse">${rows}</table>
          ${snacks}
        </div>
        <p style="color:#888;font-size:12px;margin-top:20px">
          Show the QR code at the door. Keep these links private — they open your tickets.
        </p>
      </div>`,
  });
};

module.exports = { sendCinemaOrderConfirmation, isEthiopianNumber, describeSeats };
