"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { RsvpEvent, Question, Section, Response, BulkMessage, QuestionType, AttendeeTag, ConditionalLogic } from "./rsvp-types";

interface RsvpStore {
  events: RsvpEvent[];
  responses: Response[];
  messages: BulkMessage[];
  createEvent: (type: "rsvp" | "review", name: string) => string;
  updateEvent: (id: string, data: Partial<RsvpEvent>) => void;
  deleteEvent: (id: string) => void;
  duplicateEvent: (id: string) => void;
  addQuestion: (eventId: string, sectionId: string, type: QuestionType) => void;
  updateQuestion: (eventId: string, questionId: string, data: Partial<Question>) => void;
  deleteQuestion: (eventId: string, questionId: string) => void;
  reorderQuestion: (eventId: string, questionId: string, direction: -1 | 1) => void;
  addSection: (eventId: string) => void;
  updateSection: (eventId: string, sectionId: string, data: Partial<Section>) => void;
  deleteSection: (eventId: string, sectionId: string) => void;
  submitResponse: (data: { eventId: string; answers: Record<string, any>; status: string }) => void;
  setResponseTag: (responseId: string, tag: AttendeeTag) => void;
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

  createEvent: (type: "rsvp" | "review", name: string) => {
    const id = uuidv4();
    const defaultSection: Section = { id: uuidv4(), title: "Basic Information" };
    const newEvent: RsvpEvent = {
      id,
      name: name.trim() || `New ${type === "rsvp" ? "RSVP" : "Review"} Event`,
      type,
      sections: [defaultSection],
      questions: [],
      approvalMode: "auto",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ events: [...state.events, newEvent] }));
    return id;
  },

  updateEvent: (id: string, data: Partial<RsvpEvent>) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
      ),
    }));
  },

  deleteEvent: (id: string) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      responses: state.responses.filter((r) => r.eventId !== id),
      messages: state.messages.filter((m) => m.eventId !== id),
    }));
  },

  duplicateEvent: (id: string) => {
    const state = get();
    const event = state.events.find((e) => e.id === id);
    if (!event) return;

    const newId = uuidv4();
    const newEvent: RsvpEvent = {
      ...event,
      id: newId,
      name: `${event.name} (Copy)`,
      sections: event.sections.map((s) => ({ ...s, id: uuidv4() })),
      questions: event.questions.map((q) => ({ ...q, id: uuidv4(), sectionId: newId })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({ events: [...state.events, newEvent] }));
  },

  addQuestion: (eventId: string, sectionId: string, type: QuestionType) => {
    const newQuestion: Question = {
      id: uuidv4(),
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
  },

  updateQuestion: (eventId: string, questionId: string, data: Partial<Question>) => {
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
  },

  deleteQuestion: (eventId: string, questionId: string) => {
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
  },

  reorderQuestion: (eventId: string, questionId: string, direction: -1 | 1) => {
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
  },

  addSection: (eventId: string) => {
    const newSection: Section = {
      id: uuidv4(),
      title: "New Section",
    };

    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? { ...e, sections: [...e.sections, newSection], updatedAt: new Date().toISOString() }
          : e
      ),
    }));
  },

  updateSection: (eventId: string, sectionId: string, data: Partial<Section>) => {
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
  },

  deleteSection: (eventId: string, sectionId: string) => {
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
  },

  submitResponse: (data: { eventId: string; answers: Record<string, any>; status: string }) => {
    const newResponse: Response = {
      id: uuidv4(),
      eventId: data.eventId,
      answers: data.answers,
      status: data.status as any,
      submittedAt: new Date().toISOString(),
    };

    set((state) => ({ responses: [...state.responses, newResponse] }));
  },

  setResponseTag: (responseId: string, tag: AttendeeTag) => {
    set((state) => ({
      responses: state.responses.map((r) =>
        r.id === responseId ? { ...r, tag } : r
      ),
    }));
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
      id: uuidv4(),
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
