"use client";

import { create } from "zustand";
import type {
  RsvpEvent,
  Question,
  Section,
  Response,
  BulkMessage,
  QuestionType,
  AttendeeTag,
} from "./rsvp-types";
import { buildDefaultEvent, rsvpApi } from "./rsvp-api";

const newId = () => crypto.randomUUID();

const isObjectId = (value: string) => /^[a-fA-F0-9]{24}$/.test(value);

const QUESTION_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Multiple choice",
  multi_choice: "Checkboxes",
  dropdown: "Dropdown",
  phone: "Phone",
  email: "Email",
  file: "File upload",
  date: "Date",
  rating: "Star rating",
  emoji: "Emoji reaction",
  nps: "NPS",
  yes_no: "Yes / No",
};

const pendingCoverImages = new Map<string, File>();

const buildQuestionLabel = (type: QuestionType) => QUESTION_LABELS[type] || "Question";

const normalizeEventForSave = (event: RsvpEvent, includeCoverImage = true): Partial<RsvpEvent> => ({
  ...event,
  name: event.name.trim(),
  description: event.description || "",
  coverImage: includeCoverImage ? event.coverImage || "" : "",
  sections: event.sections.map((section, index) => ({
    ...section,
    title: section.title.trim() || `Section ${index + 1}`,
  })),
  questions: event.questions.map((question) => ({
    ...question,
    label: question.label.trim() || buildQuestionLabel(question.type),
  })),
});

