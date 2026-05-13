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

interface RsvpStore {
  events: RsvpEvent[];
  responses: Response[];
  messages: BulkMessage[];
  loadEvents: (type?: "rsvp" | "review") => Promise<void>;
  loadEvent: (id: string) => Promise<RsvpEvent | undefined>;
  loadResponses: (eventId: string) => Promise<void>;
  createEvent: (type: "rsvp" | "review", name: string) => Promise<string>;
  updateEvent: (id: string, data: Partial<RsvpEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
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

  loadEvents: async (type?: "rsvp" | "review") => {
    try {
      const events = await rsvpApi.getForms(type);
      set({ events });
    } catch (error) {
      console.error("Failed to load RSVP forms", error);
    }
  },

  loadEvent: async (id: string) => {
    try {
      const event = await rsvpApi.getForm(id);
      set((state) => {
        const existing = state.events.find((item) => item.id === id);
        return {
          events: existing
            ? state.events.map((item) => (item.id === id ? event : item))
            : [...state.events, event],
        };
      });
      return event;
    } catch (error) {
      console.error("Failed to load RSVP form", error);
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
    }
  },

  createEvent: async (type: "rsvp" | "review", name: string) => {
    const draft = buildDefaultEvent(type, name);
    const localEvent = { ...draft, id: newId() };
    set((state) => ({ events: [...state.events, localEvent] }));

    try {
      const created = await rsvpApi.createForm(draft);
      set((state) => ({
        events: state.events.map((event) => (event.id === localEvent.id ? created : event)),
      }));
      return created.id;
    } catch (error) {
      console.error("Failed to create RSVP form", error);
      return localEvent.id;
    }
  },

  updateEvent: async (id: string, data: Partial<RsvpEvent>) => {
    let nextEvent: RsvpEvent | undefined;
    set((state) => {
      const events = state.events.map((event) =>
        event.id === id ? { ...event, ...data, updatedAt: new Date().toISOString() } : event
      );
      nextEvent = events.find((event) => event.id === id);
      return { events };
    });
    if (nextEvent) {
      try {
        const saved = await rsvpApi.updateForm(id, nextEvent);
        set((state) => ({
          events: state.events.map((event) => (event.id === id ? saved : event)),
        }));
      } catch (error) {
        console.error("Failed to sync RSVP form", error);
      }
    }
  },

  deleteEvent: async (id: string) => {
    try {
      await rsvpApi.deleteForm(id);
    } catch (error) {
      console.error("Failed to delete RSVP form", error);
    }
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      responses: state.responses.filter((r) => r.eventId !== id),
      messages: state.messages.filter((m) => m.eventId !== id),
    }));
  },

  duplicateEvent: async (id: string) => {
    const state = get();
    const event = state.events.find((e) => e.id === id);
    if (!event) return;

    try {
      const copy = await rsvpApi.duplicateForm(event.id);
      set((state) => ({ events: [...state.events, copy] }));
      return copy.id;
    } catch (error) {
      console.error("Failed to duplicate RSVP form", error);
      const fallback = { ...event, id: newId(), name: `${event.name} (Copy)` };
      set((state) => ({ events: [...state.events, fallback] }));
      return fallback.id;
    }
  },

  addQuestion: async (eventId: string, sectionId: string, type: QuestionType) => {
    const newQuestion: Question = {
      id: newId(),
      label: "",
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
    }));

    const event = get().events.find((item) => item.id === eventId);
    if (event) {
      const saved = await rsvpApi.updateForm(eventId, event);
      set((state) => ({
        events: state.events.map((item) => (item.id === eventId ? saved : item)),
      }));
    }
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
