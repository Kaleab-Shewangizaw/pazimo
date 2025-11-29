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
  attendees,
  attendeesPage,
  setAttendeesPage,
  attendeesPerPage,
  onClose,
}: AttendeesModalProps) {
  if (!selectedEvent) return null;

  const totalPages = Math.ceil(attendees.length / attendeesPerPage) || 1;
  const startIndex = (attendeesPage - 1) * attendeesPerPage;
  const paginatedAttendees = attendees.slice(
    startIndex,
    startIndex + attendeesPerPage
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full p-6 shadow-xl">
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

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No attendees found
                    </td>
                  </tr>
                ) : (
                  paginatedAttendees.map((attendee) => (
                    <tr key={attendee.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {attendee.customerName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {attendee.guestType === "paid" ? "Paid" : "Guest"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900">
                          {attendee.contact}
                        </div>
                        <div className="text-xs text-gray-500">
                          {attendee.confirmedAt}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            attendee.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : attendee.status === "declined"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {attendee.status.charAt(0).toUpperCase() +
                            attendee.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Total: {attendees.length} | Page {attendeesPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            {totalPages > 1 && (
              <>
                <button
                  onClick={() =>
                    setAttendeesPage(Math.max(attendeesPage - 1, 1))
                  }
                  disabled={attendeesPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setAttendeesPage(Math.min(attendeesPage + 1, totalPages))
                  }
                  disabled={attendeesPage === totalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
