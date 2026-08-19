"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  fetchSchedule,
  type CinemaProfile,
  type CinemaSchedule,
  type ScheduleShowtime,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, DoorOpen, Sparkles } from "lucide-react";

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const clock = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

/** One screening in a hall's column. */
function ShowtimeRow({ show }: { show: ScheduleShowtime }) {
  const cancelled = show.status === "cancelled";
  const pct = show.seatsAllocated
    ? Math.round((show.seatsSold / show.seatsAllocated) * 100)
    : 0;

  return (
    <li
      className={`rounded-lg border p-3 transition-colors ${
        cancelled
          ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/40"
          : "border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-indigo-700"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {clock(show.startsAt)}
        </span>
        <span className="font-mono text-xs tabular-nums text-gray-400 dark:text-gray-500">
          → {clock(show.endsAt)}
        </span>
      </div>

      <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-200">
        {show.movie?.title || "Untitled"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {cancelled && <Badge variant="secondary">cancelled</Badge>}
        {!show.isPublished && !cancelled && (
          <Badge variant="outline">unpublished</Badge>
        )}
        {!cancelled && (
          <span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {show.seatsSold}/{show.seatsAllocated} seats
          </span>
        )}
      </div>

      {!cancelled && show.seatsAllocated > 0 && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </li>
  );
}

function ScheduleContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [day, setDay] = useState(() => toKey(new Date()));
  const [data, setData] = useState<CinemaSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        setData(await fetchSchedule(token, date));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load(day);
  }, [day, load]);

  const shift = (days: number) => {
    // Parsed as local midnight, matching how the server reads the date.
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDay(toKey(d));
  };

  const heading = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalShows =
    data?.halls.reduce((n, h) => n + h.showtimes.length, 0) ?? 0;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Schedule
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {heading}
            {!loading && ` · ${totalShows} screening${totalShows === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDay(toKey(new Date()))}>
            Today
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : !data || data.halls.length === 0 ? (
        <Card className="border border-dashed border-gray-300 dark:border-gray-700">
          <CardContent className="py-16 text-center">
            <DoorOpen className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No halls yet. Add one under Programme to start scheduling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* One column per hall — the shape an operator actually reads:
              "what is running in each room, in order". */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.halls.map((hall) => (
              <Card
                key={hall._id}
                className="border border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/30"
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-gray-900 dark:text-gray-100">
                        {hall.name}
                        {!hall.isActive && (
                          <Badge variant="secondary" className="ml-2">off</Badge>
                        )}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {hall.capacity} seats
                        {hall.screenType ? ` · ${hall.screenType}` : ""}
                        {hall.turnaroundMinutes > 0
                          ? ` · ${hall.turnaroundMinutes} min turnaround`
                          : " · no turnaround"}
                      </p>
                    </div>
                  </div>

                  {hall.showtimes.length === 0 ? (
                    <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-600">
                      Nothing scheduled
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {hall.showtimes.map((s) => (
                        <ShowtimeRow key={s._id} show={s} />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* A screening whose hall was removed still sells, so it must not be
              invisible just because it has no column to sit in. */}
          {data.orphanedShowtimes.length > 0 && (
            <Card className="mt-6 border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardContent className="p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
                  <Sparkles className="h-4 w-4" />
                  Screenings with no hall
                </h2>
                <p className="mb-3 text-xs text-amber-800 dark:text-amber-400">
                  These are still on sale. Reassign them to a hall from Programme.
                </p>
                <ul className="space-y-2">
                  {data.orphanedShowtimes.map((s) => (
                    <ShowtimeRow key={s._id} show={s} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function CinemaSchedulePage() {
  return (
    <CinemaGate>
      {(cinema, token) => <ScheduleContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
