"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  cinemaRequest,
  fetchHalls,
  fetchMovies,
  fetchShowtimes,
  money,
  type CinemaHall,
  type CinemaMovie,
  type CinemaProfile,
  type CinemaShowtime,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Film, CalendarDays, DoorOpen, LayoutGrid, Pencil } from "lucide-react";
import SeatMapEditor from "@/components/cinema/seat-map-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Tier {
  name: string;
  price: string;
  allocation: string;
  /**
   * Set only on a hall with a seat map. Its presence is what switches this tier
   * from "a count I typed" to "the price of a category", which is also how
   * addShowtime decides what to send.
   */
  seatCategoryKey?: string;
}

function ProgrammeContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [halls, setHalls] = useState<CinemaHall[]>([]);
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [showtimes, setShowtimes] = useState<CinemaShowtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [h, m, s] = await Promise.all([
      fetchHalls(token),
      fetchMovies(token),
      fetchShowtimes(token),
    ]);
    setHalls(h);
    setMovies(m);
    setShowtimes(s);
  }, [token]);

  useEffect(() => {
    reload()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [reload]);

  // --- Halls ---------------------------------------------------------------
  const [hallForm, setHallForm] = useState({
    name: "",
    capacity: "",
    screenType: "",
    turnaroundMinutes: "",
  });

  const addHall = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/halls", token, {
        method: "POST",
        body: JSON.stringify({
          name: hallForm.name,
          capacity: Number(hallForm.capacity),
          screenType: hallForm.screenType || undefined,
          // Blank means inherit the cinema's default, which the API expresses
          // as null rather than 0 — 0 is a real answer ("no gap needed").
          turnaroundMinutes: hallForm.turnaroundMinutes === ""
            ? null
            : Number(hallForm.turnaroundMinutes),
        }),
      });
      toast.success("Hall added");
      setHallForm({ name: "", capacity: "", screenType: "", turnaroundMinutes: "" });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Which hall's seat map is open. One at a time: two open editors would let an
  // operator save one over the other without noticing.
  const [editingSeatMap, setEditingSeatMap] = useState<CinemaHall | null>(null);

  const saveSeatMap = async (
    hallId: string,
    payload: { seatCategories: unknown; seatMap: unknown }
  ) => {
    setBusy(true);
    try {
      const res = await cinemaRequest<{ warning?: string }>(`/api/cinemas/me/halls/${hallId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          // Saving a map is what turns assigned seating on. Doing it implicitly
          // avoids the state where a hall has a map that nothing reads because a
          // separate switch was never flipped.
          hasAssignedSeating: true,
        }),
      });
      // The server returns a warning when screenings already booked into this
      // hall still price by seat count. Shown for longer than a success toast,
      // because it is a job the operator now has to do.
      const warning = (res as { warning?: string })?.warning;
      if (warning) {
        toast.warning(warning, { duration: 12000 });
      } else {
        toast.success("Seat map saved");
      }
      setEditingSeatMap(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Which hall's plain details (name, capacity, screen type, turnaround,
  // active) are open for editing. Separate from editingSeatMap: renaming a
  // hall and re-drawing its seats are different jobs, and conflating them
  // into one dialog would make a quick rename drag in the whole seat grid.
  const [editingHall, setEditingHall] = useState<CinemaHall | null>(null);
  const [hallEditForm, setHallEditForm] = useState({
    name: "",
    capacity: "",
    screenType: "",
    turnaroundMinutes: "",
    isActive: true,
  });

  const openHallEdit = (h: CinemaHall) => {
    setEditingHall(h);
    setHallEditForm({
      name: h.name,
      capacity: String(h.capacity),
      screenType: h.screenType || "",
      turnaroundMinutes:
        h.turnaroundMinutes === null || h.turnaroundMinutes === undefined
          ? ""
          : String(h.turnaroundMinutes),
      isActive: h.isActive,
    });
  };

  const saveHallDetails = async () => {
    if (!editingHall) return;
    setBusy(true);
    try {
      await cinemaRequest(`/api/cinemas/me/halls/${editingHall._id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name: hallEditForm.name,
          // Ignored by the server on a hall with a seat map — capacity
          // there is derived from the map's sellable seats, not typed. The
          // field stays disabled in that case so this is never surprising.
          capacity: Number(hallEditForm.capacity),
          screenType: hallEditForm.screenType || undefined,
          turnaroundMinutes:
            hallEditForm.turnaroundMinutes === ""
              ? null
              : Number(hallEditForm.turnaroundMinutes),
          isActive: hallEditForm.isActive,
        }),
      });
      toast.success("Hall updated");
      setEditingHall(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeHall = async (id: string) => {
    try {
      const res = await cinemaRequest<{ message?: string }>(
        `/api/cinemas/me/halls/${id}`,
        token,
        { method: "DELETE" }
      );
      toast.success(res.message || "Hall removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // --- Movies --------------------------------------------------------------
  const EMPTY_MOVIE_FORM = {
    title: "",
    durationMinutes: "",
    ageRating: "",
    language: "",
    subtitles: "",
    genre: "",
    trailerUrl: "",
    releaseDate: "",
    status: "now_showing",
    description: "",
  };
  const [movieForm, setMovieForm] = useState(EMPTY_MOVIE_FORM);
  const [poster, setPoster] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  // Null while adding, a film id while correcting one. The same form does both:
  // a separate edit form would drift from the add form, and the fields are
  // identical.
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);

  const beginEditMovie = (movie: CinemaMovie) => {
    setEditingMovieId(movie._id);
    setMovieForm({
      title: movie.title || "",
      durationMinutes: movie.durationMinutes ? String(movie.durationMinutes) : "",
      ageRating: movie.ageRating || "",
      language: movie.language || "",
      subtitles: movie.subtitles || "",
      genre: (movie.genre || []).join(", "),
      trailerUrl: movie.trailerUrl || "",
      // The date input wants YYYY-MM-DD; the API returns an ISO timestamp.
      releaseDate: movie.releaseDate ? String(movie.releaseDate).slice(0, 10) : "",
      status: movie.status || "now_showing",
      description: movie.description || "",
    });
    // Images are deliberately left unset: an edit that sends no file keeps the
    // existing poster rather than clearing it.
    setPoster(null);
    setCover(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditMovie = () => {
    setEditingMovieId(null);
    setMovieForm(EMPTY_MOVIE_FORM);
    setPoster(null);
    setCover(null);
  };

  const addMovie = async () => {
    setBusy(true);
    try {
      // Multipart rather than JSON: the poster and cover are files, and they go
      // through the same multer upload the rest of the platform uses.
      const body = new FormData();
      Object.entries(movieForm).forEach(([k, v]) => {
        if (v !== "" && v !== undefined) body.append(k, String(v));
      });
      if (poster) body.append("poster", poster);
      if (cover) body.append("coverImage", cover);

      await cinemaRequest(
        editingMovieId
          ? `/api/cinemas/me/movies/${editingMovieId}`
          : "/api/cinemas/me/movies",
        token,
        { method: editingMovieId ? "PATCH" : "POST", body }
      );
      // Editing a customer-facing field sends a published film back to the
      // admin queue. Said out loud, because otherwise it silently disappears
      // from the public listing and looks like a bug.
      toast.success(
        editingMovieId
          ? "Film updated. Listing changes go back to the admin for review."
          : "Film added"
      );
      setEditingMovieId(null);
      setMovieForm(EMPTY_MOVIE_FORM);
      setPoster(null);
      setCover(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeMovie = async (id: string) => {
    try {
      const res = await cinemaRequest<{ message?: string }>(
        `/api/cinemas/me/movies/${id}`,
        token,
        { method: "DELETE" }
      );
      toast.success(res.message || "Film removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // --- Showtimes -----------------------------------------------------------
  const [showForm, setShowForm] = useState({ movie: "", hall: "", startsAt: "" });
  const [tiers, setTiers] = useState<Tier[]>([
    { name: "Regular", price: "", allocation: "" },
  ]);

  // The hall being scheduled into. Its seat map decides whether the cinema is
  // pricing CATEGORIES or typing seat counts by hand.
  const selectedHall = halls.find((h) => h._id === showForm.hall);
  const assignedSeating = !!selectedHall?.hasAssignedSeating;

  // When an assigned-seating hall is picked, the tier list becomes exactly its
  // categories: one price each, no more and no fewer. The server refuses any
  // other shape — a category nobody prices, or two tiers pricing one category —
  // so the form should not let it be built in the first place.
  useEffect(() => {
    if (!assignedSeating || !selectedHall?.seatCategories?.length) return;
    setTiers(
      selectedHall.seatCategories.map((category) => ({
        name: category.label,
        price: "",
        allocation: "",
        seatCategoryKey: category.key,
      }))
    );
  }, [showForm.hall, assignedSeating, selectedHall]);

  // Null while scheduling, a showtime id while correcting one.
  const [editingShowtimeId, setEditingShowtimeId] = useState<string | null>(null);

  const beginEditShowtime = (showtime: CinemaShowtime) => {
    setEditingShowtimeId(showtime._id);
    setShowForm({
      movie: typeof showtime.movie === "string" ? showtime.movie : showtime.movie?._id || "",
      hall: typeof showtime.hall === "string" ? showtime.hall : showtime.hall?._id || "",
      // datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. Slicing the ISO
      // string would silently shift the screening by the UTC offset — a 19:30
      // showing becoming 16:30 is exactly the mistake this form exists to fix.
      startsAt: toLocalDateTimeInput(showtime.startsAt),
    });
    setTiers(
      (showtime.ticketTypes || []).map((t) => ({
        name: t.name,
        price: String(t.price ?? ""),
        allocation: String(t.allocation ?? ""),
        seatCategoryKey: t.seatCategoryKey || undefined,
      }))
    );
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditShowtime = () => {
    setEditingShowtimeId(null);
    setShowForm({ movie: "", hall: "", startsAt: "" });
    setTiers([{ name: "Regular", price: "", allocation: "" }]);
  };

  const addShowtime = async () => {
    setBusy(true);
    try {
      await cinemaRequest(
        editingShowtimeId
          ? `/api/cinemas/me/showtimes/${editingShowtimeId}`
          : "/api/cinemas/me/showtimes",
        token,
        {
        method: editingShowtimeId ? "PATCH" : "POST",
        body: JSON.stringify({
          movie: showForm.movie,
          hall: showForm.hall,
          startsAt: showForm.startsAt,
          ticketTypes: tiers.map((t) => ({
            name: t.name,
            price: Number(t.price),
            // On an assigned-seating hall the seat map decides the allocation,
            // so none is sent — sending one would be a number the server
            // discards, and a reader of this code would think it mattered.
            ...(t.seatCategoryKey
              ? { seatCategoryKey: t.seatCategoryKey }
              : { allocation: Number(t.allocation) }),
          })),
        }),
      }
      );
      toast.success(editingShowtimeId ? "Screening updated" : "Screening scheduled");
      setEditingShowtimeId(null);
      setShowForm({ movie: "", hall: "", startsAt: "" });
      setTiers([{ name: "Regular", price: "", allocation: "" }]);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelShowtime = async (id: string) => {
    try {
      const res = await cinemaRequest<{ message?: string }>(
        `/api/cinemas/me/showtimes/${id}`,
        token,
        { method: "DELETE" }
      );
      toast.success(res.message || "Screening removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const selectClass =
    "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Programme
      </h1>

      <Tabs defaultValue="showtimes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 dark:bg-gray-900/70 sm:w-[420px]">
          <TabsTrigger value="showtimes">Screenings</TabsTrigger>
          <TabsTrigger value="movies">Films</TabsTrigger>
          <TabsTrigger value="halls">Halls</TabsTrigger>
        </TabsList>

        {/* Screenings ------------------------------------------------------ */}
        <TabsContent value="showtimes" className="space-y-6">
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                {editingShowtimeId ? "Edit screening" : "Schedule a screening"}
              </h2>

              {halls.length === 0 || movies.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add at least one hall and one film first.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Film</Label>
                      <select
                        className={selectClass}
                        value={showForm.movie}
                        onChange={(e) =>
                          setShowForm({ ...showForm, movie: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {movies
                          .filter((m) => m.isActive)
                          .map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Hall</Label>
                      <select
                        className={selectClass}
                        value={showForm.hall}
                        onChange={(e) =>
                          setShowForm({ ...showForm, hall: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {halls
                          .filter((h) => h.isActive)
                          .map((h) => (
                            <option key={h._id} value={h._id}>
                              {h.name} ({h.capacity} seats)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Starts at</Label>
                      <Input
                        type="datetime-local"
                        value={showForm.startsAt}
                        onChange={(e) =>
                          setShowForm({ ...showForm, startsAt: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Ticket types — prices are set per screening, so a matinee
                      can differ from a premiere
                    </Label>
                    {assignedSeating && (
                      <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {selectedHall?.name} has a seat map, so you set one price per
                        seat category. How many of each there are comes from the map.
                      </p>
                    )}
                    {tiers.map((tier, i) => (
                      <div
                        key={i}
                        className={`grid gap-2 ${
                          assignedSeating
                            ? "sm:grid-cols-[1fr_1fr]"
                            : "sm:grid-cols-[1fr_1fr_1fr_auto]"
                        }`}
                      >
                        <Input
                          placeholder="Name (Regular, VIP, Student…)"
                          value={tier.name}
                          // Locked on an assigned-seating hall: the name comes
                          // from the seat category it prices, and letting them
                          // drift would put one label on the map and another on
                          // the ticket.
                          readOnly={assignedSeating}
                          onChange={(e) => {
                            const next = [...tiers];
                            next[i] = { ...tier, name: e.target.value };
                            setTiers(next);
                          }}
                        />
                        <Input
                          type="number"
                          placeholder="Price (ETB)"
                          value={tier.price}
                          onChange={(e) => {
                            const next = [...tiers];
                            next[i] = { ...tier, price: e.target.value };
                            setTiers(next);
                          }}
                        />
                        {!assignedSeating && (
                          <>
                            <Input
                              type="number"
                              placeholder="Seats"
                              value={tier.allocation}
                              onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...tier, allocation: e.target.value };
                                setTiers(next);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={tiers.length === 1}
                              onClick={() => setTiers(tiers.filter((_, x) => x !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                    {!assignedSeating && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setTiers([...tiers, { name: "", price: "", allocation: "" }])
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={addShowtime}
                      disabled={
                        busy || !showForm.movie || !showForm.hall || !showForm.startsAt
                      }
                    >
                      {editingShowtimeId ? "Save changes" : "Schedule screening"}
                    </Button>
                    {editingShowtimeId && (
                      <Button variant="ghost" onClick={cancelEditShowtime} disabled={busy}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {showtimes.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No screenings scheduled yet.
              </p>
            )}
            {showtimes.map((s) => (
              <Card
                key={s._id}
                className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {s.movie?.title}
                      {s.status !== "scheduled" && (
                        <Badge variant="secondary" className="ml-2">
                          {s.status}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(s.startsAt).toLocaleString()} · {s.hall?.name} ·{" "}
                      {s.seatsSold ?? 0}/{s.seatsAllocated ?? 0} seats
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                      {s.ticketTypes.map((t) => (
                        <span
                          key={t._id}
                          className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800"
                        >
                          {t.name} {money(t.price)} · {t.sold}/{t.allocation}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Correct this screening"
                      onClick={() => beginEditShowtime(s)}
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelShowtime(s._id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Films ----------------------------------------------------------- */}
        <TabsContent value="movies" className="space-y-6">
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                {/* An operator who clicked Edit is scrolled up to a pre-filled
                    form; the heading is what tells them why it is pre-filled. */}
                {editingMovieId ? "Edit film" : "Add a film"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input
                  placeholder="Title"
                  value={movieForm.title}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, title: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Runtime (min)"
                  value={movieForm.durationMinutes}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, durationMinutes: e.target.value })
                  }
                />
                <Input
                  placeholder="Age rating"
                  value={movieForm.ageRating}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, ageRating: e.target.value })
                  }
                />
                <Input
                  placeholder="Language"
                  value={movieForm.language}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, language: e.target.value })
                  }
                />
                <Input
                  placeholder="Subtitles"
                  value={movieForm.subtitles}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, subtitles: e.target.value })
                  }
                />
                <Input
                  placeholder="Genre (comma separated)"
                  value={movieForm.genre}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, genre: e.target.value })
                  }
                />
                <div>
                  <Label className="text-xs">Release date</Label>
                  <Input
                    type="date"
                    value={movieForm.releaseDate}
                    onChange={(e) =>
                      setMovieForm({ ...movieForm, releaseDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    className={selectClass}
                    value={movieForm.status}
                    onChange={(e) =>
                      setMovieForm({ ...movieForm, status: e.target.value })
                    }
                  >
                    <option value="now_showing">Now showing</option>
                    <option value="coming_soon">Coming soon</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <Input
                placeholder="Trailer URL"
                value={movieForm.trailerUrl}
                onChange={(e) =>
                  setMovieForm({ ...movieForm, trailerUrl: e.target.value })
                }
              />
              <Textarea
                rows={2}
                placeholder="Description"
                value={movieForm.description}
                onChange={(e) =>
                  setMovieForm({ ...movieForm, description: e.target.value })
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Poster (portrait, 2:3)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPoster(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Cover (landscape banner)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCover(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Runtime is used to warn you when two screenings would overlap in
                the same hall — set it, or conflicts cannot be checked.
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={addMovie} disabled={busy || !movieForm.title}>
                  {editingMovieId ? "Save changes" : "Add film"}
                </Button>
                {editingMovieId && (
                  <Button variant="ghost" onClick={cancelEditMovie} disabled={busy}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {movies.map((m) => (
              <Card
                key={m._id}
                className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {m.title}{" "}
                      {!m.isActive && <Badge variant="secondary">retired</Badge>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[
                        m.status === "coming_soon" ? "Coming soon" : null,
                        m.durationMinutes ? `${m.durationMinutes} min` : null,
                        m.ageRating,
                        m.language,
                        `${m.showtimeCount ?? 0} screenings`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit this film"
                      onClick={() => beginEditMovie(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeMovie(m._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Halls ----------------------------------------------------------- */}
        <TabsContent value="halls" className="space-y-6">
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <DoorOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Add a hall
              </h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input
                  placeholder="Name (Screen 1)"
                  value={hallForm.name}
                  onChange={(e) => setHallForm({ ...hallForm, name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Capacity"
                  value={hallForm.capacity}
                  onChange={(e) =>
                    setHallForm({ ...hallForm, capacity: e.target.value })
                  }
                />
                <Input
                  placeholder="Screen type (3D, IMAX…)"
                  value={hallForm.screenType}
                  onChange={(e) =>
                    setHallForm({ ...hallForm, screenType: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Turnaround (min)"
                  value={hallForm.turnaroundMinutes}
                  onChange={(e) =>
                    setHallForm({ ...hallForm, turnaroundMinutes: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Turnaround is the gap needed to empty and clean the room between
                screenings. Leave blank to use the cinema default; scheduling
                will refuse a film that starts inside it.
              </p>
              <Button
                onClick={addHall}
                disabled={busy || !hallForm.name || !hallForm.capacity}
              >
                Add hall
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {halls.map((h) => (
              <Card
                key={h._id}
                className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {h.name} {!h.isActive && <Badge variant="secondary">off</Badge>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {h.capacity} seats{h.screenType ? ` · ${h.screenType}` : ""}
                        {h.turnaroundMinutes !== null
                          ? ` · ${h.turnaroundMinutes} min turnaround`
                          : " · default turnaround"}
                      </p>
                      {h.hasAssignedSeating ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(h.seatCategories || []).map((c) => (
                            <span
                              key={c.key}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: c.color || "#6366f1" }}
                              />
                              {c.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                          Sells by capacity — no seat map yet
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openHallEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeHall(h._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditingSeatMap(h)}
                  >
                    <LayoutGrid className="mr-1 h-3 w-3" />
                    {h.hasAssignedSeating ? "Edit seat map" : "Set up seats"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingHall} onOpenChange={(open) => !open && setEditingHall(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingHall?.name}</DialogTitle>
            <DialogDescription>
              The seat map is untouched by this — renaming or resizing the room never
              disturbs a ticket already sold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={hallEditForm.name}
                onChange={(e) => setHallEditForm({ ...hallEditForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Capacity</Label>
                <Input
                  type="number"
                  value={hallEditForm.capacity}
                  disabled={editingHall?.hasAssignedSeating}
                  onChange={(e) =>
                    setHallEditForm({ ...hallEditForm, capacity: e.target.value })
                  }
                />
                {editingHall?.hasAssignedSeating && (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Set by the seat map — edit seats to change it.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Screen type</Label>
                <Input
                  value={hallEditForm.screenType}
                  onChange={(e) =>
                    setHallEditForm({ ...hallEditForm, screenType: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Turnaround (min) — blank uses the cinema default</Label>
              <Input
                type="number"
                value={hallEditForm.turnaroundMinutes}
                onChange={(e) =>
                  setHallEditForm({ ...hallEditForm, turnaroundMinutes: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Active</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Off stops it being scheduled. Screenings already booked are unaffected.
                </p>
              </div>
              <Switch
                checked={hallEditForm.isActive}
                onCheckedChange={(v) => setHallEditForm({ ...hallEditForm, isActive: v })}
              />
            </div>
            <Button
              className="w-full"
              onClick={saveHallDetails}
              disabled={busy || !hallEditForm.name.trim() || !hallEditForm.capacity}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingSeatMap}
        onOpenChange={(open) => !open && setEditingSeatMap(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeatMap?.name} — seat map</DialogTitle>
            <DialogDescription>
              Remove a seat to make an aisle, block one to keep it out of sale, and give
              each seat a category. A showtime prices the categories, so a VIP seat
              charges the VIP price.
            </DialogDescription>
          </DialogHeader>
          {editingSeatMap && (
            <SeatMapEditor
              // Keyed by hall so opening a different one starts from ITS map
              // rather than from the last hall's state.
              key={editingSeatMap._id}
              initialCategories={editingSeatMap.seatCategories}
              initialRows={editingSeatMap.seatMap?.rows}
              saving={busy}
              onSave={(payload) => saveSeatMap(editingSeatMap._id, payload)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * An ISO timestamp as `datetime-local` wants it: local time, no zone.
 *
 * `iso.slice(0, 16)` is the obvious version and is wrong — it hands the input a
 * UTC wall-clock, so a 19:30 screening in Addis (UTC+3) loads as 16:30 and is
 * saved back three hours early. The whole point of an edit form is fixing
 * mistakes, not introducing one.
 */
const toLocalDateTimeInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CinemaProgrammePage() {
  return (
    <CinemaGate>
      {(cinema, token) => <ProgrammeContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
