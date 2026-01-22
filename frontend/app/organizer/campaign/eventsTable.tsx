import { Megaphone } from "lucide-react";

export default function EventsTable({
  events,
  isLoading,
}: {
  events: any[];
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
          <div
            key={event._id}
            className="group flex items-center justify-between p-5 mb-4 
             bg-white border border-gray-200 rounded-xl shadow-sm 
             hover:shadow-md hover:border-blue-300 transition-all duration-200"
          >
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-xl text-gray-800 tracking-tight">
                {event.title}
              </h3>
              <p className="text-sm text-gray-500">200 phone numbers</p>
            </div>

            <button
              className="flex items-center justify-center p-2 rounded-lg
               bg-blue-600 text-white shadow-lg shadow-blue-200
               hover:bg-blue-700 hover:scale-105 active:scale-95
               transition-all duration-200 cursor-pointer"
              aria-label="Promote event"
            >
              {/* size={32} provides a strong visual presence, while strokeWidth ensures it stays clean */}
              <Megaphone size={32} strokeWidth={2.25} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
