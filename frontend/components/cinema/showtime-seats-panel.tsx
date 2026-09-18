"use client";

import { useEffect, useState } from "react";
import { staffGet, type ScheduleShowtime, type StaffSeatMap as StaffSeatMapData } from "@/lib/cinema-api";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import StaffSeatMap from "@/components/cinema/staff-seat-map";

/** Fetches and renders the Seats tab for one screening. */
export default function ShowtimeSeatsPanel({
  token,
  endpointBase,
  showtime,
}: {
  token: string;
  endpointBase: string;
  showtime: ScheduleShowtime;
}) {
  const [data, setData] = useState<StaffSeatMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    staffGet<StaffSeatMapData>(endpointBase, `/showtimes/${showtime._id}/seats`, token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load seats");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, endpointBase, showtime._id]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!data) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&apos;t load seats for this screening.</p>
    );
  }

  return <StaffSeatMap data={data} />;
}
