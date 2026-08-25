const Payment = require("../models/Payment");
const SantimTransaction = require("../models/SantimTransaction");
const Ticket = require("../models/Ticket");
const { releaseTicketStock } = require("./ticketStock");

/**
 * Generalizes the atomic-gate pattern `processSuccessfulPayment` already
 * uses for `smsSent` (an atomic conditional `findOneAndUpdate`, not a plain
 * read-then-write) into a shared "mark this hold-bearing record terminal
 * and release its stock" primitive.
 *
 * The atomicity is what lets a scheduled expiry sweep and a real, concurrent
 * payment confirmation race for the same record safely: whichever write
 * reaches Mongo first wins — the loser's conditional match fails and it
 * simply no-ops, so a record is never released twice and never straddles
 * "confirmed" and "expired" at once.
 */
const markPaymentTerminal = async ({ paymentId, status, now = new Date() }) => {
  const previous = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "PENDING" },
    { $set: { status, stockReleasedAt: now } },
    { new: false }
  );

  if (!previous) {
    // Already moved off PENDING by someone else (confirmed PAID, already
    // terminal, or already expired) — nothing to release.
    return { updated: false };
  }

  if (previous.stockHeldAt) {
    try {
      await releaseTicketStock({
        eventId: previous.eventId,
        ticketTypeId: previous.ticketTypeId,
        ticketTypeName: previous.ticketDetails?.ticketType,
        count: previous.ticketDetails?.ticketCount || 1,
        now,
      });
    } catch (error) {
      // Never let a release failure mask the terminal-status write that
      // already succeeded — log loudly and move on; the stock will look
      // over-claimed until someone investigates, which is preferable to
      // retrying inside a webhook/poll response path.
      console.error(
        `[PAYMENT-HOLD] Failed to release stock for payment ${paymentId}:`,
        error
      );
    }
  }

  return { updated: true, previous };
};

const markSantimTransactionTerminal = async ({
  transactionId,
  status,
  now = new Date(),
}) => {
  const previous = await SantimTransaction.findOneAndUpdate(
    { _id: transactionId, status: "PENDING" },
    { $set: { status, stockReleasedAt: now } },
    { new: false }
  );

  if (!previous) {
    return { updated: false };
  }

  if (previous.stockHeldAt) {
    try {
      // `ticketTypeId` here is always the real ref set alongside
      // `stockHeldAt` at initiate time (see santimPayController.js) — no
      // name fallback needed, unlike the legacy metaData.ticketTypeId
      // string this record also carries for backward compat elsewhere.
      await releaseTicketStock({
        eventId: previous.metaData?.eventId,
        ticketTypeId: previous.ticketTypeId,
        count: Number(previous.metaData?.quantity) || 1,
        now,
      });
    } catch (error) {
      console.error(
        `[PAYMENT-HOLD] Failed to release stock for transaction ${transactionId}:`,
        error
      );
    }
  }

  return { updated: true, previous };
};

/**
 * Expires an abandoned "pending" ticket created outside the Payment/
 * SantimTransaction flow (eventController.buyTicket's unpaid branch) and
 * returns its held stock.
 */
const expirePendingTicket = async ({ ticketId, now = new Date() }) => {
  const previous = await Ticket.findOneAndUpdate(
    { _id: ticketId, status: "pending" },
    { $set: { status: "expired" } },
    { new: false }
  );

  if (!previous) {
    return { updated: false };
  }

  try {
    await releaseTicketStock({
      eventId: previous.event,
      ticketTypeId: previous.ticketTypeId,
      ticketTypeName: previous.ticketType,
      count: previous.purchaseQuantity || previous.ticketCount || 1,
      now,
    });
  } catch (error) {
    console.error(
      `[PAYMENT-HOLD] Failed to release stock for pending ticket ${ticketId}:`,
      error
    );
  }

  return { updated: true, previous };
};

module.exports = {
  markPaymentTerminal,
  markSantimTransactionTerminal,
  expirePendingTicket,
};
