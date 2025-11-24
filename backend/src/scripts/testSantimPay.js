const axios = require("axios");

const API_URL = "http://localhost:5000/api/payments/create";

const testPayment = async () => {
  try {
    console.log("Initiating Payment...");
    const response = await axios.post(API_URL, {
      amount: 150,
      paymentReason: "Test Payment 150 ETB",
      phoneNumber: "0911223344", // Optional
    });

    console.log("Payment Initiated Successfully!");
    console.log("Transaction ID:", response.data.transactionId);
    console.log("Payment URL:", response.data.paymentUrl);
  } catch (error) {
    console.error(
      "Payment Failed:",
      error.response ? error.response.data : error.message
    );
  }
};

testPayment();
