import { Row, EventData, PaymentInit, FinalPayload } from "@/types/bulk-invite";
import base64id from "base64id";

export interface ValidationResult {
  correctedRows: Row[];
  summary: {
    totalEmails: number;
    totalSms: number;
    totalCost: number;
    errors: Row[];
  };
  readyToGenerate: boolean;
}

export const validateAndCorrectRows = (rows: Row[]): ValidationResult => {
  const correctedRows: Row[] = [];
  const errors: Row[] = [];
  let totalEmails = 0;
  let totalSms = 0;

  const totalCalculation = (rows: Row[]): number => {
    return rows.reduce((total, row) => {
      const amount = Number(row.Amount || 1);

      if (row.Type === "Both") return total + 7 * amount;
      if (row.Type === "Phone") return total + 5 * amount;
      if (row.Type === "Email") return total + 2 * amount;

      return total;
    }, 0);
  };

  const totalCost = totalCalculation(rows);

  rows.forEach((row, index) => {
    // Create a copy to avoid mutating original if needed, though we are returning a new array
    const correctedRow: Row = { ...row };
    const fixes: string[] = [];
    let error: string | null = null;

    // Ensure ID
    if (!correctedRow.id) {
      correctedRow.id = base64id.generateId();
    }
    // Ensure No
    if (!correctedRow.No) {
      correctedRow.No = index + 1;
    }

    // Normalize Type
    const type = correctedRow.Type;
    if (typeof type === "string") {
      const lowerType = type.toLowerCase();
      if (lowerType.includes("email") && lowerType.includes("phone"))
        correctedRow.Type = "Both";
      else if (lowerType.includes("email")) correctedRow.Type = "Email";
      else if (lowerType.includes("phone") || lowerType.includes("sms"))
        correctedRow.Type = "Phone";
      else if (lowerType.includes("both")) correctedRow.Type = "Both";
      else {
        // Infer type from fields if type is unknown or empty
        if (correctedRow.Email && correctedRow.Phone)
          correctedRow.Type = "Both";
        else if (correctedRow.Email) correctedRow.Type = "Email";
        else if (correctedRow.Phone) correctedRow.Type = "Phone";
        else correctedRow.Type = "Email"; // Default fallback
      }
    } else {
      // If type is missing
      if (correctedRow.Email && correctedRow.Phone) correctedRow.Type = "Both";
      else if (correctedRow.Email) correctedRow.Type = "Email";
      else if (correctedRow.Phone) correctedRow.Type = "Phone";
      else correctedRow.Type = "Email";
    }

    // Validate Email
    const isEmailValid = (email: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
    if (correctedRow.Type === "Email" || correctedRow.Type === "Both") {
      if (!correctedRow.Email || !isEmailValid(correctedRow.Email)) {
        error = "Invalid Email";
      }
    }

    // Validate Phone
    // Ethiopian regex: +2519..., +2517..., 09..., 07...
    const isPhoneValid = (phone: string) =>
      /^(\+2519\d{8}|\+2517\d{8}|09\d{8}|07\d{8})$/.test(phone?.trim());
    if (correctedRow.Type === "Phone" || correctedRow.Type === "Both") {
      if (!correctedRow.Phone || !isPhoneValid(correctedRow.Phone)) {
        error = error ? error + ", Invalid Phone" : "Invalid Phone";
      }
    }

    // Fix Name
    if (!correctedRow.Name || correctedRow.Name.trim() === "") {
      if (correctedRow.Email && isEmailValid(correctedRow.Email)) {
        correctedRow.Name = correctedRow.Email.split("@")[0];
        fixes.push("Name inferred from Email");
      } else if (correctedRow.Phone) {
        correctedRow.Name = "Guest";
        fixes.push("Name set to Guest");
      } else {
        error = error ? error + ", Missing Name" : "Missing Name";
      }
    }

    // Fix Amount
    // 2 birr per Email, 5 birr per SMS times the number of amount

    // Message
    if (!correctedRow.Message) {
      correctedRow.Message = "";
    }

    if (error) {
      correctedRow.error = error;
      errors.push(correctedRow as Row);
    } else {
      if (correctedRow.Type === "Email" || correctedRow.Type === "Both")
        totalEmails++;
      if (correctedRow.Type === "Phone" || correctedRow.Type === "Both")
        totalSms++;
    }

    correctedRows.push(correctedRow as Row);
  });

  const readyToGenerate = errors.length === 0;

  return {
    correctedRows,
    summary: {
      totalEmails,
      totalSms,
      totalCost,
      errors,
    },
    readyToGenerate,
  };
};

export const generatePaymentConfig = (
  summary: { totalCost: number },
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  }
): PaymentInit => {
  const tx_ref = `tx-bulk-${base64id.generateId()}`;

  // Use environment variables or defaults
  const callback_url = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/payment/callback`
    : "http://localhost:5000/api/payment/callback";

  const return_url =
    typeof window !== "undefined"
      ? `${window.location.origin}/payment/success`
      : "http://localhost:3000/payment/success";

  return {
    amount: summary.totalCost,
    currency: "ETB",
    tx_ref,
    callback_url,
    return_url,
    customer: {
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone_number: user.phoneNumber,
    },
  };
};

export const generateFinalPayload = (
  rows: Row[],
  eventData: EventData
): FinalPayload => {
  const finalSmsList: { phone: string; message: string }[] = [];
  const finalEmailList: { email: string; message: string; subject: string }[] =
    [];

  rows.forEach((row) => {
    if (row.error) return; // Skip invalid rows

    const message = `Hi ${row.Name}, ${
      row.Message || "You are invited!"
    }\n\nEvent: ${eventData.eventName}\nDate: ${eventData.date}\nTime: ${
      eventData.time
    }\nLocation: ${eventData.location}\n\nRSVP Link: ${eventData.rsvpLink}`;

    if (row.Type === "Phone" || row.Type === "Both") {
      if (row.Phone) {
        finalSmsList.push({
          phone: row.Phone,
          message,
        });
      }
    }

    if (row.Type === "Email" || row.Type === "Both") {
      if (row.Email) {
        finalEmailList.push({
          email: row.Email,
          message,
          subject: `Invitation: ${eventData.eventName}`,
        });
      }
    }
  });

  return {
    sendSms: finalSmsList.length > 0,
    sendEmail: finalEmailList.length > 0,
    finalSmsList,
    finalEmailList,
  };
};
