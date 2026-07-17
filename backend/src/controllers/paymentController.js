const { StatusCodes } = require("http-status-codes");
const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const SantimPayService = require("../services/santimPayService");
const { processSuccessfulPayment } = require("./ticketController");

const ChapaService = require("../services/chapaService");
const ChapaGiftCardService = require("../services/chapaGiftCardService");
const { amountsMatch } = require("../utils/pricing");

// For web-checkout (card/redirect) payments: allow a short grace period before
// treating a "failed" status as terminal, since the user may still be in-flight.
const CHAPA_PAYMENT_GRACE_MS = 2 * 60 * 1000; // 2 minutes

// Direct-charge methods (mobile money / USSD) are async — Chapa only updates
// status after the user completes the action on their phone. We do a single
// verify per poll cycle and let the frontend's natural interval handle retries.
// If the payment has been sitting in PENDING for longer than this, we expire it.
const DIRECT_CHARGE_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes

// Methods that use Chapa's direct-charge API (async, user acts on their phone).
// For these, retrying within a single HTTP request wastes API calls because
// Chapa won't change the status in a matter of seconds.
const DIRECT_CHARGE_METHODS = new Set([
  "telebirr", "mpesa", "cbebirr", "awashbirr", "boa_ussd",
  "Coopay-Ebirr", "yaya", "Amole",
]);

const isDirectChargePayment = (payment) => {
  // Check the top-level method field first (most reliable)
  const method = (payment.method || payment.ticketDetails?.paymentMethod || "").toLowerCase();
  if (method) {
    // Visa/Mastercard are web-checkout — everything else is direct charge
    return !["visa", "mastercard"].includes(method);
  }
  // If method unknown, default to treating it as direct charge (safer for server load)
  return true;
};

const getPaymentAgeMs = (payment) => {
  const createdAt = payment?.createdAt ? new Date(payment.createdAt).getTime() : 0;
  if (!createdAt) return Number.POSITIVE_INFINITY;
  return Date.now() - createdAt;
};

