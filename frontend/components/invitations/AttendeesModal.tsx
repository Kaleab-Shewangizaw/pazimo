import React from "react";
import { Event, Attendee } from "@/types/invitation";

interface AttendeesModalProps {
  selectedEvent: Event | null;
  attendees: Attendee[];
  isLoading: boolean;
  attendeesPage: number;
  setAttendeesPage: (page: number) => void;
  attendeesPerPage: number;
  onClose: () => void;
}

export default function AttendeesModal({
  selectedEvent,
  attendees,
  isLoading,
  attendeesPage,
  setAttendeesPage,
  attendeesPerPage,
  onClose,
}: AttendeesModalProps) {
  if (!selectedEvent) return null;

  // Filter attendees to only show valid tickets
  const filteredAttendees = attendees.filter((attendee) => {
    const status = attendee.status.toLowerCase();
    return (
      status === "pending" ||
      status === "confirmed" ||
      status === "declined" ||
      status === "active" ||
      status === "used" ||
      status === "invited" ||
      status === "sent"
    );
  });
  const totalPages =
    Math.ceil(filteredAttendees.length / attendeesPerPage) || 1;
  const startIndex = (attendeesPage - 1) * attendeesPerPage;
  const paginatedAttendees = filteredAttendees.slice(
    startIndex,
    startIndex + attendeesPerPage
  );

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Event Attendees
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{selectedEvent.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedEvent.date} at {selectedEvent.time}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Ticket Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Usage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-800">
                    {attendees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                          No attendees found
                        </td>
                      </tr>
                    ) : (
                      paginatedAttendees.map((attendee) => {
                        const isGuestPending = !attendee.hasTicket;

                        const displayTicketType = isGuestPending
                          ? "Guest"
                          : attendee.ticketType || "Regular";

                        const total = attendee.purchaseQuantity || 1;
                        const usedCount = Math.max(
                          0,
                          total - (attendee.ticketCount || 0)
                        );

                        const displayUsage = isGuestPending
                          ? "-"
                          : `${usedCount}/${total}`;

                        const displayStatus =
                          attendee.status.charAt(0).toUpperCase() +
                          attendee.status.slice(1);

                        return (
                          <tr key={attendee.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 py-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {attendee.customerName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {attendee.contact}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {displayTicketType}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  attendee.status === "confirmed" ||
                                  attendee.status === "active" ||
                                  attendee.status === "used"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                                    : attendee.status === "declined" ||
                                      attendee.status === "cancelled"
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                                }`}
                              >
                                {displayStatus}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {displayUsage === "-" ? (
                                  <span className="text-gray-400 dark:text-gray-500">-</span>
                                ) : (
                                  <span className="font-medium">
                                    {displayUsage}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: {filteredAttendees.length} | Page {attendeesPage} of{" "}
                {totalPages}
              </div>
              <div className="flex gap-2">
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setAttendeesPage(Math.max(attendeesPage - 1, 1))
                      }
                      disabled={attendeesPage === 1}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() =>
                        setAttendeesPage(
                          Math.min(attendeesPage + 1, totalPages)
                        )
                      }
                      disabled={attendeesPage === totalPages}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}