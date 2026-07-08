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
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black">
        <div className="border-t rounded-full p-10 animate-spin border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (emptyEvents) {
    return (
      <div className="bg-white dark:bg-black text-gray-500 dark:text-gray-400">
        No events found.
      </div>
    );
  }
  
  return (
    <div className="w-3/5 bg-white dark:bg-black">
      <h2 className="font-semibold text-xl dark:text-gray-100">Events Table</h2>
      <p className="mt-2 mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400 flex items-center flex-wrap gap-1.5">
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