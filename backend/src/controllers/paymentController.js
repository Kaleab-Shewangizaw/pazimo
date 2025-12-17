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
      if (!txn) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "Transaction ID (txn) is required",
        });
      }

      const payment = await Payment.findOne({ transactionId: txn });

      if (!payment) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          status: "NOT_FOUND",
          error: "Payment record not found",
        });
      }

      // If pending, check with Provider directly
      if (payment.status === "PENDING") {
        try {
          if (payment.provider === "chapa") {
            // Check Chapa Status
            const verifyResponse = await ChapaService.verify(txn);
            console.log(`Chapa Verify Response for ${txn}:`, verifyResponse);

            if (verifyResponse.status === "success" && verifyResponse.data) {
              // Chapa status: 'success', 'failed', 'pending'
              // Note: Chapa verify usually returns success if the transaction was successful.
              // If it's pending, it might not return success or might return a different status.
              // Assuming verifyResponse.data.status holds the actual transaction status if available,
              // or verifyResponse.status itself indicates success of the verification call which implies payment success for 'verify'.
              
              // According to Chapa docs, verify returns the transaction details.
              // We should check verifyResponse.data.status
              const chapaStatus = verifyResponse.data.status; 
              
              if (chapaStatus === "success") {
                payment.status = "PAID";
                await payment.save();
                await processSuccessfulPayment(payment);
              } else if (chapaStatus === "failed") {
                payment.status = "FAILED";
                await payment.save();
              }
              // If 'pending', do nothing
            }
          } else {
            // Default to SantimPay
            const statusData = await SantimPayService.checkTransactionStatus(txn);
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
          console.error(`Error checking ${payment.provider || 'SantimPay'} status:`, err.message || err);
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
        }
      }

      return res.status(StatusCodes.OK).json({
        success: true,
        status: status,
        transactionId: payment.transactionId,
        ticketId: ticketId,
      });
    } catch (error) {
      console.error("Check payment status error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to check payment status",
      });
    }
  }
}

module.exports = new PaymentController();
