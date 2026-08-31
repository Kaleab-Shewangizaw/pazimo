"use client";

import { Fragment } from "react";
import { Plus } from "lucide-react";
import type { ScheduleDay, ScheduleHallMeta, ScheduleShowtime } from "@/lib/cinema-api";

const clock = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

const dayHeading = (dateKey: string) => {
  const d = new Date(`${dateKey}T00:00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    dayNum: d.getDate(),
  };
};

const isToday = (dateKey: string) => {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  return dateKey === todayKey;
};

/** One screening, condensed to fit a week-grid cell. */
function ShowtimeChip({
  show,
  onClick,
}: {
  show: ScheduleShowtime;
  onClick: () => void;
}) {
  const cancelled = show.status === "cancelled";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${show.movie?.title || "Untitled"} · ${clock(show.startsAt)}`}
      className={`block w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
        cancelled
          ? "border-gray-200 bg-gray-50 text-gray-400 line-through opacity-70 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-600"
          : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
      }`}
    >
      <span className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {clock(show.startsAt)}
      </span>
      {!show.isPublished && !cancelled && (
        <span className="ml-1 text-amber-600 dark:text-amber-500">·unpub</span>
      )}
      <p className="truncate text-gray-700 dark:text-gray-300">
        {show.movie?.title || "Untitled"}
      </p>
    </button>
  );
}

/**
 * The week's programming board: one row per hall, one column per day. This is
 * the "how do I schedule the week" view — an empty cell is itself the button
 * to add a screening there, and an existing chip is the button to edit it.
 */
export default function WeekScheduleGrid({
  halls,
  days,
  onSlotClick,
}: {
  halls: ScheduleHallMeta[];
  days: ScheduleDay[];
  onSlotClick: (hallId: string, dateKey: string, showtimeId?: string) => void;
}) {
  if (halls.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <div
        className="grid min-w-[900px]"
        style={{ gridTemplateColumns: `10rem repeat(${days.length}, 1fr)` }}
      >
        {/* Header row */}
        <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900" />
        {days.map((day) => {
          const { weekday, dayNum } = dayHeading(day.date);
          const today = isToday(day.date);
          return (
            <div
              key={day.date}
              className={`border-b border-gray-200 p-2 text-center dark:border-gray-800 ${
                today ? "bg-indigo-50 dark:bg-indigo-950/30" : "bg-gray-50 dark:bg-gray-900"
              }`}
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {weekday}
              </p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  today
                    ? "text-indigo-700 dark:text-indigo-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {dayNum}
              </p>
            </div>
          );
        })}

        {/* One row per hall */}
        {halls.map((hall) => (
          <Fragment key={hall._id}>
            <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-b border-r border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {hall.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hall.capacity} seats
              </p>
            </div>
            {days.map((day) => {
              const shows = day.halls[hall._id] || [];
              return (
                <div
                  key={`${hall._id}-${day.date}`}
                  className="group min-h-[4.5rem] space-y-1 border-b border-gray-200 p-1.5 dark:border-gray-800"
                >
                  {shows.map((s) => (
                    <ShowtimeChip
                      key={s._id}
                      show={s}
                      onClick={() => onSlotClick(hall._id, day.date, s._id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onSlotClick(hall._id, day.date)}
                    aria-label={`Add a screening in ${hall.name} on ${day.date}`}
                    className="flex w-full items-center justify-center rounded-md border border-dashed border-gray-200 py-1 text-gray-300 opacity-0 transition-opacity hover:border-indigo-300 hover:text-indigo-500 group-hover:opacity-100 dark:border-gray-800 dark:text-gray-700 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
