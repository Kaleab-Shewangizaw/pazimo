"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import EventsTable from "./eventsTable";

export default function CreateCampaignPage() {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [events, setEvents] = useState();
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

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

  return (
    <div className="w-full flex relative">
      <EventsTable events={events || []} isLoading={isLoadingEvents} />
      <div />
    </div>
  );
}
