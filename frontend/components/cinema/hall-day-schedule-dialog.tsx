"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clapperboard } from "lucide-react";
import TicketTierEditor, {
  tiersForHall,
  type Tier,
} from "@/components/cinema/ticket-tier-editor";
import {
  createShowtime,
  deleteShowtime,
  fetchHalls,
  fetchMovies,
  fetchShowtimes,
  updateShowtime,
  type CinemaHall,
  type CinemaMovie,
  type CinemaProfile,
  type CinemaShowtime,
} from "@/lib/cinema-api";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");

const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toLocalDateTimeInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const addMinutes = (localDateTime: string, minutes: number) => {
  const d = new Date(localDateTime);
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalDateTimeInput(d.toISOString());
};

/**
 * The same weekday (0=Sun..6=Sat), within the Mon–Sun week `startsAtLocal`
 * falls in, at the same time of day. Powers "repeat this screening on other
 * days" — a week's programming block is usually the same film/hall/time run
 * across several days, not a different time each day.
 */
const sameWeekOn = (startsAtLocal: string, targetDow: number) => {
  const anchor = new Date(startsAtLocal);
  const anchorDow = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + (anchorDow === 0 ? -6 : 1 - anchorDow));
  const target = new Date(monday);
  target.setDate(monday.getDate() + (targetDow === 0 ? 6 : targetDow - 1));
  target.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);
  return toLocalDateTimeInput(target.toISOString());
};

