"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Clapperboard } from "lucide-react";
import CinemaScheduleTickets from "@/components/cinema/cinema-schedule-tickets";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const selectClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";

interface CinemaOption {
  _id: string;
  name: string;
  city?: string | null;
  isActive: boolean;
}

/**
 * The admin's read of one cinema's ticket sales: pick a cinema, then the same
 * week-schedule-picker-plus-Tickets/Seats-tabs view the cinema itself sees on
 * its own Tickets page (`CinemaScheduleTickets`), scoped by an extra cinema
 * picker up front and reading the `/admin/:cinemaId/*` endpoints instead of
 * `/me/*`.
 */
export default function AdminCinemaTicketsPanel({ token }: { token: string | null }) {
  const [cinemas, setCinemas] = useState<CinemaOption[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState("");
  const [loadingCinemas, setLoadingCinemas] = useState(true);

  // Every cinema on the platform — including a suspended one, since a report
  // is read looking backward and a cinema stopped selling today still sold
  // something yesterday.
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/cinemas/admin?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load cinemas");
        const rows: CinemaOption[] = data.data || [];
        setCinemas(rows);
        if (rows.length && !selectedCinemaId) setSelectedCinemaId(rows[0]._id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load cinemas"))
      .finally(() => setLoadingCinemas(false));
    // Runs once — the cinema list itself never changes while this tab is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loadingCinemas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <Label className="text-xs">Cinema</Label>
          {cinemas.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No cinema on the platform yet.
            </p>
          ) : (
            <select
              className={selectClass}
              value={selectedCinemaId}
              onChange={(e) => setSelectedCinemaId(e.target.value)}
            >
              {cinemas.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.city ? ` — ${c.city}` : ""}
                  {!c.isActive ? " (suspended)" : ""}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {selectedCinemaId && token ? (
        <CinemaScheduleTickets
          key={selectedCinemaId}
          token={token}
          endpointBase={`/api/cinemas/admin/${selectedCinemaId}`}
        />
      ) : (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clapperboard className="h-4 w-4" /> Select a cinema to see its ticket sales.
        </p>
      )}
    </div>
  );
}
