const Payment = require("../models/Payment");
const SantimTransaction = require("../models/SantimTransaction");
const Ticket = require("../models/Ticket");
const {
  markPaymentTerminal,
  markSantimTransactionTerminal,
  expirePendingTicket,
} = require("./paymentHold");

// How long a checkout-initiation stock hold is allowed to sit unconfirmed
// before it's given back, for whichever buyer never explicitly cancelled
// (an explicit cancel — the checkout screen's "Cancel" button, wired to
// paymentController.cancelPayment — releases immediately regardless of this
// value; this is only the backstop for someone who just closes the tab or
// walks away).
//
// Deliberately short (product decision): on a ticket type down to its last
// few units, a stuck-but-not-cancelled checkout should give the unit back to
// other buyers quickly rather than sitting on it for the full lifetime of a
// slow payment. The trade-off, accepted: a genuinely slow but real payment
// (a card 3-D Secure challenge, or a buyer who takes a while to approve a
// USSD prompt — both can legitimately take longer than this) can have its
// hold released before it confirms. That does not oversell or lose money —
// the fallback re-claim in processSuccessfulPayment/generateTicketsForTransaction
// still runs, and if the unit was already taken by someone else, the payment
// is flagged with needsManualReview instead of silently minting or dropping
// a ticket — but it does mean that specific buyer needs manual follow-up
// instead of getting their ticket automatically. If needsManualReview cases
// turn out to be common in practice, raise this value.
const HOLD_TTL_MS = 60 * 1000;

let isSweepRunning = false;

/**
 * Release stock held by checkout attempts that never confirmed: PENDING
 * Payment/SantimTransaction records whose hold is older than the TTL, and
 * "pending" Tickets (eventController.buyTicket's unpaid branch, which never
 * creates a Payment/SantimTransaction to hang a hold off) past the same age.
 *
 * Safe to run concurrently with a real, in-flight confirmation for the same
 * record — markPaymentTerminal/markSantimTransactionTerminal/expirePendingTicket
 * are each a single atomic conditional update, so whichever write reaches
 * Mongo first wins and the other silently no-ops rather than double-acting.
 */
const sweepExpiredHolds = async () => {
  if (isSweepRunning) {
    return { success: false, message: "Skipped" };
  }

  isSweepRunning = true;
  let releasedCount = 0;
  let failedCount = 0;

  try {
    const cutoff = new Date(Date.now() - HOLD_TTL_MS);
    const now = new Date();

    const paymentCursor = Payment.find({
      status: "PENDING",
      stockHeldAt: { $lt: cutoff },
    }).cursor();

    for await (const payment of paymentCursor) {
      try {
        const { updated } = await markPaymentTerminal({
          paymentId: payment._id,
          status: "CANCELLED",
          now,
        });
        if (updated) releasedCount++;
      } catch (error) {
        failedCount++;
        console.error(
          `[STOCK-HOLD-EXPIRY] Failed to expire Payment ${payment._id}:`,
          error.message
        );
      }
    }

    const transactionCursor = SantimTransaction.find({
      status: "PENDING",
      stockHeldAt: { $lt: cutoff },
    }).cursor();

    for await (const transaction of transactionCursor) {
      try {
        const { updated } = await markSantimTransactionTerminal({
          transactionId: transaction._id,
          status: "CANCELLED",
          now,
        });
        if (updated) releasedCount++;
      } catch (error) {
        failedCount++;
        console.error(
          `[STOCK-HOLD-EXPIRY] Failed to expire SantimTransaction ${transaction._id}:`,
          error.message
        );
      }
    }

    const ticketCursor = Ticket.find({
      status: "pending",
      createdAt: { $lt: cutoff },
    }).cursor();

    for await (const ticket of ticketCursor) {
      try {
        const { updated } = await expirePendingTicket({
          ticketId: ticket._id,
          now,
        });
        if (updated) releasedCount++;
      } catch (error) {
        failedCount++;
        console.error(
          `[STOCK-HOLD-EXPIRY] Failed to expire pending Ticket ${ticket._id}:`,
          error.message
        );
      }
    }

    if (releasedCount > 0) {
      console.log(`[STOCK-HOLD-EXPIRY] Released ${releasedCount} expired stock hold(s)`);
    }
    if (failedCount > 0) {
      console.error(`[STOCK-HOLD-EXPIRY] Failed to expire ${failedCount} hold(s)`);
    }

    return { success: true, releasedCount, failedCount };
  } catch (error) {
    console.error("[STOCK-HOLD-EXPIRY] Sweep error:", error);
    return { success: false, error: error.message };
  } finally {
    isSweepRunning = false;
  }
};

// How often the sweep runs. With a 60s TTL, a sweep tick this frequent keeps
// the worst-case actual hold time close to the stated 1 minute (TTL + up to
// one tick) rather than diluting it with a slower cadence.
const SWEEP_INTERVAL_MS = 15 * 1000;

/**
 * Start the stock-hold expiry sweep.
 */
const startStockHoldExpirySweep = () => {
  sweepExpiredHolds();
  setInterval(sweepExpiredHolds, SWEEP_INTERVAL_MS);
  console.log(
    `Stock hold expiry sweep started - running every ${SWEEP_INTERVAL_MS / 1000}s, ${HOLD_TTL_MS / 1000}s TTL`
  );
};

module.exports = {
  sweepExpiredHolds,
  startStockHoldExpirySweep,
  HOLD_TTL_MS,
  SWEEP_INTERVAL_MS,
};
