const jwt = require("jsonwebtoken");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

class SantimPayService {
  constructor() {
    this.merchantId = process.env.SANTIM_PAY_MERCHANT_ID;
    this.privateKey = process.env.SANTIM_PAY_PRIVATE_KEY;
    this.publicKey = process.env.SANTIM_PAY_PUBLIC_KEY;

    // FORCE PRODUCTION URL as requested
    this.isProduction = true;
    this.baseUrl = "https://services.santimpay.com/api/v1/gateway";

    console.log("SantimPay Service Initialized: PRODUCTION Mode (Forced)");
  }

  generateSignedToken(amount, paymentReason) {
    if (!this.privateKey) {
      throw new Error("SANTIM_PAY_PRIVATE_KEY is not defined");
    }

    // Ensure private key is in correct format (replace literal \n with actual newlines if needed)
    const privateKey = this.privateKey.replace(/\\n/g, "\n");

    const payload = {
      amount,
      paymentReason,
      merchantId: this.merchantId,
      generated: Math.floor(Date.now() / 1000),
    };

    // Sign with ES256
    const token = jwt.sign(payload, privateKey, { algorithm: "ES256" });
    return token;
  }

  async initiatePayment({
    amount,
    paymentReason,
    successRedirectUrl,
    failureRedirectUrl,
    cancelRedirectUrl,
    notifyUrl,
    phoneNumber,
    transactionId,
    paymentMethod,
  }) {
    const token = this.generateSignedToken(amount, paymentReason);
    const txnId = transactionId || uuidv4();

    const payload = {
      id: txnId,
      amount,
      reason: paymentReason,
      merchantId: this.merchantId,
      signedToken: token,
      successRedirectUrl,
      failureRedirectUrl,
      cancelRedirectUrl,
      notifyUrl,
    };

    if (phoneNumber) {
      payload.phoneNumber = phoneNumber;
    }

    if (paymentMethod) {
      payload.paymentMethod = paymentMethod;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/initiate-payment`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        transactionId: txnId,
        paymentUrl: response.data.url, // Adjust based on actual API response structure
        ...response.data,
      };
    } catch (error) {
      console.error(
        "SantimPay Initiate Error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.msg || "Failed to initiate payment"
      );
    }
  }

  generateSignedTokenForGetTransaction(id) {
    if (!this.privateKey) {
      throw new Error("SANTIM_PAY_PRIVATE_KEY is not defined");
    }
    const privateKey = this.privateKey.replace(/\\n/g, "\n");
    const payload = {
      id,
      merId: this.merchantId,
      generated: Math.floor(Date.now() / 1000),
    };
    return jwt.sign(payload, privateKey, { algorithm: "ES256" });
  }

  async checkTransactionStatus(transactionId) {
    const token = this.generateSignedTokenForGetTransaction(transactionId);
    try {
      console.log(
        `Checking status for ${transactionId} at ${this.baseUrl}/fetch-transaction-status`
      );
      const response = await axios.post(
        `${this.baseUrl}/fetch-transaction-status`,
        {
          id: transactionId,
          merchantId: this.merchantId,
          signedToken: token,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "SantimPay Status Check Error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.msg || "Failed to check transaction status"
      );
    }
  }

  verifyWebhook(token) {
    if (!this.publicKey) {
      throw new Error("SANTIM_PAY_PUBLIC_KEY is not defined");
    }
    const publicKey = this.publicKey.replace(/\\n/g, "\n");

    try {
      // Verify the token (signature) using the public key
      return jwt.verify(token, publicKey, { algorithms: ["ES256"] });
    } catch (err) {
      throw new Error("Invalid webhook signature: " + err.message);
    }
  }
}

module.exports = new SantimPayService();
