const jwt = require("jsonwebtoken");
const SantimpaySdk = require("../../santimSDK/index.js");

class SantimPayService {
  constructor() {
    this.sdk = new SantimpaySdk(
      process.env.SANTIM_PAY_MERCHANT_ID,
      process.env.SANTIM_PAY_PRIVATE_KEY,
      false // Set to true for sandbox if needed, false for production
    );
    this.publicKey = process.env.SANTIM_PAY_PUBLIC_KEY;
  }

  async directPayment(
    transactionId,
    amount,
    paymentReason,
    notifyUrl,
    phoneNumber,
    paymentMethod
  ) {
    try {
      return await this.sdk.directPayment(
        transactionId,
        amount,
        paymentReason,
        notifyUrl,
        phoneNumber,
        paymentMethod
      );
    } catch (error) {
      console.error("SantimPay Direct Payment Error:", error);
      throw error;
    }
  }

  async checkTransactionStatus(transactionId) {
    try {
      return await this.sdk.checkTransactionStatus(transactionId);
    } catch (error) {
      console.error("SantimPay Status Check Error:", error);
      throw error;
    }
  }

  verifyWebhook(token) {
    if (!this.publicKey) {
      throw new Error("SANTIM_PAY_PUBLIC_KEY is not defined");
    }
    const publicKey = this.publicKey.replace(/\\n/g, "\n");

    try {
      return jwt.verify(token, publicKey, { algorithms: ["ES256"] });
    } catch (err) {
      throw new Error("Invalid webhook signature: " + err.message);
    }
  }
}

module.exports = new SantimPayService();
