const { Chapa } = require("chapa-nodejs");

const SUPPORTED_CHAPA_METHODS = [
  "telebirr",
  "mpesa",
  "CBEBirr",
  "Coopay-Ebirr",
  "AwashBirr",
  "yaya",
  "Amole",
];

class ChapaService {
  constructor() {
    this.chapa = new Chapa({
      secretKey: process.env.CHAPA_SECRET_KEY,
    });
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
    // Chapa SDK expects an object with tx_ref
    return await this.chapa.verify({ tx_ref });
  }
}

module.exports = new ChapaService();
