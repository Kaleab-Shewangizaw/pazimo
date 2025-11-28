require("dotenv").config();
const jwt = require("jsonwebtoken");

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("SANTIM_PAY_MERCHANT_ID:", process.env.SANTIM_PAY_MERCHANT_ID);

const privateKey = process.env.SANTIM_PAY_PRIVATE_KEY;
console.log("SANTIM_PAY_PRIVATE_KEY type:", typeof privateKey);
console.log("SANTIM_PAY_PRIVATE_KEY length:", privateKey ? privateKey.length : 0);

if (privateKey) {
  console.log("First 30 chars:", privateKey.substring(0, 30));
  console.log("Last 30 chars:", privateKey.substring(privateKey.length - 30));
  console.log("Contains newline characters:", privateKey.includes("\n"));
  console.log("Contains literal \\n characters:", privateKey.includes("\\n"));
  
  // Try to fix the key if it has literal \n
  const fixedKey = privateKey.replace(/\\n/g, '\n');
  console.log("Fixed key contains newline characters:", fixedKey.includes("\n"));
  
  try {
      console.log("Attempting to sign with original key...");
      const token = jwt.sign({ test: "data" }, privateKey, { algorithm: "ES256" });
      console.log("Successfully signed token with original key:", token);
  } catch (error) {
      console.error("Error signing token with original key:", error.message);
      
      try {
          console.log("Attempting to sign with fixed key (replaced \\n with newline)...");
          const token = jwt.sign({ test: "data" }, fixedKey, { algorithm: "ES256" });
          console.log("Successfully signed token with fixed key:", token);
      } catch (error2) {
          console.error("Error signing token with fixed key:", error2.message);
      }
  }
}

