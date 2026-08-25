const Payment = require("../models/Payment");
const SantimTransaction = require("../models/SantimTransaction");
const Ticket = require("../models/Ticket");
const {
  markPaymentTerminal,
  markSantimTransactionTerminal,
  expirePendingTicket,
} = require("./paymentHold");

// How long a checkout-initiation stock hold is allowed to sit unconfirmed
// before it's given back. Generous enough to cover a slow mobile-money/USSD
// confirmation or a customer sitting on a hosted card-payment page; short
// enough that an abandoned checkout doesn't choke off real sales for long.
const HOLD_TTL_MS = 15 * 60 * 1000;

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

/**
 * Start the stock-hold expiry sweep, on the same 60s cadence as the wave
 * availability scheduler.
 */
const startStockHoldExpirySweep = () => {
  sweepExpiredHolds();
  setInterval(sweepExpiredHolds, 60000);
  console.log("Stock hold expiry sweep started - running every minute");
};

module.exports = {
  sweepExpiredHolds,
  startStockHoldExpirySweep,
  HOLD_TTL_MS,
};
