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
    
    // Ensure phone_number has proper formatting for Chapa
    if (data.phone_number && !data.phone_number.startsWith("+")) {
      // If it starts with 0, convert to +251
      if (data.phone_number.startsWith("0")) {
        data.phone_number = "+251" + data.phone_number.substring(1);
      } 
      // If it doesn't have country code, add +251 (Ethiopia)
      else if (!data.phone_number.includes("+")) {
        data.phone_number = "+251" + data.phone_number;
      }
    }

    console.log(`[CHAPA-SERVICE] Initialize (Web Checkout) payload:`, {
      amount: data.amount,
      currency: data.currency,
      email: data.email,
      tx_ref: data.tx_ref,
      phone_number: data.phone_number?.substring(0, 8) + "***",
      callback_url: data.callback_url?.substring(0, 40) + "...",
    });

    try {
      const result = await this.chapa.initialize(data);
      console.log(`[CHAPA-SERVICE] Initialize successful:`, {
        status: result.status,
        hasCheckoutUrl: !!result.data?.checkout_url,
      });
      return result;
    } catch (error) {
      // Extract error details from Chapa SDK error
      const errorData = {
        message: error.message,
        status: error.status,
        code: error.code,
      };

      // Try to extract validation errors
      if (error.response?.data?.message) {
        errorData.validationErrors = error.response.data.message;
      }

      console.error(`[CHAPA-SERVICE] Initialize failed:`, errorData);
      throw error;
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
