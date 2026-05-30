import { useAdminAuthStore } from "@/store/adminAuthStore";
import { useAuthStore } from "@/store/authStore";
import { useOrganizerAuthStore } from "@/store/organizerAuthStore";
import type {
  AnswerValue,
  AttendeeTag,
  PaymentConfig,
  Question,
  RsvpEvent,
  Response,
  Section,
} from "./rsvp-types";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

export const resolveRsvpImageUrl = (image?: string) => {
  if (!image) return "";
  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const normalized = image.startsWith("/") ? image : `/${image}`;
  return `${base}${normalized}`;
};

export const getRsvpAuthToken = () => {
  // Prefer organizer/customer auth first because RSVP builder is organizer-facing.
  const authToken = useAuthStore.getState().token;
  const organizerToken = useOrganizerAuthStore.getState().token;
  const adminToken = useAdminAuthStore.getState().token;
  return authToken || organizerToken || adminToken || null;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

type BackendForm = {
  _id: string;
  publicId: string;
  title: string;
  description?: string;
  type: "rsvp" | "review";
  status: "draft" | "published" | "cancelled" | "hidden" | "archived" | "review" | "closed";
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
  sections?: Section[];
  questions?: Question[];
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
};

type BackendResponse = {
  _id: string;
  responseId?: string;
  formId: string;
  formPublicId: string;
  organizerId: string;
  answers: Record<string, AnswerValue>;
  attendee?: { fullName?: string; email?: string; phone?: string };
  status: "pending" | "approved" | "paid" | "unpaid" | "rejected";
  tag?: AttendeeTag;
  metadata?: Record<string, unknown>;
  submittedAt: string;
  createdAt?: string;
  updatedAt?: string;
  qrCodePayload?: string;
  qrCodeDataUrl?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
};

const request = async <T>(endpoint: string, options: RequestInit = {}, auth = true) => {
  const token = auth ? getRsvpAuthToken() : null;
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data.data as T;
};

const mapForm = (form: BackendForm): RsvpEvent => ({
  id: form._id,
  publicId: form.publicId,
  name: form.title,
  description: form.description || "",
  type: form.type,
  status: form.status,
  coverImage: form.coverImage || "",
  date: form.date || "",
  hostedBy: form.hostedBy || "",
  startTime: form.startTime || "",
  endTime: form.endTime || "",
  location: form.location || "",
  venue: form.venue || "",
  rsvpLimit: form.rsvpLimit,
  approvalMode: form.approvalMode,
  collectAttendeeInfo:
    form.type === "review" ? false : form.collectAttendeeInfo !== false,
  payment: form.payment
    ? {
        ...form.payment,
        enabled: false,
      }
    : form.payment,
  anonymous: !!form.anonymous,
  sections: form.sections || [],
  questions: form.questions || [],
  createdAt: form.createdAt,
  updatedAt: form.updatedAt,
  publishedAt: form.publishedAt,
  cancelledAt: form.cancelledAt,
  archivedAt: form.archivedAt,
  isFeatured: form.isFeatured,
  isTrending: form.isTrending,
  bannerStatus: form.bannerStatus,
  isPublic: form.isPublic,
  isClosed: form.isClosed,
  isDeleted: form.isDeleted,
  deletedAt: form.deletedAt,
  viewCount: form.viewCount,
  responseCount: form.responseCount,
  shareUrl: form.shareUrl,
});

const mapFormPayload = (event: Partial<RsvpEvent>) => ({
  title: event.name,
  description: event.description || "",
  type: event.type,
  status: event.status,
  coverImage: event.coverImage || "",
  date: event.date || "",
  hostedBy: event.hostedBy || "",
  startTime: event.startTime || "",
  endTime: event.endTime || "",
  location: event.location || "",
  venue: event.venue || "",
  rsvpLimit: event.rsvpLimit,
  approvalMode: event.approvalMode || "auto",
  collectAttendeeInfo:
    event.type === "review" ? false : event.collectAttendeeInfo !== false,
  payment: event.payment
    ? {
        ...event.payment,
        enabled: false,
      }
    : event.payment,
  anonymous: !!event.anonymous,
  isPublic: event.type === "review" ? false : event.isPublic !== false,
  sections: event.sections || [],
  questions: event.questions || [],
});

const mapResponse = (response: BackendResponse): Response => ({
  id: response._id,
  responseId: response.responseId,
  eventId: response.formId,
  answers: response.answers || {},
  attendee: response.attendee,
  status: response.status,
  tag: response.tag,
  submittedAt: response.submittedAt || response.createdAt || new Date().toISOString(),
  qrCodePayload: response.qrCodePayload,
  qrCodeDataUrl: response.qrCodeDataUrl,
  checkedIn: response.checkedIn,
  checkedInAt: response.checkedInAt,
});

export const rsvpApi = {
  mapForm,
  mapResponse,
  getForms: async (type?: "rsvp" | "review") => {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const forms = await request<BackendForm[]>(`/rsvp/forms${query}`);
    return forms.map(mapForm);
  },
  getPublishedForms: async (type?: "rsvp" | "review") => {
    const query = type ? `?type=${encodeURIComponent(type)}&limit=12` : "?limit=12";
    const forms = await request<BackendForm[]>(`/rsvp/public/forms${query}`, {}, false);
    return forms.map(mapForm);
  },
  getForm: async (id: string) => mapForm(await request<BackendForm>(`/rsvp/forms/${id}`)),
  createForm: async (data: Partial<RsvpEvent>) =>
    mapForm(
      await request<BackendForm>("/rsvp/forms", {
        method: "POST",
        body: JSON.stringify(mapFormPayload(data)),
      })
    ),
  updateForm: async (id: string, data: Partial<RsvpEvent>) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(mapFormPayload(data)),
      })
    ),
  uploadCoverImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("coverImage", file);
    return mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/cover-image`, {
        method: "PATCH",
        body: formData,
      })
    );
  },
  deleteForm: async (id: string) => request<void>(`/rsvp/forms/${id}`, { method: "DELETE" }),
  duplicateForm: async (id: string) =>
    mapForm(await request<BackendForm>(`/rsvp/forms/${id}/duplicate`, { method: "POST" })),
  publishForm: async (id: string, published?: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({
          status: published === false ? "draft" : "published",
        }),
      })
    ),
  cancelForm: async (id: string) =>
    mapForm(await request<BackendForm>(`/rsvp/forms/${id}/cancel`, { method: "PATCH" })),
  archiveForm: async (id: string) =>
    mapForm(await request<BackendForm>(`/rsvp/forms/${id}/archive`, { method: "PATCH" })),
  toggleVisibility: async (id: string, isPublic?: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify(typeof isPublic === "boolean" ? { isPublic } : {}),
      })
    ),
  toggleFeatured: async (id: string, isFeatured?: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/featured`, {
        method: "PATCH",
        body: JSON.stringify(typeof isFeatured === "boolean" ? { isFeatured } : {}),
      })
    ),
  toggleTrending: async (id: string, isTrending?: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/trending`, {
        method: "PATCH",
        body: JSON.stringify(typeof isTrending === "boolean" ? { isTrending } : {}),
      })
    ),
  toggleBanner: async (id: string, bannerStatus?: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/banner`, {
        method: "PATCH",
        body: JSON.stringify(typeof bannerStatus === "boolean" ? { bannerStatus } : {}),
      })
    ),
  getPublicForm: async (publicId: string) =>
    mapForm(await request<BackendForm>(`/rsvp/public/${publicId}`, {}, false)),
  submitPublicResponse: async (
    publicId: string,
    data: {
      answers: Record<string, AnswerValue>;
      attendee?: { fullName: string; email: string; phone: string };
      tag?: AttendeeTag;
      metadata?: Record<string, unknown>;
    }
  ) =>
    mapResponse(
      await request<BackendResponse>(
        `/rsvp/public/${publicId}/responses`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false
      )
    ),
  submitProtectedResponse: async (
    id: string,
    data: {
      answers: Record<string, AnswerValue>;
      attendee?: { fullName: string; email: string; phone: string };
      tag?: AttendeeTag;
      metadata?: Record<string, unknown>;
    }
  ) =>
    mapResponse(
      await request<BackendResponse>(`/rsvp/forms/${id}/responses`, {
        method: "POST",
        body: JSON.stringify(data),
      })
    ),
  getResponses: async (id: string) => {
    const responses = await request<BackendResponse[]>(`/rsvp/forms/${id}/responses`);
    return responses.map(mapResponse);
  },
  updateResponseTag: async (id: string, responseId: string, tag: AttendeeTag) =>
    mapResponse(
      await request<BackendResponse>(`/rsvp/forms/${id}/responses/${responseId}/tag`, {
        method: "PATCH",
        body: JSON.stringify({ tag }),
      })
    ),
  updateResponseStatus: async (
    id: string,
    responseId: string,
    status: "pending" | "approved" | "paid" | "unpaid" | "rejected"
  ) =>
    mapResponse(
      await request<BackendResponse>(`/rsvp/forms/${id}/responses/${responseId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
    ),
  getAnalytics: async (id: string) => request(`/rsvp/forms/${id}/analytics`),
};

export const buildDefaultEvent = (type: "rsvp" | "review", name: string): RsvpEvent => ({
  id: "",
  name: name.trim() || `New ${type === "rsvp" ? "RSVP" : "Review"} Event`,
  type,
  status: "draft",
  isPublic: type === "review" ? false : true,
  collectAttendeeInfo: type === "review" ? false : true,
  sections: [{ id: crypto.randomUUID(), title: "Basic Information" }],
  questions: [],
  approvalMode: "auto",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
