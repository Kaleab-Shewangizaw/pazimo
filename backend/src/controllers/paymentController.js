const { StatusCodes } = require("http-status-codes");
const paymentService = require("../services/paymentService");
const CustomError = require("../errors/customError");
const { processPaidInvitations } = require("./invitationController");

class PaymentController {
  async initializePayment(req, res) {
    this.handleErrors(res, async () => {
      const paymentData = {
        ...req.body,
        tx_ref:
          req.body.tx_ref ||
          `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      };

      const result = await paymentService.initializeTransaction(paymentData);
      res.status(StatusCodes.OK).json(result);
    });
  }

  async handleCallback(req, res) {
    this.handleErrors(res, async () => {
      const { trx_ref, ref_id, status } = req.query;

      await paymentService.verifyCallback({ trx_ref, ref_id, status });

      const transactionDetails = await paymentService.verifyTransaction(
        trx_ref
      );

      if (transactionDetails.status !== "success") {
        throw new CustomError(
          "Transaction verification failed",
          StatusCodes.BAD_REQUEST
        );
      }

      const paymentInfo = await paymentService.getStoredPaymentInfo(trx_ref);
      if (!paymentInfo) {
        throw new CustomError(
          "Payment information not found",
          StatusCodes.NOT_FOUND
        );
      }

      // Handle Invitation Payment
      if (paymentInfo.type === "invitation" && paymentInfo.invitationIds) {
        const invitationIds = Array.isArray(paymentInfo.invitationIds)
          ? paymentInfo.invitationIds
          : JSON.parse(paymentInfo.invitationIds);

        await processPaidInvitations(invitationIds);

        const successUrl = `${
          process.env.NEXT_PUBLIC_FRONTEND_URL ||
          process.env.FRONTEND_URL ||
          "http://localhost:3000"
        }/organizer/invitations?status=success`;
        return res.redirect(successUrl);
      }

      let ticketType =
        paymentInfo.ticketTypeId ||
        paymentInfo.ticketType ||
        paymentInfo.ticketTypeName;
      if (!ticketType && transactionDetails.data?.customization?.description) {
        const match =
          transactionDetails.data.customization.description.match(
            /\d+\s*x\s*(.+)/
          );
        if (match) ticketType = match[1].trim();
      }

      const purchaseData = {
        eventId: paymentInfo.eventId,
        ticketType,
        quantity: paymentInfo.quantity,
        userId: paymentInfo.userId,
        transactionReference: trx_ref,
        referenceId: ref_id,
      };

      const ticketResult = await paymentService.completeTicketPurchase(
        purchaseData
      );

      const successUrl = `${
        process.env.NEXT_PUBLIC_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:3000"
      }/payment/success?id=${paymentInfo.eventId}&quantity=${
        paymentInfo.quantity
      }&ticketType=${encodeURIComponent(
        ticketType || "Regular"
      )}&tx_ref=${trx_ref}`;
      res.redirect(successUrl);
    });
  }

  async verifyTransaction(req, res) {
    this.handleErrors(res, async () => {
      const { tx_ref } = req.params;
      const result = await paymentService.verifyTransaction(tx_ref);
      res.status(StatusCodes.OK).json(result);
    });
  }

  handleErrors(res, fn) {
    fn().catch((error) => {
      res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message,
      });
    });
  }
}

module.exports = new PaymentController();