const clock = (localOrIso?: string | null) =>
  localOrIso
    ? new Date(localOrIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

// The timeline strip's fixed window. Cinemas don't run 24h; this comfortably
// covers a normal operating day without pretending every hour is bookable.
const STRIP_START_MIN = 6 * 60;
const STRIP_END_MIN = 24 * 60;
const STRIP_SPAN_MIN = STRIP_END_MIN - STRIP_START_MIN;

// Both showtimes and the strip live within one selected day, so there's no
// midnight-rollover case to handle here.
const minutesSinceMidnight = (localOrIso: string) => {
  const d = new Date(localOrIso);
  return d.getHours() * 60 + d.getMinutes();
};

interface FormState {
  movie: string;
  hall: string;
  startsAt: string;
  tiers: Tier[];
  repeatDays: number[];
}

/** Which "+" (or block) is currently expanded into a form. `afterIndex: -1`
 * is the gap before the first block (or the whole day, if it's empty). */
type OpenSlot =
  | { mode: "add"; afterIndex: number }
  | { mode: "edit"; showtimeId: string }
  | null;

const emptyForm = (startsAt: string, hallId: string, hall: CinemaHall | undefined): FormState => ({
  movie: "",
  hall: hallId,
  startsAt,
  tiers: tiersForHall(hall),
  repeatDays: [],
});

/**
 * Manage one hall's screenings for one day. Placing a film fills the block
 * for exactly its runtime; the next "+" is pre-positioned right after it, at
 * end-of-runtime plus the hall's turnaround, so the operator never computes a
 * start time by hand. A hall switcher and day stepper let the whole week get
 * planned without closing the dialog.
 */
export default function HallDayScheduleDialog({
  open,
  onOpenChange,
  token,
  cinema,
  initialHallId,
  initialDate,
  initialShowtimeId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  cinema: CinemaProfile;
  initialHallId?: string;
  initialDate: string;
  initialShowtimeId?: string;
  onChanged: () => void;
}) {
  const [halls, setHalls] = useState<CinemaHall[]>([]);
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [hallId, setHallId] = useState(initialHallId || "");
  const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // A showtime whose hall was deleted: we know it by id but not by hall, so
  // it can't be found through the normal per-hall day query. Resolved once,
  // separately, and only when the caller opened the dialog without a hall.
  const [orphan, setOrphan] = useState<CinemaShowtime | null>(null);
  // True from the moment `orphan` is resolved into a form until it's either
  // saved (reassigned to a real hall) or cancelled — the dialog shows just
  // that form during this window, independent of the top hall/date toolbar.
  const [reassigningOrphan, setReassigningOrphan] = useState(false);

  const [openSlot, setOpenSlot] = useState<OpenSlot>(null);
  const [form, setForm] = useState<FormState | null>(null);

  // Reset to whatever the caller opened the dialog for, each time it opens.
  useEffect(() => {
    if (!open) return;
    setHallId(initialHallId || "");
    setDate(initialDate);
    setOrphan(null);
    setReassigningOrphan(false);
    setOpenSlot(null);
    setForm(null);
  }, [open, initialHallId, initialDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, m] = await Promise.all([fetchHalls(token), fetchMovies(token)]);
      setHalls(h);
      setMovies(m);
      if (hallId) {
        const s = await fetchShowtimes(
          token,
          `?hallId=${hallId}&from=${date}T00:00:00&to=${date}T23:59:59`
        );
        setShowtimes(s.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      } else {
        setShowtimes([]);
        // The orphaned-showtime path: no hall to scope the query by, so find
        // it by scanning everything once. Only worth doing when we actually
        // have an id to look for, haven't already found it, and it's really
        // orphaned (a hall a normal chip click points at gets found via the
        // usual per-hall query above instead).
        if (initialShowtimeId && !orphan && !reassigningOrphan) {
          const all = await fetchShowtimes(token);
          const found = all.find((x) => x._id === initialShowtimeId);
          if (found && !found.hall) setOrphan(found);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hallId, date, initialShowtimeId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const hall = halls.find((h) => h._id === hallId);
  const turnaround = hall?.turnaroundMinutes ?? cinema.turnaroundMinutes ?? 0;

  const beginEdit = useCallback((showtime: CinemaShowtime, forHallId: string) => {
    setOpenSlot({ mode: "edit", showtimeId: showtime._id });
    setForm({
      movie: showtime.movie._id,
      hall: forHallId,
      startsAt: toLocalDateTimeInput(showtime.startsAt),
      tiers: (showtime.ticketTypes || []).map((t) => ({
        name: t.name,
        price: String(t.price ?? ""),
        allocation: String(t.allocation ?? ""),
        seatCategoryKey: t.seatCategoryKey || undefined,
      })),
      repeatDays: [],
    });
  }, []);

  // A chip click brought a specific showtime that DOES belong to the current
  // hall+day — jump straight to editing it once the list has loaded.
  useEffect(() => {
    if (!open || loading || !initialShowtimeId || !hallId) return;
    const target = showtimes.find((s) => s._id === initialShowtimeId);
    if (target) beginEdit(target, hallId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, initialShowtimeId, hallId, showtimes]);

  // The orphan case: as soon as it's resolved, open it pre-filled with no
  // hall — the form's own embedded hall picker (shown whenever `hallId` is
  // blank) is how it gets reassigned.
  useEffect(() => {
    if (!orphan) return;
    beginEdit(orphan, "");
    setReassigningOrphan(true);
    setOrphan(null);
  }, [orphan, beginEdit]);

  const computeAnchor = (afterIndex: number) => {
    const prev = afterIndex >= 0 ? showtimes[afterIndex] : undefined;
    if (prev?.endsAt) return addMinutes(toLocalDateTimeInput(prev.endsAt), turnaround);
    return `${date}T10:00`;
  };

  const beginAdd = (afterIndex: number) => {
    const anchor = computeAnchor(afterIndex);
    setOpenSlot({ mode: "add", afterIndex });
    setForm(emptyForm(anchor, hallId, hall));
  };

  const closeForm = () => {
    setOpenSlot(null);
    setForm(null);
    setReassigningOrphan(false);
  };

  const submit = async () => {
    if (!form || !form.hall) return;
    setBusy(true);
    try {
      const ticketTypes = form.tiers.map((t) => ({
        name: t.name,
        price: Number(t.price),
        ...(t.seatCategoryKey
          ? { seatCategoryKey: t.seatCategoryKey }
          : { allocation: Number(t.allocation) }),
      }));

      if (openSlot?.mode === "edit") {
        await updateShowtime(token, openSlot.showtimeId, {
          movie: form.movie,
          hall: form.hall,
          startsAt: form.startsAt,
          ticketTypes,
        });
        toast.success("Screening updated");
      } else {
        const dates = [
          form.startsAt,
          ...form.repeatDays
            .filter((d) => d !== new Date(form.startsAt).getDay())
            .map((d) => sameWeekOn(form.startsAt, d)),
        ];

        let succeeded = 0;
        const failures: string[] = [];
        for (const startsAt of dates) {
          try {
            await createShowtime(token, { movie: form.movie, hall: form.hall, startsAt, ticketTypes });
            succeeded += 1;
          } catch (e) {
            const label = new Date(startsAt).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
            });
            failures.push(`${label}: ${(e as Error).message}`);
          }
        }

        if (dates.length === 1) {
          if (succeeded === 1) toast.success("Screening scheduled");
          else toast.error(failures[0]);
        } else if (failures.length === 0) {
          toast.success(`Scheduled ${succeeded} screenings`);
        } else {
          toast.error(`Scheduled ${succeeded} of ${dates.length} — ${failures.length} skipped`);
          failures.forEach((f) => toast.error(f));
        }
      }

      closeForm();
      await load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (showtime: CinemaShowtime) => {
    setBusy(true);
    try {
      const res = await deleteShowtime(token, showtime._id);
      toast.success(res.message || "Screening removed");
      if (openSlot?.mode === "edit" && openSlot.showtimeId === showtime._id) closeForm();
      await load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shiftDay = (n: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + n);
    setDate(toKey(d));
    closeForm();
  };

  const selectedMovie = movies.find((m) => m._id === form?.movie);
  const previewEnd = useMemo(() => {
    if (!form?.startsAt || !selectedMovie?.durationMinutes) return null;
    return addMinutes(form.startsAt, selectedMovie.durationMinutes);
  }, [form?.startsAt, selectedMovie?.durationMinutes]);

  const selectClass =
    "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";

  const renderForm = () => {
    if (!form) return null;
    const anchorDow = new Date(form.startsAt).getDay();
    return (
      <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
        {/* Only asked when the hall isn't already fixed by the dialog's own
            selector — the orphaned-showtime reassignment case. */}
        {!hallId && (
          <div>
            <Label className="text-xs">Hall</Label>
            <select
              className={selectClass}
              value={form.hall}
              onChange={(e) => setForm({ ...form, hall: e.target.value })}
            >
              <option value="">Select…</option>
              {halls
                .filter((h) => h.isActive)
                .map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Film</Label>
            <select
              className={selectClass}
              value={form.movie}
              onChange={(e) => setForm({ ...form, movie: e.target.value })}
            >
              <option value="">Select…</option>
              {movies
                .filter((m) => m.isActive)
                .map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                    {m.durationMinutes ? ` (${m.durationMinutes} min)` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">
              Starts at{previewEnd ? ` — ends around ${clock(previewEnd)}` : ""}
            </Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
        </div>

        {openSlot?.mode === "add" && (
          <div>
            <Label className="text-xs">
              Repeat on — same film, hall and time, on other days this week
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, dow) => {
                const isAnchor = dow === anchorDow;
                const checked = isAnchor || form.repeatDays.includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    disabled={isAnchor}
                    onClick={() =>
                      setForm({
                        ...form,
                        repeatDays: form.repeatDays.includes(dow)
                          ? form.repeatDays.filter((d) => d !== dow)
                          : [...form.repeatDays, dow],
                      })
                    }
                    className={`h-8 w-11 rounded-md border text-xs font-medium transition-colors ${
                      checked
                        ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                    } ${isAnchor ? "cursor-default opacity-80" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <TicketTierEditor
          hall={halls.find((h) => h._id === form.hall)}
          tiers={form.tiers}
          setTiers={(tiers) => setForm({ ...form, tiers })}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={submit} disabled={busy || !form.movie || !form.hall || !form.startsAt}>
            {openSlot?.mode === "edit"
              ? "Save changes"
              : form.repeatDays.length > 0
                ? `Schedule ${form.repeatDays.length + 1} screenings`
                : "Schedule screening"}
          </Button>
          <Button variant="ghost" size="sm" onClick={closeForm} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  const addTrigger = (afterIndex: number, label: string) => (
    <button
      type="button"
      onClick={() => beginAdd(afterIndex)}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
          <DialogDescription>
            Pick a time and a film — the block fills in for its runtime, and the
            next &quot;+&quot; already accounts for {hall ? `${hall.name}'s` : "the hall's"}{" "}
            turnaround.
          </DialogDescription>
        </DialogHeader>

        {reassigningOrphan ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This screening&apos;s hall was removed. Pick a hall below to
              reassign it — everything else about the screening stays as it
              was.
            </p>
            {renderForm()}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
              <select
                className={selectClass + " sm:w-56"}
                value={hallId}
                onChange={(e) => {
                  setHallId(e.target.value);
                  closeForm();
                }}
              >
                <option value="">Select a hall…</option>
                {halls
                  .filter((h) => h.isActive)
                  .map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
              </select>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Previous day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[9rem] text-center text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Next day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDate(toKey(new Date()));
                    closeForm();
                  }}
                >
                  Today
                </Button>
              </div>
            </div>

            {!hallId ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Pick a hall to see and schedule its day.
              </p>
            ) : loading ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <div className="space-y-3">
                {/* Decorative capacity glance — the list below is what's clickable. */}
                <div className="relative h-6 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                  {showtimes.map((s) => {
                    if (!s.endsAt) return null;
                    const startMin = Math.max(minutesSinceMidnight(s.startsAt), STRIP_START_MIN);
                    const endMin = Math.min(minutesSinceMidnight(s.endsAt), STRIP_END_MIN);
                    const gapEndMin = Math.min(endMin + turnaround, STRIP_END_MIN);
                    if (endMin <= STRIP_START_MIN || startMin >= STRIP_END_MIN) return null;
                    const left = ((startMin - STRIP_START_MIN) / STRIP_SPAN_MIN) * 100;
                    const width = ((endMin - startMin) / STRIP_SPAN_MIN) * 100;
                    const gapWidth = ((gapEndMin - endMin) / STRIP_SPAN_MIN) * 100;
                    return (
                      <div key={s._id} className="absolute top-0 h-full" style={{ left: `${left}%` }}>
                        <div
                          className={`h-full ${s.status === "cancelled" ? "bg-gray-300 dark:bg-gray-700" : "bg-indigo-500"}`}
                          style={{ width: `${width}%` }}
                        />
                        <div
                          className="absolute top-0 h-full bg-indigo-200 dark:bg-indigo-900"
                          style={{ left: `${width}%`, width: `${gapWidth}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {showtimes.length === 0 ? (
                  openSlot?.mode === "add" && openSlot.afterIndex === -1
                    ? renderForm()
                    : addTrigger(-1, "Add the first screening")
                ) : (
                  <div className="space-y-2">
                    {openSlot?.mode === "add" && openSlot.afterIndex === -1
                      ? renderForm()
                      : addTrigger(-1, "Add a screening before this")}

                    {showtimes.map((s, i) => {
                      const isEditingThis = openSlot?.mode === "edit" && openSlot.showtimeId === s._id;
                      const isAddingAfter = openSlot?.mode === "add" && openSlot.afterIndex === i;
                      return (
                        <div key={s._id} className="space-y-2">
                          {isEditingThis ? (
                            renderForm()
                          ) : (
                            <div
                              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                                s.status === "cancelled"
                                  ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/40"
                                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/60"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <Clapperboard className="h-4 w-4 shrink-0 text-indigo-500" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {clock(s.startsAt)}–{clock(s.endsAt)} · {s.movie.title}
                                    {s.status !== "scheduled" && (
                                      <Badge variant="secondary" className="ml-2">
                                        {s.status}
                                      </Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {(s.ticketTypes || [])
                                      .map((t) => `${t.name} ${t.price} ETB`)
                                      .join(" · ") || "No tiers"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => beginEdit(s, hallId)}>
                                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => remove(s)} disabled={busy}>
                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                                </Button>
                              </div>
                            </div>
                          )}

                          {!s.endsAt ? (
                            <p className="px-1 text-xs text-amber-600 dark:text-amber-500">
                              This film has no runtime set, so the next start time
                              can&apos;t be computed automatically — add the next
                              screening with a time of your choosing.
                            </p>
                          ) : isAddingAfter ? (
                            renderForm()
                          ) : (
                            addTrigger(i, "Add a screening after this")
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
