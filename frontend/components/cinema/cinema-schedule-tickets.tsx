"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { staffGet, type CinemaWeekSchedule, type ScheduleShowtime } from "@/lib/cinema-api";
import { toKey, addDays, mondayOf } from "@/lib/cinemaWeek";
import WeekScheduleGrid from "@/components/cinema/week-schedule-grid";
import ShowtimeTicketsPanel from "@/components/cinema/showtime-tickets-panel";
import ShowtimeSeatsPanel from "@/components/cinema/showtime-seats-panel";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The Tickets page's picker + audit view: the same week-at-a-glance grid the
 * Schedule page uses to BUILD the programme, reused here read-only to PICK a
 * screening — then that screening's Tickets and Seats side by side in tabs.
 *
 * Shared between the cinema's own dashboard and the admin's cinema panel:
 * `endpointBase` is the only thing that differs between them
 * (`/api/cinemas/me` vs `/api/cinemas/admin/:cinemaId`).
 */
export default function CinemaScheduleTickets({
  token,
  endpointBase,
}: {
  token: string;
  endpointBase: string;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(toKey(new Date())));
  const [weekData, setWeekData] = useState<CinemaWeekSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string | null>(null);

  const loadWeek = useCallback(
    async (start: string) => {
      setLoading(true);
      try {
        setWeekData(await staffGet<CinemaWeekSchedule>(endpointBase, `/schedule?from=${start}&to=${addDays(start, 7)}`, token));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load the schedule");
      } finally {
        setLoading(false);
      }
    },
    [token, endpointBase]
  );

  useEffect(() => {
    loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  const selectedShowtime: ScheduleShowtime | undefined = useMemo(() => {
    if (!weekData || !selectedHallId || !selectedShowtimeId) return undefined;
    for (const day of weekData.days) {
      const show = (day.halls[selectedHallId] || []).find((s) => s._id === selectedShowtimeId);
      if (show) return show;
    }
    return undefined;
  }, [weekData, selectedHallId, selectedShowtimeId]);

  const selectedHallName = useMemo(
    () => weekData?.halls.find((h) => h._id === selectedHallId)?.name,
    [weekData, selectedHallId]
  );

  const weekEnd = addDays(weekStart, 6);
  const weekHeading = `${new Date(`${weekStart}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })} – ${new Date(`${weekEnd}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{weekHeading}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(toKey(new Date())))}>
            This week
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !weekData || weekData.halls.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clapperboard className="h-4 w-4" /> No halls set up yet.
        </p>
      ) : (
        <WeekScheduleGrid
          halls={weekData.halls}
          days={weekData.days}
          readOnly
          selectedShowtimeId={selectedShowtimeId || undefined}
          onSlotClick={(hallId, _dateKey, showtimeId) => {
            if (!showtimeId) return;
            setSelectedHallId(hallId);
            setSelectedShowtimeId(showtimeId);
          }}
        />
      )}

      {selectedShowtime && (
        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedShowtime.movie?.title || "Untitled"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDateTime(selectedShowtime.startsAt)}
                {selectedHallName ? ` · ${selectedHallName}` : ""}
              </p>
            </div>

            <Tabs defaultValue="tickets" key={selectedShowtime._id}>
              <TabsList>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
                <TabsTrigger value="seats">Seats</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets">
                <ShowtimeTicketsPanel token={token} endpointBase={endpointBase} showtime={selectedShowtime} />
              </TabsContent>
              <TabsContent value="seats">
                <ShowtimeSeatsPanel token={token} endpointBase={endpointBase} showtime={selectedShowtime} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
