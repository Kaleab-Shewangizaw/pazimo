const jwt = require("jsonwebtoken");
const SantimpaySdk = require("../../santimSDK/index.js");

class SantimPayService {
  constructor() {
    let privateKey = process.env.SANTIM_PAY_PRIVATE_KEY;

    // Debug key format
    if (privateKey) {
      console.log("SantimPay Private Key Length:", privateKey.length);

      // Aggressively fix newlines if literal \n is found
      if (privateKey.includes("\\n")) {
        console.log(
          "Fixing SantimPay Private Key: Replacing literal \\n with actual newlines"
        );
        privateKey = privateKey.replace(/\\n/g, "\n");
      }

      // Remove surrounding quotes if they exist (artifact of some env injections)
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }

      console.log("Key starts with:", privateKey.substring(0, 30));
    } else {
      console.error("SantimPay Private Key is MISSING!");
    }

    this.sdk = new SantimpaySdk(
      process.env.SANTIM_PAY_MERCHANT_ID,
      privateKey,
      process.env.NODE_ENV === "development" // True for sandbox if NODE_ENV is development
    );
    this.publicKey = process.env.SANTIM_PAY_PUBLIC_KEY;
  }

  async initiatePayment(data) {
    try {
      const paymentUrl = await this.sdk.generatePaymentUrl(
        data.transactionId,
        data.amount,
        data.paymentReason,
        data.successRedirectUrl,
        data.failureRedirectUrl,
        data.notifyUrl,
        data.phoneNumber,
        data.cancelRedirectUrl
      );

      return {
        paymentUrl,
        transactionId: data.transactionId,
        paymentId: null, // SDK doesn't return this immediately for initiate
      };
    } catch (error) {
      console.error("SantimPay Initiate Payment Error:", error);
      throw error;
    }
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
