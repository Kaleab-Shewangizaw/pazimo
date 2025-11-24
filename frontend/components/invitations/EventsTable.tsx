import React from "react";
import { Search } from "lucide-react";
import { Event } from "@/types/invitation";

interface EventsTableProps {
  events: Event[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectEvent: (event: Event) => void;
  onViewDetails: (event: Event) => void;
  onViewAttendees: (event: Event) => void;
  onBulkInviteClick: (event: Event) => void;
  isLoading?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
}

export default function EventsTable({
  events,
  searchQuery,
  setSearchQuery,
  onSelectEvent,
  onViewDetails,
  onViewAttendees,
  onBulkInviteClick,
  isLoading = false,
  currentPage = 1,
  itemsPerPage = 5,
}: EventsTableProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvents = events.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Events</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organizer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading events...
                </td>
              </tr>
            ) : paginatedEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No events found.
                </td>
              </tr>
            ) : (
              paginatedEvents.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onViewDetails(event)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {event.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {event.description || "No description"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{event.date}</div>
                    <div className="text-sm text-gray-500">{event.time}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {event.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        event.isPublic === false
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {event.isPublic === false ? "private" : "public"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {event.organizer}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        event.status === "active"
                          ? "bg-green-100 text-green-800"
                          : event.status === "upcoming"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {event.status || "upcoming"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      disabled={event.status !== "published"}
                      className={`mr-3 ${
                        event.status === "published"
                          ? "text-blue-600 hover:text-blue-900"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={
                        event.status !== "published"
                          ? "Event must be published by admin first"
                          : ""
                      }
                    >
                      Send Invites
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBulkInviteClick(event);
                      }}
                      disabled={event.status !== "published"}
                      className={`mr-3 ${
                        event.status === "published"
                          ? "text-purple-600 hover:text-purple-900"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={
                        event.status !== "published"
                          ? "Event must be published by admin first"
                          : ""
                      }
                    >
                      Bulk Invite
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewAttendees(event);
                      }}
                      className="text-green-600 hover:text-green-900 ml-3"
                    >
                      View Attendees
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
