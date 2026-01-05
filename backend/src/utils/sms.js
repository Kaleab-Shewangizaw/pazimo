const sendSMS = async (phone, message) => {
  try {
    const response = await fetch(
      "https://api.geezsms.com/api/v1/sms/send/bulk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GeezSMS-Key": "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
        },
        body: JSON.stringify({
          contacts: [{ phone_number: phone }],
          msg: message,
          sender: "Pazimo Invitation",
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const errorData = await response.text();
      console.error("Geez SMS API error:", errorData);
      return { success: false, error: "SMS service error" };
    }
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error: "Failed to send SMS" };
  }
};

module.exports = { sendSMS };
