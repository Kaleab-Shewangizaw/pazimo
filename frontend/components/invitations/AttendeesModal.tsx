import React from "react";
import { Event, Attendee } from "@/types/invitation";

interface AttendeesModalProps {
  selectedEvent: Event | null;
  attendees: Attendee[];
  attendeesPage: number;
  setAttendeesPage: (page: number) => void;
  attendeesPerPage: number;
  onClose: () => void;
}

export default function AttendeesModal({
  selectedEvent,
  onClose,
}: AttendeesModalProps) {
  if (!selectedEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            Event Attendees
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-900">{selectedEvent.title}</h4>
          <p className="text-sm text-gray-600">
            {selectedEvent.date} at {selectedEvent.time}
          </p>
        </div>
      </div>
    </div>
  );
}
