const axios = require("axios");

const sendSMS = async (phone, message) => {
  try {
    // Format phone number
    let formattedPhone = phone.toString().replace("+", "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "251" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("251")) {
      formattedPhone = "251" + formattedPhone;
    }

    const response = await axios.post(
      "https://api.geezsms.com/api/v1/sms/send",
      {
        phone: formattedPhone,
        msg: message,
        token:
          process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
      },
      {
        timeout: 15000, // 15 seconds timeout
      }
    );

    return { success: true };
  } catch (error) {
    console.error("SMS send error:", error.message);
    if (error.response) {
      console.error("SMS API Response:", error.response.data);
    }
    return { success: false, error: error.message || "Failed to send SMS" };
  }
};

module.exports = { sendSMS };