class PaymentController {
  async checkPaymentStatus(req, res) {
    try {
      const { txn } = req.query;
      console.log(`\n[PAYMENT-STATUS] ============================================`);
      console.log(`[PAYMENT-STATUS] Checking status for txn: ${txn}`);
      
      if (!txn) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "Transaction ID (txn) is required",
        });
      }

      const payment = await Payment.findOne({ transactionId: txn });

      if (!payment) {
        console.log(`[PAYMENT-STATUS] ❌ Payment record NOT FOUND for txn: ${txn}`);
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          status: "NOT_FOUND",
          error: "Payment record not found",
        });
      }

      console.log(`[PAYMENT-STATUS] Found payment - Current status: ${payment.status}, Provider: ${payment.provider}`);

      // If pending, check with provider
      if (payment.status === "PENDING") {
        try {
          console.log(
            `Checking payment status for ${txn}. Provider: ${payment.provider || "undefined (defaulting to SantimPay)"}`
          );

          if (payment.provider === "chapa") {
            const paymentAgeMs = getPaymentAgeMs(payment);
            const isDirect = isDirectChargePayment(payment);

            // ── Auto-expire stale direct-charge payments ──────────────────
            // If the user abandoned their USSD/mobile prompt and Chapa never
            // updated the status, we stop waiting after DIRECT_CHARGE_EXPIRY_MS.
            if (isDirect && paymentAgeMs > DIRECT_CHARGE_EXPIRY_MS) {
              console.log(
                `[CHAPA-VERIFY] ⏰ Direct-charge payment ${txn} has been PENDING for ` +
                `${Math.round(paymentAgeMs / 60000)} min — marking as EXPIRED`
              );
              payment.status = "CANCELLED";
              await payment.save();
            } else {
              // ── Single verify call ─────────────────────────────────────
              // For direct-charge: do ONE call and return immediately.
              // Retrying within the same request is pointless — Chapa won't
              // resolve a USSD session in under a second.
              //
              // For web-checkout (Visa/Mastercard): keep the retry loop since
              // those can resolve quickly after a redirect.
              const maxAttempts = isDirect ? 1 : 5;
              const CHAPA_VERIFY_RETRY_BASE_DELAY_MS = 500;
              const isWithinGracePeriod = paymentAgeMs < CHAPA_PAYMENT_GRACE_MS;

              let attempts = 0;

              while (attempts < maxAttempts) {
                try {
                  console.log(`[CHAPA-VERIFY] Attempting to verify transaction ${txn} (attempt ${attempts + 1}/${maxAttempts})`);
                  const verifyResponse = await ChapaService.verify(txn);
                  console.log(`[CHAPA-VERIFY] Raw Chapa Verify Response for ${txn}:`, JSON.stringify(verifyResponse));

                  const apiStatus = verifyResponse?.status;
                  const paymentStatus = verifyResponse?.data?.status || verifyResponse?.status;
                  const normalizedApiStatus = String(apiStatus || "").toLowerCase();
                  const normalizedPaymentStatus = String(paymentStatus || "").toLowerCase();

                  console.log(`[CHAPA-VERIFY] Extracted apiStatus: "${apiStatus}", paymentStatus: "${paymentStatus}"`);

                  if (normalizedApiStatus === "success" && normalizedPaymentStatus) {
                    console.log(`[CHAPA-VERIFY] Processing payment status: "${paymentStatus}"`);

                    if (["success", "completed", "paid"].includes(normalizedPaymentStatus)) {
                      console.log(`[CHAPA-VERIFY] ✅ Payment ${txn} is successful, marking as PAID`);
                      payment.status = "PAID";
                      await payment.save();
                      await processSuccessfulPayment(payment);
                      break;
                    } else if (
                      normalizedPaymentStatus.includes("fail") ||
                      normalizedPaymentStatus.includes("cancel")
                    ) {
                      if (!isDirect && isWithinGracePeriod) {
                        // Web-checkout only: give it a grace period
                        console.log(`[CHAPA-VERIFY] ⏳ Within grace period, keeping pending`);
                        attempts = maxAttempts;
                        break;
                      }
                      const terminalStatus = normalizedPaymentStatus.includes("cancel") ? "CANCELLED" : "FAILED";
                      console.log(`[CHAPA-VERIFY] ❌ Payment ${txn} → ${terminalStatus}`);
                      payment.status = terminalStatus;
                      await payment.save();
                      break;
                    } else {
                      // Still pending — for direct charge this is completely normal
                      console.log(
                        isDirect
                          ? `[CHAPA-VERIFY] ⏳ Direct charge ${txn} awaiting user action (status: "${paymentStatus}") — returning PENDING`
                          : `[CHAPA-VERIFY] ⏳ Payment ${txn} still pending: "${paymentStatus}"`
                      );
                      attempts++;
                      if (!isDirect && attempts < maxAttempts) {
                        const backoff = Math.min(
                          CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                          4000
                        );
                        console.log(`[CHAPA-VERIFY] Retrying in ${backoff}ms...`);
                        await new Promise((resolve) => setTimeout(resolve, backoff));
                      }
                    }
                  } else {
                    attempts++;
                    if (!isDirect && attempts < maxAttempts) {
                      const backoff = Math.min(
                        CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                        4000
                      );
                      await new Promise((resolve) => setTimeout(resolve, backoff));
                    }
                  }
                } catch (verifyError) {
                  console.error(`[CHAPA-VERIFY] Attempt ${attempts + 1} failed:`, verifyError.message);
                  attempts++;
                  if (!isDirect && attempts < maxAttempts) {
                    const backoff = Math.min(
                      CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                      4000
                    );
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                  }
                }
              }
            }
          } else if (payment.provider === "chapa_giftcard") {
            // Chapa Link gift-card top-up — verified against the Link API's own
            // status endpoint (never trust client polling alone), keyed by the
            // link_reference saved at initiation time.
            if (!payment.giftCardLinkReference) {
              console.error(`[GIFTCARD-VERIFY] Payment ${txn} has no giftCardLinkReference`);
            } else {
              try {
                const statusData = await ChapaGiftCardService.getPaymentStatus(
                  payment.giftCardLinkReference
                );
                const remoteStatus = String(statusData?.status || "").toLowerCase();
                const remoteAmount = Number(statusData?.amount) / 100; // cents -> major unit

                console.log(`[GIFTCARD-VERIFY] ${txn} -> status: ${remoteStatus}, amount: ${remoteAmount}`);

                if (remoteStatus === "success") {
                  if (!amountsMatch(remoteAmount, payment.price)) {
                    console.error(`[GIFTCARD-VERIFY] Amount mismatch for ${txn}: expected ${payment.price}, got ${remoteAmount}`);
                  } else {
                    payment.status = "PAID";
                    await payment.save();
                    await processSuccessfulPayment(payment);
                  }
                } else if (remoteStatus === "failed" || remoteStatus === "cancelled") {
                  payment.status = remoteStatus === "cancelled" ? "CANCELLED" : "FAILED";
                  await payment.save();
                }
                // "pending" — leave as-is, frontend will poll again
              } catch (err) {
                console.error(`[GIFTCARD-VERIFY] Status check failed for ${txn}:`, err.message);
              }
            }
          } else {
            // SantimPay
            const statusData = await SantimPayService.checkTransactionStatus(txn);
            console.log(`SantimPay Status Response for ${txn}:`, JSON.stringify(statusData, null, 2));

            let remoteStatus = statusData.status || statusData.paymentStatus;
            if (remoteStatus) remoteStatus = remoteStatus.toUpperCase();

            if (remoteStatus === "COMPLETED" || remoteStatus === "SUCCESS") {
              payment.status = "PAID";
              await payment.save();
              await processSuccessfulPayment(payment);
            } else if (
              remoteStatus === "FAILED" ||
              remoteStatus === "CANCELLED" ||
              remoteStatus === "CANCELED" ||
              remoteStatus === "EXPIRED"
            ) {
              payment.status = (remoteStatus === "CANCELLED" || remoteStatus === "CANCELED") ? "CANCELLED" : "FAILED";
              await payment.save();
              console.log(`Payment ${txn} marked as ${payment.status}`);
            }
          }
        } catch (err) {
          console.error(
            `Error checking ${payment.provider || "SantimPay"} status:`,
            err.message || err
          );
        }
      }

      // Map internal status to frontend expected status
      // Frontend expects: "COMPLETED" for success, "CANCELLED" for cancelled
      let status = payment.status;
      let ticketId = null;
      let newUserCredentials = null;

      if (status === "PAID") {
        status = "COMPLETED";
      } else if (status === "CANCELLED") {
        status = "CANCELLED"; // Keep CANCELLED as is for frontend
      } else if (status === "FAILED") {
        status = "FAILED"; // Keep FAILED as is for frontend
      }

      // Only fetch ticket if payment was successful
      if (status === "COMPLETED") {
        // Find the ticket associated with this transaction
        const ticket = await Ticket.findOne({ paymentReference: txn });
        if (ticket) {
          ticketId = ticket.ticketId;
          console.log(`[PAYMENT-STATUS] ✅ Ticket found: ${ticketId}`);
          console.log(`[PAYMENT-STATUS] Ticket.user: ${ticket.user}`);
          console.log(`[PAYMENT-STATUS] Payment.userId: ${payment.userId}`);
          
          // ⚡ CRITICAL: Verify ticket is linked to user
          if (ticket.user) {
            const userCheck = await User.findById(ticket.user).select('_id email tickets');
            if (userCheck) {
              console.log(`[PAYMENT-STATUS] ✅ User ${userCheck._id} exists`);
              console.log(`[PAYMENT-STATUS] User has ${userCheck.tickets?.length || 0} tickets`);
              const hasTicket = userCheck.tickets?.some(t => t.toString() === ticket._id.toString());
              console.log(`[PAYMENT-STATUS] User has this ticket in array: ${hasTicket}`);
            } else {
              console.log(`[PAYMENT-STATUS] ⚠️ User ${ticket.user} NOT FOUND in database`);
            }
          } else {
            console.log(`[PAYMENT-STATUS] ⚠️ Ticket has no user field!`);
          }
        } else {
          console.log(`[PAYMENT-STATUS] ⚠️ Payment PAID but ticket NOT found yet`);
        }
        
        // 🔐 AUTO-LOGIN: Always return credentials if ticket has user
        // Frontend will decide whether to use them based on current auth state
        console.log(`[PAYMENT-STATUS] ticket exists: ${!!ticket}`);
        console.log(`[PAYMENT-STATUS] ticket.user: ${ticket?.user}`);
        
        if (ticket && ticket.user) {
          const ticketUser = await User.findById(ticket.user).select('email phoneNumber');
          if (ticketUser) {
            newUserCredentials = {
              email: ticketUser.email,
              password: ticketUser.phoneNumber, // Phone is always password
            };
            console.log(`[PAYMENT-STATUS] ✅ Returning credentials for auto-login`);
            console.log(`[PAYMENT-STATUS] Email: ${ticketUser.email}, Phone: ${ticketUser.phoneNumber}`);
          } else {
            console.log(`[PAYMENT-STATUS] ⚠️ Could not find user ${ticket.user}`);
          }
        } else {
          console.log(`[PAYMENT-STATUS] ℹ️ No ticket or user found`);
        }
      }

      console.log(`[PAYMENT-STATUS] Returning status: ${status}${ticketId ? `, ticketId: ${ticketId}` : ''}`);
      console.log(`[PAYMENT-STATUS] newUserCredentials:`, newUserCredentials ? `email: ${newUserCredentials.email}, password: SET` : 'null');
      console.log(`[PAYMENT-STATUS] ============================================\n`);

      return res.status(StatusCodes.OK).json({
        success: true,
        status: status,
        transactionId: payment.transactionId,
        ticketId: ticketId,
        newUserCredentials: newUserCredentials,
      });
    } catch (error) {
      console.error("[PAYMENT-STATUS] ❌ Error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to check payment status",
      });
    }
  }

  async cancelPayment(req, res) {
    try {
      const { transactionId } = req.body;
      console.log(`\n[PAYMENT-CANCEL] ============================================`);
      console.log(`[PAYMENT-CANCEL] Canceling payment for txn: ${transactionId}`);
      
      if (!transactionId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "Transaction ID is required",
        });
      }

      const payment = await Payment.findOne({ transactionId });

      if (!payment) {
        console.log(`[PAYMENT-CANCEL] ❌ Payment record NOT FOUND for txn: ${transactionId}`);
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "Payment record not found",
        });
      }

      // Only cancel if payment is still pending
      if (payment.status === "PENDING") {
        payment.status = "CANCELLED";
        await payment.save();
        console.log(`[PAYMENT-CANCEL] ✅ Payment ${transactionId} marked as CANCELLED`);
      } else {
        console.log(`[PAYMENT-CANCEL] ⚠️ Payment ${transactionId} status is already ${payment.status}`);
      }

      console.log(`[PAYMENT-CANCEL] ============================================\n`);
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Payment cancelled successfully",
        status: payment.status,
      });
    } catch (error) {
      console.error("[PAYMENT-CANCEL] ❌ Error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to cancel payment",
      });
    }
  }
}

module.exports = new PaymentController();
