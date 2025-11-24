import SantimpaySdk from "./santimpay";

const TEST_MERCHANT_ID = "9e2dab64-e2bb-4837-9b85-d855dd878d2b";
const TEST_PRIVATE_KEY = `
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIF/mI9tSZxKbfEniC+3yfvwIS/D76+p/ky/oDmKAwu5roAoGCCqGSM49
AwEHoUQDQgAEqJl+TIowE6CAhoghgmH+cdzn5+WNax9/REqXJf6b1HdJCRZBCXWT
6coLZ23OyF5x9uVOUXixZeB7J7y9iSWDzw==
-----END EC PRIVATE KEY-----
`;

const MERCHANT_ID = process.env.SANTIM_MERCHANT_ID || TEST_MERCHANT_ID;
const PRIVATE_KEY = process.env.SANTIM_PRIVATE_KEY || TEST_PRIVATE_KEY;

if (!process.env.SANTIM_MERCHANT_ID) {
  console.warn("Using Test SantimPay Credentials");
}

// Initialize the SDK with testBed = true
// @ts-ignore
const santimPay = new SantimpaySdk(MERCHANT_ID, PRIVATE_KEY, true);

export const generatePaymentUrl = async (
  orderId: string,
  amount: number,
  reason: string,
  phoneNumber: string,
  successUrl: string,
  failureUrl: string,
  cancelUrl: string,
  notifyUrl: string
): Promise<string> => {
  try {
    // Official SDK signature:
    // generatePaymentUrl(id, amount, paymentReason, successRedirectUrl, failureRedirectUrl, notifyUrl, phoneNumber, cancelRedirectUrl)
    const url = await santimPay.generatePaymentUrl(
      orderId,
      amount,
      reason,
      successUrl,
      failureUrl,
      notifyUrl,
      phoneNumber,
      cancelUrl
    );
    return url;
  } catch (error) {
    console.error("Error generating SantimPay URL:", error);
    throw error;
  }
};

export const checkTransactionStatus = async (id: string) => {
  try {
    const status = await santimPay.checkTransactionStatus(id);
    return status;
  } catch (error) {
    console.error("Error checking transaction status:", error);
    throw error;
  }
};
