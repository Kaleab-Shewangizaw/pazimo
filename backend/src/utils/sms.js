const axios = require("axios");

const sendSMS = async (phone, message, retries = 3) => {
  const startTime = Date.now();
  
  try {
    // Format phone number
    let formattedPhone = phone.toString().replace("+", "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "251" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("251")) {
      formattedPhone = "251" + formattedPhone;
    }

    // Retry logic with exponential backoff
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[SMS] Sending to ${formattedPhone} (attempt ${attempt}/${retries})`);
        
        const response = await axios.post(
          "https://api.geezsms.com/api/v1/sms/send",
          {
            phone: formattedPhone,
            msg: message,
            token:
              process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
          },
          {
            timeout: 10000, // ⚡ Increased to 10 seconds for reliability
          }
        );

        // Validate response
        if (response.data && response.data.status === 'success') {
          const duration = Date.now() - startTime;
          console.log(`[SMS] ✅ Sent successfully in ${duration}ms (attempt ${attempt})`);
          return { success: true, duration, attempts: attempt };
        } else if (response.data && response.data.error) {
          throw new Error(response.data.error);
        }
        
        // If response doesn't indicate success clearly, assume success
        const duration = Date.now() - startTime;
        console.log(`[SMS] ✅ Sent (assumed success) in ${duration}ms (attempt ${attempt})`);
        return { success: true, duration, attempts: attempt };
        
      } catch (error) {
        lastError = error;
        console.error(`[SMS] ❌ Attempt ${attempt}/${retries} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.response?.status === 400 || error.response?.status === 401) {
          throw error; // Invalid credentials or bad request
        }
        
        // Exponential backoff: wait before retry
        if (attempt < retries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000); // 1s, 2s, 4s
          console.log(`[SMS] Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    // All retries failed
    throw lastError || new Error('SMS send failed after retries');
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SMS] ❌ Failed after ${duration}ms:`, error.message);
    if (error.response) {
      console.error("[SMS] API Response:", error.response.data);
    }
    return { 
      success: false, 
      error: error.message || "Failed to send SMS",
      duration 
    };
  }
};

module.exports = { sendSMS };
