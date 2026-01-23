import { Megaphone } from "lucide-react";
import TableComp from "./eventsTableComp";
import { Event } from "@/types/event";

export default function EventsTable({
  events,
  isLoading,
}: {
  events: Event[];
  isLoading: boolean;
}) {
  const emptyEvents = !isLoading && events.length === 0;

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="border-t rounded-full p-10 animate-spin" />
      </div>
    );
  }

  if (emptyEvents) {
    return <div>No events found.</div>;
  }
  return (
    <div className="w-3/5  ">
      <h2 className="font-semibold text-xl ">Events Table</h2>
      <p className="mt-2 mb-4 text-sm leading-relaxed text-gray-600 flex items-center flex-wrap gap-1.5">
        Click on
        <span className="inline-flex items-center justify-center p-1.5 bg-blue-600 text-white rounded-md shadow-sm">
          <Megaphone size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        to send a campaign to customers who attended the event.
      </p>

      <div className="h-150 overflow-y-auto">
        {events.map((event) => (
          <TableComp key={event._id} event={event} />
        ))}
      </div>
    </div>
  );
}
