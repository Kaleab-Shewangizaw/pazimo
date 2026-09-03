const axios = require("axios");

// retries defaults to 1 (no retry): GeezSMS isn't idempotent from our side — if it
// processes the request but replies with an error/timeout, retrying sends a second
// real SMS to the customer. Only call with retries > 1 if you've confirmed the
// gateway is safe to retry.
const sendSMS = async (phone, message, retries = 1) => {
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

        // GeezSMS's actual response shape is `{ error: boolean, msg: string, ... }`
        // — there is no `status` field. The old check here (`status === 'success'`)
        // never matched anything real, so every send fell through to "assumed
        // success" regardless of what the gateway actually said, and a real
        // failure's message was read from `response.data.error` (a boolean) instead
        // of `response.data.msg` — so failures were caught but logged as
        // "Error: true" instead of the real reason. Found 2026-09-04 while
        // debugging a report of OTP SMS not arriving: confirmed against a live
        // call that `error: false` + a `msg`/`sms_units`/`cost_etb` payload is what
        // a real accepted send looks like.
        if (response.data && response.data.error === false) {
          const duration = Date.now() - startTime;
          console.log(
            `[SMS] ✅ Accepted by gateway in ${duration}ms (attempt ${attempt}):`,
            response.data.msg || response.data
          );
          return { success: true, duration, attempts: attempt };
        } else if (response.data && response.data.error) {
          throw new Error(response.data.msg || "GeezSMS reported a failure with no message");
        }

        // Unrecognized shape — don't assume success over something we don't
        // actually understand. Log the raw body so the next failure is
        // diagnosable instead of silently reported as sent.
        const duration = Date.now() - startTime;
        console.warn(
          `[SMS] ⚠️ Unrecognized gateway response after ${duration}ms (attempt ${attempt}):`,
          response.data
        );
        throw new Error("Unrecognized SMS gateway response");
        
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
