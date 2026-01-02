export interface Event {
  id: number;
  _id?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  description?: string;
  status?: string;
  eventType?: "public" | "private";
  isPublic?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  ticketTypes?: any[];
  tags?: string[];
  category?: string;
  ageRestriction?: string;
  coverImages?: string[];
}

export interface Invitation {
  id: number | string;
  _id?: string;
  eventTitle: string;
  customerName: string;
  contact: string;
  guestEmail?: string;
  guestPhone?: string;
  contactType: "email" | "phone";
  guestType: "guest" | "paid";
  ticketType?: string;
  paymentStatus?: "paid" | "free";
  qrCodeCount: number;
  message?: string;
  sentAt: string;
  createdAt?: string;
  status: "sent" | "delivered" | "failed";
  rsvpStatus?:
    | "pending"
    | "confirmed"
    | "declined"
    | "pending payment"
    | "failed"
    | "sent";
  qrCode: string;
  eventId?: number | string;
  rsvpLink?: string;
  estimatedCost?: number;
}

export interface Attendee {
  id: string;
  customerName: string;
  contact: string;
  guestType: string;
  confirmedAt: string;
  status: string;
  purchaseQuantity?: number;
  ticketCount?: number;
  hasTicket?: boolean;
  ticketType?: string;
  paymentStatus?: string;
}

export interface Pricing {
  email: number;
  sms: number;
}
