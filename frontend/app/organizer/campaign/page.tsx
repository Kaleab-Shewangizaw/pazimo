"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import CreateCampaignPage from "./createCampaign";
import CampaignHistoryPage from "./campaignHistory";

export default function CampaignPage() {
  const [events, setEvents] = useState();
  const [currentPage, setCurrentPage] = useState(true);
  const [tickets, setTickets] = useState();
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) {
          toast.error("Authentication required");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const allEvents = data.events || data.data || [];
          setEvents(allEvents);

          if (allEvents.length > 0 && !selectedEventId) {
            setSelectedEventId(allEvents[0]._id);
          }
        } else {
          toast.error("Failed to load events");
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        toast.error("Error loading events");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  // Fetch Tickets when Event Changes
  useEffect(() => {
    const fetchTickets = async () => {
      if (!selectedEventId) {
        setTickets([]);
        return;
      }

      setIsLoadingTickets(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets || []);
        } else {
          setTickets([]);
          toast.error("Failed to load tickets");
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error("Error loading customers");
        setTickets([]);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [selectedEventId]);

  return (
    <div className="px-4 flex flex-col w-full ">
      <div className="w-full flex items-between py-4 border-y-1 border-gray-300 mb-4">
        {currentPage ? (
          <div className="text-xl font-semibold">Create Campaign</div>
        ) : (
          <div className="text-xl font-semibold">Campaign History </div>
        )}
        <div className="ml-auto">
          {currentPage ? (
            <button
              onClick={() => setCurrentPage(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              View Campaign History
            </button>
          ) : (
            <button
              onClick={() => setCurrentPage(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Create New Campaign
            </button>
          )}
        </div>
      </div>
      {currentPage ? <CreateCampaignPage /> : <CampaignHistoryPage />}
    </div>
  );
}
