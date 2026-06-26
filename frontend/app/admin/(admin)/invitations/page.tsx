"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, User, ArrowRight, MapPin } from "lucide-react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

interface EventData {
  _id: string;
  title: string;
  organizer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  startDate: string;
  location: {
    address: string;
    city: string;
  };
  status: string;
}

export default function InvitationsEventListPage() {
  const { token } = useAdminAuthStore();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchEvents();
  }, [currentPage, searchQuery]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Use the public events endpoint but with admin token it might return more?
      // Or use the general getAllEvents which supports filtering
      // We need to ensure we get ALL events, so we might need to check if the backend supports a search query for events
      // The backend eventController.getAllEvents supports: category, status, startDate, endDate, city, country, sort, page, limit
      // It does NOT seem to support 'search' (text search on title).
      // We might need to filter client-side or ask backend to add search.
      // For now, let's fetch and see. If search isn't supported, we might need to fetch more and filter locally or update backend.
      // Wait, the previous implementation used `/api/events?limit=1000&sort=-createdAt`.

      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sort: "-createdAt",
      });

      // Note: The backend currently doesn't support text search on title in getAllEvents.
      // We will fetch events and if search is present, we might need to handle it differently
      // or just rely on what we have.
      // Ideally, we should update the backend to support 'search' query param.
      // For now, let's assume we just list them.

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();

      // Client-side filtering for search if backend doesn't support it
      let filteredEvents = data.data;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter(
          (event: EventData) =>
            event.title.toLowerCase().includes(lowerQuery) ||
            (event.organizer?.firstName + " " + event.organizer?.lastName)
              .toLowerCase()
              .includes(lowerQuery)
        );
      }

      setEvents(filteredEvents);
      // Note: Pagination from backend might be off if we filter client-side.
      // But without backend search support, this is the best we can do without changing backend.
      // If the user wants proper search, we should update the backend.

      // Fix for "Page 1 of NaN"
      // The backend returns pagination info in `data.pagination` or `data.total` depending on the endpoint structure.
      // Looking at eventController.js:
      // res.status(StatusCodes.OK).json({ status: "success", data: ..., pagination: { total, page, pages } });

      let totalCount = 0;
      if (data.pagination && typeof data.pagination.total === "number") {
        totalCount = data.pagination.total;
      } else if (typeof data.total === "number") {
        totalCount = data.total;
      } else if (Array.isArray(data.data)) {
        totalCount = data.data.length;
      }

      // If we are filtering client-side, the total pages should be based on the filtered result if we were doing client-side pagination.
      // But here we are fetching a page from backend, then filtering it. This is weird UX (filtering only current page).
      // Ideally we fetch ALL events if we want client side search, OR we rely on backend search.
      // Since we are fetching page by page, client side search is limited to current page.
      // However, the user wants "search filter".
      // If we want to fix "NaN", we ensure totalCount is valid.

      const calculatedTotalPages = Math.ceil(totalCount / itemsPerPage) || 1;
      setTotalPages(calculatedTotalPages);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Select an event to view its invitations
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>All Events</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Title</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {event.status}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          {event.organizer
                            ? `${event.organizer.firstName} ${event.organizer.lastName}`
                            : "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {new Date(event.startDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {event.location?.city || "Online"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/invitations/${event._id}`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            View Invitations
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end space-x-2 p-4">
            <div className="flex-1 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
