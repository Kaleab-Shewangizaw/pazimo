export type QuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "phone"
  | "email"
  | "file"
  | "date"
  | "rating"
  | "emoji"
  | "nps"
  | "yes_no";

export interface ConditionalLogic {
  questionId: string;
  operator: "lt" | "eq" | "gt";
  value: number;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  conditional?: ConditionalLogic;
  sectionId: string;
}

export interface Section {
  id: string;
  title: string;
}

export interface PaymentConfig {
  enabled: boolean;
  price: number;
  currency: string;
  deadline?: string;
}

export interface RsvpEvent {
  id: string;
  publicId?: string;
  name: string;
  description?: string;
  type: "rsvp" | "review";
  status?: "draft" | "published" | "cancelled" | "hidden" | "archived" | "review" | "closed";
  coverImage?: string;
  date?: string;
  hostedBy?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  venue?: string;
  rsvpLimit?: number;
  approvalMode: "auto" | "manual";
  collectAttendeeInfo?: boolean;
  payment?: PaymentConfig;
  anonymous?: boolean;
  sections: Section[];
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  cancelledAt?: string;
  archivedAt?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  bannerStatus?: boolean;
  isPublic?: boolean;
  isClosed?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  viewCount?: number;
  responseCount?: number;
  shareUrl?: string;
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export interface Response {
  id: string;
  responseId?: string;
  eventId: string;
  answers: Record<string, AnswerValue>;
  attendee?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  status: "pending" | "approved" | "paid" | "unpaid" | "rejected";
  tag?: AttendeeTag;
  submittedAt: string;
  qrCodePayload?: string;
  qrCodeDataUrl?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
}

export type AttendeeTag = "VIP" | "Guest" | "Press";
export type MessageChannel = "email" | "sms" | "push";

export interface BulkMessage {
  id: string;
  eventId: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
  segments: AttendeeTag[];
  recipientCount: number;
  sentAt: string;
}
