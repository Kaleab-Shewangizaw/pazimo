const { StatusCodes } = require("http-status-codes");
const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const SantimPayService = require("../services/santimPayService");
const { processSuccessfulPayment } = require("./ticketController");

const ChapaService = require("../services/chapaService");

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
            // Check Chapa Status with retry
            let verifyResponse;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
              try {
                verifyResponse = await ChapaService.verify(txn);
                console.log(`Chapa Verify Response for ${txn} (attempt ${attempts + 1}):`, verifyResponse);
                
                if (verifyResponse.status === "success" && verifyResponse.data) {
                  const chapaStatus = verifyResponse.data.status;

                  if (chapaStatus === "success") {
                    payment.status = "PAID";
                    await payment.save();
                    console.log(`Payment ${txn} marked as PAID, creating tickets...`);
                    await processSuccessfulPayment(payment);
                    break; // Exit retry loop
                  } else if (chapaStatus === "failed") {
                    payment.status = "FAILED";
                    await payment.save();
                    break;
                  } else {
                    // Status is still pending, retry
                    attempts++;
                    if (attempts < maxAttempts) {
                      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                    }
                  }
                } else {
                  attempts++;
                  if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              } catch (verifyError) {
                console.error(`Chapa verify attempt ${attempts + 1} failed:`, verifyError.message);
                attempts++;
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
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
              remoteStatus === "EXPIRED"
            ) {
              payment.status = "FAILED";
              await payment.save();
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
      // Frontend expects: "COMPLETED" for success
      let status = payment.status;
      let ticketId = null;

      if (status === "PAID") {
        status = "COMPLETED";
        // Find the ticket associated with this transaction
        const ticket = await Ticket.findOne({ paymentReference: txn });
        if (ticket) {
          ticketId = ticket.ticketId;
          console.log(`[PAYMENT-STATUS] ✅ Ticket found: ${ticketId}`);
        } else {
          console.log(`[PAYMENT-STATUS] ⚠️ Payment PAID but ticket NOT found yet`);
        }
      }

      console.log(`[PAYMENT-STATUS] Returning status: ${status}${ticketId ? `, ticketId: ${ticketId}` : ''}`);
      console.log(`[PAYMENT-STATUS] ============================================\n`);

      return res.status(StatusCodes.OK).json({
        success: true,
        status: status,
        transactionId: payment.transactionId,
        ticketId: ticketId,
      });
    } catch (error) {
      console.error("[PAYMENT-STATUS] ❌ Error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to check payment status",
      });
    }
  }
}

module.exports = new PaymentController();
