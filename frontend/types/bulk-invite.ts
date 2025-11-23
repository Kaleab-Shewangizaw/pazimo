import { Event } from "./event";

export interface Row {
  id: string;
  No: number;
  Name: string;
  Email: string;
  Phone: string;
  Type: "Email" | "Phone" | "Both";
  Amount: number;
  Message: string;
  QR?: string;
  fixed?: string;
  error?: string;
  eventDetail: Event;
}

export interface EventData {
  eventName: string;
  date: string;
  time: string;
  location: string;
  rsvpLink: string;
}

export interface PaymentInit {
  amount: number;
  currency: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
}

export interface FinalPayload {
  sendSms: boolean;
  sendEmail: boolean;
  finalSmsList: { phone: string; message: string }[];
  finalEmailList: { email: string; message: string; subject: string }[];
}

export interface Invitation {
  _id?: string;
  eventTitle?: string;
  customerName: string;
  contactType: "email" | "phone" | "both";
  contact: string;
  guestType: "guest" | "paid";
  qrCodeCount: number;
  sentAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: "pending" | "sent" | "failed";
  eventId?: Event;
  type: "Email" | "Phone" | "Both";
  amount: number;
  message?: string;
  qrCodeUrl?: string;
}

export interface InvitationRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: "Email" | "Phone" | "Both";
  amount: number;
  message?: string;
  qrCodeUrl?: string;
}
