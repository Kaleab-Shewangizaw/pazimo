const { Chapa } = require("chapa-nodejs");
const axios = require("axios");

const SUPPORTED_CHAPA_METHODS = [
  "telebirr",
  "mpesa",
  "cbebirr",
  "Coopay-Ebirr",
  "awashbirr",
  "yaya",
  "Amole",
];

class ChapaService {
  constructor() {
    this.chapa = new Chapa({
      secretKey: process.env.CHAPA_SECRET_KEY,
    });
    // ⚡ Configure axios with timeout for all Chapa API calls
    // 20 seconds to account for Ethiopian network conditions
    axios.defaults.timeout = 20000;
  }

  async generateTxRef() {
    return await this.chapa.genTxRef();
  }

  async initialize(data) {
    // data: { amount, currency, email, first_name, last_name, phone_number, tx_ref, callback_url, return_url, customization }
    // Uses raw axios instead of the SDK — gives accurate error messages and full control.
    const payload = {
      ...data,
      meta: {
        ...(data.meta || {}),
        hide_receipt: true,
      },
    };

    console.log(`[CHAPA-SERVICE] Initialize (Web Checkout) payload:`, {
      amount: payload.amount,
      currency: payload.currency,
      email: payload.email,
      tx_ref: payload.tx_ref,
      phone_number: payload.phone_number ? payload.phone_number.substring(0, 8) + "***" : "(omitted - international number)",
      callback_url: payload.callback_url?.substring(0, 40) + "...",
      return_url: payload.return_url,
      hide_receipt: payload.meta?.hide_receipt,
    });

    try {
      const response = await axios.post(
        "https://api.chapa.co/v1/transaction/initialize",
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      console.log(`[CHAPA-SERVICE] Initialize successful:`, {
        status: response.data.status,
        hasCheckoutUrl: !!response.data.data?.checkout_url,
      });

      // Return in same shape the rest of the codebase expects
      return response.data;
    } catch (error) {
      const chapaMessage =
        error.response?.data?.message ||
        (typeof error.response?.data === "string" ? error.response.data : null) ||
        error.message ||
        "Chapa initialize failed";

      console.error(`[CHAPA-SERVICE] Initialize failed:`, {
        message: chapaMessage,
        status: error.response?.status,
        data: error.response?.data,
      });

      const err = new Error(chapaMessage);
      err.status = error.response?.status;
      err.data = error.response?.data;
      throw err;
    }
  }

  async directCharge(data) {
    // Validate method
    if (!SUPPORTED_CHAPA_METHODS.includes(data.type)) {
      throw new Error(
        `Invalid Chapa payment method: ${
          data.type
        }. Supported methods are: ${SUPPORTED_CHAPA_METHODS.join(", ")}`
      );
    }

    // Ensure currency is ETB for mobile money direct charge
    // (Web checkout handles USD, direct charge only works with ETB)
    const originalCurrency = data.currency;
    data.currency = "ETB";

    console.log(`[CHAPA-SERVICE] DirectCharge payload:`, {
      ...data,
      mobile: data.mobile ? `${data.mobile.substring(0, 4)}***` : "undefined",
      originalCurrency: originalCurrency,
    });

    try {
      // data: { amount, currency, mobile, type, email, first_name, last_name, tx_ref }
      const result = await this.chapa.directCharge(data);
      return result;
    } catch (error) {
      console.error(`[CHAPA-SERVICE] DirectCharge failed:`, {
        message: error.message,
        status: error.status,
        code: error.code,
        stack: error.stack,
      });
      throw error;
    }
  }

  async verify(tx_ref) {
    // ⚡ Add explicit timeout to prevent hanging on slow Chapa API
    // 20 seconds is reasonable for Ethiopian network conditions
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Chapa verify timeout after 20 seconds')), 20000);
    });
    
    const verifyPromise = this.chapa.verify({ tx_ref });
    
    // Race between verify and timeout
    return await Promise.race([verifyPromise, timeoutPromise]);
  }
}

module.exports = new ChapaService();
