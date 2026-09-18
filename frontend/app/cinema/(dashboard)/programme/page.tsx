"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  cinemaRequest,
  fetchHalls,
  fetchMovies,
  importMovieFromImdb,
  setMovieBanner,
  type CinemaHall,
  type CinemaMovie,
  type CinemaProfile,
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
import {
  Trash2,
  Film,
  DoorOpen,
  LayoutGrid,
  Pencil,
  Link2,
  Loader2,
  Plus,
  Images,
  ChevronsUpDown,
} from "lucide-react";
import SeatMapEditor from "@/components/cinema/seat-map-editor";
import { ageRatingLabel } from "@/components/cinemas/cinema-format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

// Fixed lists, not free text, so a cinema can't list a film under "Amaharic"
// or "Sci Fi" and have it silently fail to match anywhere else that filters
// on these fields. Whatever isn't in the list yet, add here rather than
// letting the form drift back to typed text.
const CINEMA_LANGUAGES = [
  "English",
  "Amharic",
  "Oromo",
  "Tigrinya",
  "Somali",
  "Arabic",
  "French",
  "Hindi",
];

const CINEMA_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

function ProgrammeContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [halls, setHalls] = useState<CinemaHall[]>([]);
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [h, m] = await Promise.all([fetchHalls(token), fetchMovies(token)]);
    setHalls(h);
    setMovies(m);
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
    cast: "",
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
  // Whether the add/edit form is open. Its own flag rather than deriving from
  // editingMovieId, so "Add movie" (editingMovieId null) can open it too.
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);

  // The organizer's alternative to typing the synopsis and cast by hand: paste
  // the film's IMDb link, fetch, and review/edit whatever came back before
  // saving. This never submits on its own — it only fills the fields above.
  const [imdbUrl, setImdbUrl] = useState("");
  const [importingImdb, setImportingImdb] = useState(false);

  const importFromImdb = async () => {
    if (!imdbUrl.trim()) return;
    setImportingImdb(true);
    try {
      const data = await importMovieFromImdb(token, imdbUrl.trim());
      setMovieForm({
        ...movieForm,
        title: data.title || movieForm.title,
        description: data.description || movieForm.description,
        cast: data.cast.length ? data.cast.join(", ") : movieForm.cast,
        genre: data.genre.length ? data.genre.join(", ") : movieForm.genre,
        durationMinutes: data.durationMinutes
          ? String(data.durationMinutes)
          : movieForm.durationMinutes,
        ageRating: data.ageRating || movieForm.ageRating,
        language: data.language || movieForm.language,
        releaseDate: data.releaseDate
          ? String(data.releaseDate).slice(0, 10)
          : movieForm.releaseDate,
      });
      toast.success("Pulled in from IMDb — check it over before saving");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportingImdb(false);
    }
  };

  const beginAddMovie = () => {
    setEditingMovieId(null);
    setMovieForm(EMPTY_MOVIE_FORM);
    setPoster(null);
    setCover(null);
    setImdbUrl("");
    setMovieDialogOpen(true);
  };

  const beginEditMovie = (movie: CinemaMovie) => {
    setEditingMovieId(movie._id);
    setMovieForm({
      title: movie.title || "",
      durationMinutes: movie.durationMinutes ? String(movie.durationMinutes) : "",
      ageRating: movie.ageRating || "",
      language: movie.language || "",
      subtitles: movie.subtitles || "",
      genre: (movie.genre || []).join(", "),
      cast: (movie.cast || []).join(", "),
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
    setImdbUrl("");
    setMovieDialogOpen(true);
  };

  const cancelEditMovie = () => {
    setMovieDialogOpen(false);
    setEditingMovieId(null);
    setMovieForm(EMPTY_MOVIE_FORM);
    setPoster(null);
    setCover(null);
    setImdbUrl("");
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
      setMovieDialogOpen(false);
      setEditingMovieId(null);
      setMovieForm(EMPTY_MOVIE_FORM);
      setPoster(null);
      setCover(null);
      setImdbUrl("");
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

  // Per-film in-flight guard, so bannering one card does not disable the rest.
  const [togglingBanner, setTogglingBanner] = useState<string | null>(null);

  const toggleBanner = async (movie: CinemaMovie) => {
    setTogglingBanner(movie._id);
    // Optimistic, rolled back below if the write fails — same pattern the
    // admin curation screen uses for its own slot toggles.
    const next = !movie.bannerStatus;
    setMovies((list) =>
      list.map((m) => (m._id === movie._id ? { ...m, bannerStatus: next } : m))
    );
    try {
      await setMovieBanner(token, movie._id, next);
    } catch (e) {
      setMovies((list) =>
        list.map((m) => (m._id === movie._id ? { ...m, bannerStatus: !next } : m))
      );
      toast.error((e as Error).message);
    } finally {
      setTogglingBanner(null);
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

  // A film already saved under a language outside the fixed list (typed
  // before this dropdown existed, or pulled in from IMDb) keeps showing its
  // real value instead of the dropdown silently swapping it for the first
  // option.
  const languageOptions =
    movieForm.language && !CINEMA_LANGUAGES.includes(movieForm.language)
      ? [movieForm.language, ...CINEMA_LANGUAGES]
      : CINEMA_LANGUAGES;

  // Subtitles are a language too — same list, same "keep whatever's already
  // there" safety net.
  const subtitleOptions =
    movieForm.subtitles && !CINEMA_LANGUAGES.includes(movieForm.subtitles)
      ? [movieForm.subtitles, ...CINEMA_LANGUAGES]
      : CINEMA_LANGUAGES;

  const selectedGenres = movieForm.genre
    ? movieForm.genre.split(",").map((g) => g.trim()).filter(Boolean)
    : [];
  const genreOptions = Array.from(new Set([...CINEMA_GENRES, ...selectedGenres]));
  const toggleGenre = (genre: string) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];
    setMovieForm({ ...movieForm, genre: next.join(", ") });
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Program
      </h1>

      <Tabs defaultValue="movies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 dark:bg-gray-900/70 sm:w-[280px]">
          <TabsTrigger value="movies">Films</TabsTrigger>
          <TabsTrigger value="halls">Halls</TabsTrigger>
        </TabsList>

        {/* Films ----------------------------------------------------------- */}
        <TabsContent value="movies" className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Films ({movies.length})
            </h2>
            <Button size="sm" onClick={beginAddMovie}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Movie
            </Button>
          </div>

          {movies.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No films yet. Add one to start scheduling screenings.
            </p>
          ) : (
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
                          m.ageRating ? `Age rating: ${ageRatingLabel(m.ageRating)}` : null,
                          m.language,
                          `${m.showtimeCount ?? 0} screenings`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant={m.bannerStatus ? "default" : "ghost"}
                        size="sm"
                        disabled={
                          togglingBanner === m._id || m.publicationStatus !== "published"
                        }
                        onClick={() => toggleBanner(m)}
                        title={
                          m.publicationStatus !== "published"
                            ? "This film needs to be approved before it can go on your banner"
                            : m.bannerStatus
                              ? "Remove from your banner"
                              : "Add to your banner"
                        }
                      >
                        <Images className="h-4 w-4" />
                      </Button>
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
          )}
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

      <Dialog open={movieDialogOpen} onOpenChange={(open) => !open && cancelEditMovie()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMovieId ? "Edit film" : "Add a film"}</DialogTitle>
            <DialogDescription>
              {editingMovieId
                ? "Changing a listing detail sends this film back to the admin for review."
                : "Runtime is used to warn you when two screenings would overlap in the same hall — set it, or conflicts cannot be checked."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* The shortcut: paste the film's IMDb link and pull in its
                synopsis, cast, genre, runtime and rating instead of typing
                them out. Nothing here is saved until "Add film"/"Save
                changes" below is pressed — this only fills the form. */}
            {/* <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-900/40 sm:flex-row sm:items-center">
              <Link2 className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" />
              <Input
                placeholder="Paste an IMDb link (e.g. imdb.com/title/tt1234567) to fill this in"
                value={imdbUrl}
                onChange={(e) => setImdbUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    importFromImdb();
                  }
                }}
                className="flex-1 bg-white dark:bg-gray-950"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={importFromImdb}
                disabled={importingImdb || !imdbUrl.trim()}
                className="shrink-0"
              >
                {importingImdb ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Fetching…
                  </>
                ) : (
                  "Fetch from IMDb"
                )}
              </Button>
            </div>
            <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
              Or just fill in the fields below yourself — the link is optional.
            </p> */}

            <div className="grid gap-3 sm:grid-cols-2">
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
              <div>
                <Label className="text-xs">Age rating</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 13"
                  value={movieForm.ageRating}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, ageRating: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Recommended for viewers this age and above
                </p>
              </div>
              <div>
                <Label className="text-xs">Language</Label>
                <select
                  className={selectClass}
                  value={movieForm.language}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, language: e.target.value })
                  }
                >
                  <option value="">Select language</option>
                  {languageOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Subtitles</Label>
                <select
                  className={selectClass}
                  value={movieForm.subtitles}
                  onChange={(e) =>
                    setMovieForm({ ...movieForm, subtitles: e.target.value })
                  }
                >
                  <option value="">No subtitles</option>
                  {subtitleOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Genre</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="h-9 w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {selectedGenres.length
                          ? selectedGenres.join(", ")
                          : "Select genre(s)"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {genreOptions.map((genre) => (
                            <CommandItem
                              key={genre}
                              value={genre}
                              onSelect={() => toggleGenre(genre)}
                            >
                              <Checkbox
                                checked={selectedGenres.includes(genre)}
                                className="mr-2"
                              />
                              {genre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                placeholder="Cast (comma separated)"
                value={movieForm.cast}
                onChange={(e) =>
                  setMovieForm({ ...movieForm, cast: e.target.value })
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

            <div className="flex items-center gap-2">
              <Button onClick={addMovie} disabled={busy || !movieForm.title}>
                {editingMovieId ? "Save changes" : "Add film"}
              </Button>
              <Button variant="ghost" onClick={cancelEditMovie} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

export default function CinemaProgrammePage() {
  return (
    <CinemaGate>
      {(cinema, token) => <ProgrammeContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
