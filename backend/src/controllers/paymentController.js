const { StatusCodes } = require("http-status-codes");
const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const SantimPayService = require("../services/santimPayService");
const { processSuccessfulPayment } = require("./ticketController");

const ChapaService = require("../services/chapaService");

const CHAPA_PAYMENT_GRACE_MS = 2 * 60 * 1000;
const CHAPA_VERIFY_RETRY_COUNT = 5;
const CHAPA_VERIFY_RETRY_BASE_DELAY_MS = 500;

const getPaymentAgeMs = (payment) => {
  const createdAt = payment?.createdAt ? new Date(payment.createdAt).getTime() : 0;
  if (!createdAt) {
    return Number.POSITIVE_INFINITY;
  }

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

      // If pending, check with Provider directly - WITH RETRY LOGIC
      if (payment.status === "PENDING") {
        try {
          console.log(
            `Checking payment status for ${txn}. Provider: ${
              payment.provider || "undefined (defaulting to SantimPay)"
            }`
          );

          if (payment.provider === "chapa") {
            // ⚡ OPTIMIZED: Check Chapa Status with faster retry timing
            let verifyResponse;
            let attempts = 0;
            const maxAttempts = CHAPA_VERIFY_RETRY_COUNT;
            const paymentAgeMs = getPaymentAgeMs(payment);
            const isWithinGracePeriod = paymentAgeMs < CHAPA_PAYMENT_GRACE_MS;
            
            while (attempts < maxAttempts) {
              try {
                console.log(`[CHAPA-VERIFY] Attempting to verify transaction ${txn} (attempt ${attempts + 1}/${maxAttempts})`);
                verifyResponse = await ChapaService.verify(txn);
                console.log(`[CHAPA-VERIFY] Raw Chapa Verify Response for ${txn}:`, JSON.stringify(verifyResponse, null, 2));
                
                // Check different possible response structures
                let apiStatus = null;
                let paymentStatus = null;
                
                if (verifyResponse) {
                  apiStatus = verifyResponse.status;
                  paymentStatus = verifyResponse.data?.status || verifyResponse.status;
                }

                const normalizedApiStatus = String(apiStatus || "").toLowerCase();
                const normalizedPaymentStatus = String(paymentStatus || "").toLowerCase();
                
                console.log(`[CHAPA-VERIFY] Extracted apiStatus: "${apiStatus}", paymentStatus: "${paymentStatus}"`);
                
                if (normalizedApiStatus === "success" && normalizedPaymentStatus) {
                  console.log(`[CHAPA-VERIFY] Processing payment status: "${paymentStatus}"`);
                  
                  if (normalizedPaymentStatus === "success" || normalizedPaymentStatus === "completed" || normalizedPaymentStatus === "paid") {
                    console.log(`[CHAPA-VERIFY] ✅ Payment ${txn} is successful, marking as PAID`);
                    payment.status = "PAID";
                    await payment.save();
                    console.log(`[CHAPA-VERIFY] Payment ${txn} marked as PAID, creating tickets...`);
                    await processSuccessfulPayment(payment);
                    break; // Exit retry loop
                  } else if (
                    normalizedPaymentStatus === "failed" || 
                    normalizedPaymentStatus === "failure" ||
                    normalizedPaymentStatus.includes("failed") ||
                    normalizedPaymentStatus.includes("failure") ||
                    normalizedPaymentStatus === "cancelled" || 
                    normalizedPaymentStatus === "canceled" ||
                    normalizedPaymentStatus.includes("cancel")
                  ) {
                    if (isWithinGracePeriod) {
                      console.log(
                        `[CHAPA-VERIFY] ⏳ Payment ${txn} returned terminal-looking status "${paymentStatus}" but is still within the ${Math.round(CHAPA_PAYMENT_GRACE_MS / 1000)}s grace period; keeping it pending for a later retry.`
                      );
                      attempts = maxAttempts;
                      break;
                    }

                    const terminalStatus = normalizedPaymentStatus.includes("cancel")
                      ? "CANCELLED"
                      : "FAILED";
                    console.log(`[CHAPA-VERIFY] ❌ Payment ${txn} ${terminalStatus.toLowerCase()} with status: ${paymentStatus}`);
                    payment.status = terminalStatus;
                    await payment.save();
                    console.log(`Payment ${txn} marked as ${terminalStatus} (Chapa status: ${paymentStatus})`);
                    break;
                  } else {
                    // Status is still pending or unknown
                    console.log(`[CHAPA-VERIFY] ⏳ Payment ${txn} still pending or unknown status: "${paymentStatus}"`);
                    attempts++;
                    if (attempts < maxAttempts) {
                      const backoff = Math.min(
                        CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                        4000
                      );
                      console.log(`[CHAPA-VERIFY] Retrying in ${backoff}ms...`);
                      await new Promise(resolve => setTimeout(resolve, backoff));
                    }
                  }
                } else {
                  console.log(`[CHAPA-VERIFY] ⚠️ Chapa response missing success status or data:`, {
                    hasResponse: !!verifyResponse,
                    apiStatus,
                    hasData: !!verifyResponse?.data,
                    dataKeys: verifyResponse?.data ? Object.keys(verifyResponse.data) : []
                  });
                  attempts++;
                  if (attempts < maxAttempts) {
                    const backoff = Math.min(
                      CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                      4000
                    );
                    await new Promise(resolve => setTimeout(resolve, backoff));
                  }
                }
              } catch (verifyError) {
                console.error(`[CHAPA-VERIFY] Attempt ${attempts + 1} failed:`, verifyError.message);
                attempts++;
                if (attempts < maxAttempts) {
                  const backoff = Math.min(
                    CHAPA_VERIFY_RETRY_BASE_DELAY_MS * Math.pow(2, attempts - 1),
                    4000
                  );
                  await new Promise(resolve => setTimeout(resolve, backoff));
                }
              }
            }
            
            if (attempts >= maxAttempts) {
              console.log(`[CHAPA-VERIFY] ❌ All ${maxAttempts} attempts failed for ${txn}`);
            }
          } else {
            // Default to SantimPay
            const statusData = await SantimPayService.checkTransactionStatus(
              txn
            );
            console.log(
              `SantimPay Status Response for ${txn}:`,
              JSON.stringify(statusData, null, 2)
            );

            // Check status from SantimPay response
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
              // Map all failure statuses properly
              if (remoteStatus === "CANCELLED" || remoteStatus === "CANCELED") {
                payment.status = "CANCELLED";
              } else {
                payment.status = "FAILED";
              }
              await payment.save();
              console.log(`Payment ${txn} marked as ${payment.status}`);
            }
          }
        } catch (err) {
          console.error(
            `Error checking ${payment.provider || "SantimPay"} status:`,
            err.message || err
          );
          // Ignore error and return current DB status
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