interface RsvpStore {
  events: RsvpEvent[];
  responses: Response[];
  messages: BulkMessage[];
  dirtyEvents: Record<string, boolean>;
  eventAliases: Record<string, string>;
  loadEvents: (type?: "rsvp" | "review") => Promise<void>;
  loadEvent: (id: string) => Promise<RsvpEvent | undefined>;
  loadResponses: (eventId: string) => Promise<void>;
  createEvent: (type: "rsvp" | "review", name: string) => Promise<string>;
  updateEvent: (id: string, data: Partial<RsvpEvent>) => Promise<void>;
  stageCoverImage: (id: string, file: File) => void;
  saveEvent: (id: string) => Promise<string>;
  discardEventChanges: (id: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  publishEvent: (id: string, published?: boolean) => Promise<void>;
  cancelEvent: (id: string) => Promise<void>;
  archiveEvent: (id: string) => Promise<void>;
  toggleVisibility: (id: string, isPublic?: boolean) => Promise<void>;
  toggleFeatured: (id: string, isFeatured?: boolean) => Promise<void>;
  toggleTrending: (id: string, isTrending?: boolean) => Promise<void>;
  toggleBanner: (id: string, bannerStatus?: boolean) => Promise<void>;
  duplicateEvent: (id: string) => Promise<string | void>;
  addQuestion: (eventId: string, sectionId: string, type: QuestionType) => Promise<void>;
  updateQuestion: (eventId: string, questionId: string, data: Partial<Question>) => Promise<void>;
  deleteQuestion: (eventId: string, questionId: string) => Promise<void>;
  reorderQuestion: (eventId: string, questionId: string, direction: -1 | 1) => Promise<void>;
  addOption: (eventId: string, questionId: string) => Promise<void>;
  deleteOption: (eventId: string, questionId: string, index: number) => Promise<void>;
  addSection: (eventId: string) => Promise<void>;
  updateSection: (eventId: string, sectionId: string, data: Partial<Section>) => Promise<void>;
  deleteSection: (eventId: string, sectionId: string) => Promise<void>;
  submitResponse: (data: { eventId: string; answers: Record<string, any>; status: string }) => void;
  setResponseTag: (responseId: string, tag: AttendeeTag) => Promise<void>;
  updateResponseStatus: (
    responseId: string,
    status: "pending" | "approved" | "paid" | "unpaid" | "rejected"
  ) => Promise<void>;
  sendBulkMessage: (data: {
    eventId: string;
    channel: "email" | "sms" | "push";
    subject?: string;
    body: string;
    segments: AttendeeTag[];
    recipientCount: number;
  }) => void;
}

export const useStore = create<RsvpStore>((set, get) => ({
  events: [],
  responses: [],
  messages: [],
  dirtyEvents: {},
  eventAliases: {},

  loadEvents: async (type?: "rsvp" | "review") => {
    try {
      const events = await rsvpApi.getForms(type);
      set({ events, dirtyEvents: {}, eventAliases: {} });
    } catch (error) {
      console.error("Failed to load RSVP forms", error);
      throw error;
    }
  },

  loadEvent: async (id: string) => {
    try {
      const resolvedId = get().eventAliases[id] || id;
      const existing = get().events.find((item) => item.id === resolvedId);
      if (existing) {
        return existing;
      }

      const event = await rsvpApi.getForm(resolvedId);
      set((state) => {
        return {
          events: state.events.some((item) => item.id === resolvedId)
            ? state.events.map((item) => (item.id === resolvedId ? event : item))
            : [...state.events, event],
          dirtyEvents: { ...state.dirtyEvents, [resolvedId]: false },
        };
      });
      return event;
    } catch (error) {
      console.error("Failed to load RSVP form", error);
      throw error;
    }
  },

  loadResponses: async (eventId: string) => {
    try {
      const responses = await rsvpApi.getResponses(eventId);
      set((state) => ({
        responses: [...state.responses.filter((response) => response.eventId !== eventId), ...responses],
      }));
    } catch (error) {
      console.error("Failed to load RSVP responses", error);
      throw error;
    }
  },

  createEvent: async (type: "rsvp" | "review", name: string) => {
    const draft = buildDefaultEvent(type, name);
    const localEvent = { ...draft, id: newId() };
    set((state) => ({
      events: [...state.events, localEvent],
      dirtyEvents: { ...state.dirtyEvents, [localEvent.id]: true },
    }));
    return localEvent.id;
  },

  updateEvent: async (id: string, data: Partial<RsvpEvent>) => {
    set((state) => {
      const events = state.events.map((event) =>
        event.id === id ? { ...event, ...data, updatedAt: new Date().toISOString() } : event
      );
      return { events, dirtyEvents: { ...state.dirtyEvents, [id]: true } };
    });
  },

  stageCoverImage: (id: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    pendingCoverImages.set(id, file);
    set((state) => ({
      events: state.events.map((event) =>
        event.id === id ? { ...event, coverImage: previewUrl, updatedAt: new Date().toISOString() } : event
      ),
      dirtyEvents: { ...state.dirtyEvents, [id]: true },
    }));
  },

  saveEvent: async (id: string) => {
    const event = get().events.find((item) => item.id === id);
    if (!event) {
      throw new Error("Event not found");
    }

    const coverFile = pendingCoverImages.get(id);
    const payload = normalizeEventForSave(event, !coverFile);

    let saved = isObjectId(id)
      ? await rsvpApi.updateForm(id, payload)
      : await rsvpApi.createForm(payload);

    if (coverFile) {
      saved = await rsvpApi.uploadCoverImage(saved.id, coverFile);
      pendingCoverImages.delete(id);
    }

    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
      dirtyEvents: { ...state.dirtyEvents, [id]: false, [saved.id]: false },
      eventAliases: isObjectId(id) ? state.eventAliases : { ...state.eventAliases, [id]: saved.id },
    }));

    return saved.id;
  },

