import React from "react";
import { Event } from "@/types/invitation";

interface EventDetailsModalProps {
  event: any;
  onClose: () => void;
}

export default function EventDetailsModal({
  event,
  onClose,
}: EventDetailsModalProps) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-w-4xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Event Details</h3>
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

        <div className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold dark:text-gray-100">Basic Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Event Title
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">{event.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Description
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {event.description || "No description available"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</p>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {event.category?.name || "Uncategorized"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.status === "published"
                        ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                        : event.status === "draft"
                        ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                        : event.status === "cancelled"
                        ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Date & Time
                  </p>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span>
                      Start:{" "}
                      {event.startDate
                        ? new Date(event.startDate).toLocaleDateString("en-US")
                        : event.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                    <span>
                      End:{" "}
                      {event.endDate
                        ? new Date(event.endDate).toLocaleDateString("en-US")
                        : "Same day"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</p>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span>
                      {event.location?.address ||
                        event.location ||
                        "No address"}
                      , {event.location?.city || "No city"},{" "}
                      {event.location?.country || "No country"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Capacity</p>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span>{event.capacity || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</p>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full text-sm"
                  >
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ticket Types */}
          {event.ticketTypes && event.ticketTypes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold dark:text-gray-100">Ticket Types</h3>
              <div className="grid gap-4">
                {event.ticketTypes.map((ticket: any, index: number) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-black"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {ticket.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {ticket.description}
                        </p>
                        {ticket.startDate && ticket.endDate && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Available:{" "}
                            {new Date(ticket.startDate).toLocaleDateString(
                              "en-US"
                            )}{" "}
                            -{" "}
                            {new Date(ticket.endDate).toLocaleDateString(
                              "en-US"
                            )}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {ticket.price} ETB
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Quantity: {ticket.quantity}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Available: {ticket.available ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}