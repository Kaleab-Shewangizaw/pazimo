const ChapaService = require("../services/chapaService");

// Generate unique transaction reference
exports.generateChapaTxRef = async (req, res) => {
  try {
    const tx_ref = await ChapaService.generateTxRef();
    return res.json({ success: true, tx_ref });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Initialize Chapa web checkout
exports.initChapaTransaction = async (req, res) => {
  try {
    const {
      amount,
      currency,
      email,
      first_name,
      last_name,
      phone_number,
      return_url,
      callback_url,
      customization,
    } = req.body;
    const tx_ref = await ChapaService.generateTxRef();
    const response = await ChapaService.initialize({
      amount: String(amount),
      currency: currency || "ETB",
      tx_ref,
      email,
      first_name,
      last_name,
      phone_number,
      return_url,
      callback_url,
      customization,
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Direct Charge (telebirr, mpesa, CBEBirr, Coopay-Ebirr, AwashBirr, Yaya, EnatBank portal)
exports.chapaDirectCharge = async (req, res) => {
  try {
    const { amount, currency, mobile, type, email, first_name, last_name } =
      req.body;
    const tx_ref = await ChapaService.generateTxRef();
    const response = await ChapaService.directCharge({
      amount: String(amount),
      currency: currency || "ETB",
      mobile,
      type, // e.g. 'telebirr', 'mpesa', 'CBEBirr', 'Coopay-Ebirr', 'AwashBirr', 'yaya', 'EnatBank'
      tx_ref,
      email,
      first_name,
      last_name,
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
