import { useAdminAuthStore } from "@/store/adminAuthStore";
import type {
  AttendeeTag,
  PaymentConfig,
  Question,
  RsvpEvent,
  Response,
  Section,
} from "./rsvp-types";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

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
  status: "draft" | "published" | "archived";
  coverImage?: string;
  date?: string;
  hostedBy?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  venue?: string;
  rsvpLimit?: number;
  approvalMode: "auto" | "manual";
  payment?: PaymentConfig;
  anonymous?: boolean;
  sections?: Section[];
  questions?: Question[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
  responseCount?: number;
  shareUrl?: string;
};

type BackendResponse = {
  _id: string;
  formId: string;
  formPublicId: string;
  organizerId: string;
  answers: Record<string, any>;
  status: "pending" | "approved" | "paid" | "unpaid";
  tag?: AttendeeTag;
  metadata?: Record<string, any>;
  submittedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

const request = async <T>(endpoint: string, options: RequestInit = {}, auth = true) => {
  const token = useAdminAuthStore.getState().token;
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

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
  payment: form.payment,
  anonymous: !!form.anonymous,
  sections: form.sections || [],
  questions: form.questions || [],
  createdAt: form.createdAt,
  updatedAt: form.updatedAt,
  publishedAt: form.publishedAt,
  archivedAt: form.archivedAt,
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
  payment: event.payment,
  anonymous: !!event.anonymous,
  sections: event.sections || [],
  questions: event.questions || [],
});

const mapResponse = (response: BackendResponse): Response => ({
  id: response._id,
  eventId: response.formId,
  answers: response.answers || {},
  status: response.status,
  tag: response.tag,
  submittedAt: response.submittedAt || response.createdAt || new Date().toISOString(),
});

export const rsvpApi = {
  mapForm,
  mapResponse,
  getForms: async (type?: "rsvp" | "review") => {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const forms = await request<BackendForm[]>(`/rsvp/forms${query}`);
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
  deleteForm: async (id: string) => request<void>(`/rsvp/forms/${id}`, { method: "DELETE" }),
  duplicateForm: async (id: string) =>
    mapForm(await request<BackendForm>(`/rsvp/forms/${id}/duplicate`, { method: "POST" })),
  publishForm: async (id: string, published: boolean) =>
    mapForm(
      await request<BackendForm>(`/rsvp/forms/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ status: published ? "published" : "draft" }),
      })
    ),
  getPublicForm: async (publicId: string) =>
    mapForm(await request<BackendForm>(`/rsvp/public/${publicId}`, {}, false)),
  submitPublicResponse: async (
    publicId: string,
    data: { answers: Record<string, any>; tag?: AttendeeTag; metadata?: Record<string, any> }
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
  getAnalytics: async (id: string) => request(`/rsvp/forms/${id}/analytics`),
};

export const buildDefaultEvent = (type: "rsvp" | "review", name: string): RsvpEvent => ({
  id: "",
  name: name.trim() || `New ${type === "rsvp" ? "RSVP" : "Review"} Event`,
  type,
  status: "draft",
  sections: [{ id: crypto.randomUUID(), title: "Basic Information" }],
  questions: [],
  approvalMode: "auto",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
