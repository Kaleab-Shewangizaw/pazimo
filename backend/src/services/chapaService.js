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
    return await this.chapa.initialize(data);
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

    // Ensure currency is ETB
    data.currency = "ETB";

    console.log("Initiating Chapa Direct Charge:", {
      ...data,
      mobile: data.mobile ? `${data.mobile.substring(0, 4)}***` : "undefined",
    });

    // data: { amount, currency, mobile, type, email, first_name, last_name, tx_ref }
    return await this.chapa.directCharge(data);
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
