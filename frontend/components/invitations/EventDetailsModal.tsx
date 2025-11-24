import React from "react";
import { Event } from "@/types/invitation";

interface EventDetailsModalProps {
  event: any; // Using any here as the event details structure might be complex, but ideally should be typed
  onClose: () => void;
}

export default function EventDetailsModal({
  event,
  onClose,
}: EventDetailsModalProps) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-4xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Event Details</h3>
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

        <div className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Basic Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Event Title
                  </p>
                  <p className="text-gray-900">{event.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Description
                  </p>
                  <p className="text-gray-600">
                    {event.description || "No description available"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Category</p>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                    {event.category?.name || "Uncategorized"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.status === "published"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : event.status === "draft"
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : event.status === "cancelled"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {event.status}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Date & Time
                  </p>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>
                      Start:{" "}
                      {event.startDate
                        ? new Date(event.startDate).toLocaleDateString("en-US")
                        : event.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <span>
                      End:{" "}
                      {event.endDate
                        ? new Date(event.endDate).toLocaleDateString("en-US")
                        : "Same day"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <div className="flex items-center gap-2 text-gray-600">
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
                  <p className="text-sm font-medium text-gray-500">Capacity</p>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>{event.capacity || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Tags</p>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
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
              <h3 className="text-xl font-semibold">Ticket Types</h3>
              <div className="grid gap-4">
                {event.ticketTypes.map((ticket: any, index: number) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ticket.name}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {ticket.description}
                        </p>
                        {ticket.startDate && ticket.endDate && (
                          <p className="text-xs text-gray-400">
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
                        <p className="font-medium">{ticket.price} ETB</p>
                        <p className="text-sm text-gray-500">
                          Quantity: {ticket.quantity}
                        </p>
                        <p className="text-sm text-gray-500">
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
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