  discardEventChanges: async (id: string) => {
    if (!isObjectId(id)) {
      set((state) => ({
        events: state.events.filter((event) => event.id !== id),
        dirtyEvents: Object.fromEntries(Object.entries(state.dirtyEvents).filter(([eventId]) => eventId !== id)),
        eventAliases: Object.fromEntries(Object.entries(state.eventAliases).filter(([eventId]) => eventId !== id)),
      }));
      pendingCoverImages.delete(id);
      return;
    }

    const event = await rsvpApi.getForm(id);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? event : item)),
      dirtyEvents: { ...state.dirtyEvents, [id]: false },
    }));
    pendingCoverImages.delete(id);
  },

  deleteEvent: async (id: string) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      responses: state.responses.filter((r) => r.eventId !== id),
      messages: state.messages.filter((m) => m.eventId !== id),
      dirtyEvents: Object.fromEntries(Object.entries(state.dirtyEvents).filter(([eventId]) => eventId !== id)),
    }));

    if (isObjectId(id)) {
      try {
        await rsvpApi.deleteForm(id);
      } catch (error) {
        console.error("Failed to delete RSVP form", error);
      }
    }
  },

  publishEvent: async (id: string, published = true) => {
    const saved = await rsvpApi.publishForm(id, published);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  cancelEvent: async (id: string) => {
    const saved = await rsvpApi.cancelForm(id);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  archiveEvent: async (id: string) => {
    const saved = await rsvpApi.archiveForm(id);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  toggleVisibility: async (id: string, isPublic?: boolean) => {
    const saved = await rsvpApi.toggleVisibility(id, isPublic);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  toggleFeatured: async (id: string, isFeatured?: boolean) => {
    const saved = await rsvpApi.toggleFeatured(id, isFeatured);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  toggleTrending: async (id: string, isTrending?: boolean) => {
    const saved = await rsvpApi.toggleTrending(id, isTrending);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  toggleBanner: async (id: string, bannerStatus?: boolean) => {
    const saved = await rsvpApi.toggleBanner(id, bannerStatus);
    set((state) => ({
      events: state.events.map((item) => (item.id === id ? saved : item)),
    }));
  },

  duplicateEvent: async (id: string) => {
    const state = get();
    const event = state.events.find((e) => e.id === id);
    if (!event) return;

    try {
      if (isObjectId(event.id)) {
        const copy = await rsvpApi.duplicateForm(event.id);
        set((state) => ({
          events: [...state.events, copy],
          dirtyEvents: { ...state.dirtyEvents, [copy.id]: false },
        }));
        return copy.id;
      }

      const fallback = { ...event, id: newId(), name: `${event.name} (Copy)` };
      set((state) => ({
        events: [...state.events, fallback],
        dirtyEvents: { ...state.dirtyEvents, [fallback.id]: true },
      }));
      return fallback.id;
    } catch (error) {
      console.error("Failed to duplicate RSVP form", error);
      const fallback = { ...event, id: newId(), name: `${event.name} (Copy)` };
      set((state) => ({
        events: [...state.events, fallback],
        dirtyEvents: { ...state.dirtyEvents, [fallback.id]: true },
      }));
      return fallback.id;
    }
  },

  addQuestion: async (eventId: string, sectionId: string, type: QuestionType) => {
    const newQuestion: Question = {
      id: newId(),
      label: buildQuestionLabel(type),
      type,
      required: false,
      sectionId,
      options: ["single_choice", "multi_choice", "dropdown"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
    };

    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? { ...e, questions: [...e.questions, newQuestion], updatedAt: new Date().toISOString() }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  updateQuestion: async (eventId: string, questionId: string, data: Partial<Question>) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              questions: e.questions.map((q) =>
                q.id === questionId ? { ...q, ...data } : q
              ),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  addOption: async (eventId: string, questionId: string) => {
    const nextOptionLabel = (options: string[] | undefined) => {
      const count = (options || []).length;
      return `Option ${count + 1}`;
    };

    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              questions: e.questions.map((q) =>
                q.id === questionId
                  ? { ...q, options: [...(q.options || []), nextOptionLabel(q.options)] }
                  : q
              ),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  deleteOption: async (eventId: string, questionId: string, index: number) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              questions: e.questions.map((q) =>
                q.id === questionId
                  ? { ...q, options: (q.options || []).filter((_, i) => i !== index) }
                  : q
              ),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));

    const event = get().events.find((e) => e.id === eventId);
    if (event) {
      try {
        const saved = await rsvpApi.updateForm(eventId, event);
        set((state) => ({
          events: state.events.map((item) => (item.id === eventId ? saved : item)),
        }));
      } catch (error) {
        console.error("Failed to sync RSVP option", error);
      }
    }
  },


  deleteQuestion: async (eventId: string, questionId: string) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              questions: e.questions.filter((q) => q.id !== questionId),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  reorderQuestion: async (eventId: string, questionId: string, direction: -1 | 1) => {
    set((state) => {
      const event = state.events.find((e) => e.id === eventId);
      if (!event) return state;

      const idx = event.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return state;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= event.questions.length) return state;

      const newQuestions = [...event.questions];
      [newQuestions[idx], newQuestions[newIdx]] = [newQuestions[newIdx], newQuestions[idx]];

      return {
        events: state.events.map((e) =>
          e.id === eventId
            ? { ...e, questions: newQuestions, updatedAt: new Date().toISOString() }
            : e
        ),
      };
    });

    const event = get().events.find((item) => item.id === eventId);
    if (event) {
      try {
        const saved = await rsvpApi.updateForm(eventId, event);
        set((state) => ({
          events: state.events.map((item) => (item.id === eventId ? saved : item)),
        }));
      } catch (error) {
        console.error("Failed to sync RSVP question", error);
      }
    }
  },

  addSection: async (eventId: string) => {
    const newSection: Section = {
      id: newId(),
      title: "New Section",
    };

    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? { ...e, sections: [...e.sections, newSection], updatedAt: new Date().toISOString() }
          : e
      ),
    }));

    const event = get().events.find((item) => item.id === eventId);
    if (event) {
      try {
        const saved = await rsvpApi.updateForm(eventId, event);
        set((state) => ({
          events: state.events.map((item) => (item.id === eventId ? saved : item)),
        }));
      } catch (error) {
        console.error("Failed to sync RSVP question", error);
      }
    }
  },

  updateSection: async (eventId: string, sectionId: string, data: Partial<Section>) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              sections: e.sections.map((s) =>
                s.id === sectionId ? { ...s, ...data } : s
              ),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  deleteSection: async (eventId: string, sectionId: string) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              sections: e.sections.filter((s) => s.id !== sectionId),
              questions: e.questions.filter((q) => q.sectionId !== sectionId),
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
      dirtyEvents: { ...state.dirtyEvents, [eventId]: true },
    }));
  },

  submitResponse: (data: { eventId: string; answers: Record<string, any>; status: string }) => {
    const newResponse: Response = {
      id: newId(),
      eventId: data.eventId,
      answers: data.answers,
      status: data.status as any,
      submittedAt: new Date().toISOString(),
    };

    set((state) => ({ responses: [...state.responses, newResponse] }));
  },

  setResponseTag: async (responseId: string, tag: AttendeeTag) => {
    const response = get().responses.find((item) => item.id === responseId);
    if (!response) return;

    try {
      const saved = await rsvpApi.updateResponseTag(response.eventId, responseId, tag);
      set((state) => ({
        responses: state.responses.map((item) => (item.id === responseId ? saved : item)),
      }));
    } catch (error) {
      console.error("Failed to update RSVP response tag", error);
    }
  },

  updateResponseStatus: async (
    responseId: string,
    status: "pending" | "approved" | "paid" | "unpaid" | "rejected"
  ) => {
    const response = get().responses.find((item) => item.id === responseId);
    if (!response) return;

    try {
      const saved = await rsvpApi.updateResponseStatus(response.eventId, responseId, status);
      set((state) => ({
        responses: state.responses.map((item) => (item.id === responseId ? saved : item)),
      }));
    } catch (error) {
      console.error("Failed to update RSVP response status", error);
    }
  },

  sendBulkMessage: (data: {
    eventId: string;
    channel: "email" | "sms" | "push";
    subject?: string;
    body: string;
    segments: AttendeeTag[];
    recipientCount: number;
  }) => {
    const newMessage: BulkMessage = {
      id: newId(),
      eventId: data.eventId,
      channel: data.channel,
      subject: data.subject,
      body: data.body,
      segments: data.segments,
      recipientCount: data.recipientCount,
      sentAt: new Date().toISOString(),
    };

    set((state) => ({ messages: [...state.messages, newMessage] }));
  },
}));
