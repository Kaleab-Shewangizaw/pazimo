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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Film, CalendarDays, DoorOpen } from "lucide-react";

interface Tier {
  name: string;
  price: string;
  allocation: string;
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
  const [hallForm, setHallForm] = useState({ name: "", capacity: "", screenType: "" });

  const addHall = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/halls", token, {
        method: "POST",
        body: JSON.stringify({
          name: hallForm.name,
          capacity: Number(hallForm.capacity),
          screenType: hallForm.screenType || undefined,
        }),
      });
      toast.success("Hall added");
      setHallForm({ name: "", capacity: "", screenType: "" });
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
  const [movieForm, setMovieForm] = useState({
    title: "",
    durationMinutes: "",
    ageRating: "",
    language: "",
  });

  const addMovie = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/movies", token, {
        method: "POST",
        body: JSON.stringify({
          title: movieForm.title,
          durationMinutes: movieForm.durationMinutes
            ? Number(movieForm.durationMinutes)
            : undefined,
          ageRating: movieForm.ageRating || undefined,
          language: movieForm.language || undefined,
        }),
      });
      toast.success("Film added");
      setMovieForm({ title: "", durationMinutes: "", ageRating: "", language: "" });
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

  const addShowtime = async () => {
    setBusy(true);
    try {
      await cinemaRequest("/api/cinemas/me/showtimes", token, {
        method: "POST",
        body: JSON.stringify({
          movie: showForm.movie,
          hall: showForm.hall,
          startsAt: showForm.startsAt,
          ticketTypes: tiers.map((t) => ({
            name: t.name,
            price: Number(t.price),
            allocation: Number(t.allocation),
          })),
        }),
      });
      toast.success("Screening scheduled");
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
                Schedule a screening
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
                    {tiers.map((tier, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <Input
                          placeholder="Name (Regular, VIP, Student…)"
                          value={tier.name}
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
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTiers([...tiers, { name: "", price: "", allocation: "" }])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
                    </Button>
                  </div>

                  <Button
                    onClick={addShowtime}
                    disabled={
                      busy || !showForm.movie || !showForm.hall || !showForm.startsAt
                    }
                  >
                    Schedule screening
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelShowtime(s._id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
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
                Add a film
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
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Runtime is used to warn you when two screenings would overlap in
                the same hall.
              </p>
              <Button onClick={addMovie} disabled={busy || !movieForm.title}>
                Add film
              </Button>
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
                        m.durationMinutes ? `${m.durationMinutes} min` : null,
                        m.ageRating,
                        m.language,
                        `${m.showtimeCount ?? 0} screenings`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeMovie(m._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
              <div className="grid gap-3 sm:grid-cols-3">
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
              </div>
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
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {h.name} {!h.isActive && <Badge variant="secondary">off</Badge>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {h.capacity} seats{h.screenType ? ` · ${h.screenType}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeHall(h._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CinemaProgrammePage() {
  return (
    <CinemaGate>
      {(cinema, token) => <ProgrammeContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
