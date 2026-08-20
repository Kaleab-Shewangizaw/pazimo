"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Film,
  Search,
  Star,
  TrendingUp,
  Images,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  EyeOff,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type PublicationStatus = "pending" | "published" | "rejected";

interface AdminMovie {
  _id: string;
  title: string;
  poster?: string | null;
  coverImage?: string | null;
  durationMinutes?: number;
  ageRating?: string;
  status: "coming_soon" | "now_showing" | "archived";
  isActive: boolean;
  bannerStatus: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  featuredOrder: number;
  upcomingShowtimes: number;
  publicationStatus: PublicationStatus;
  publicationNote?: string | null;
  publishedAt?: string | null;
  cinema?: { _id: string; name: string; city?: string; isActive: boolean };
}

type Slot = "bannerStatus" | "isFeatured" | "isTrending";

const PUBLICATION_BADGE: Record<
  PublicationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Awaiting review",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  published: {
    label: "Live",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  },
};

const SLOTS: { key: Slot; label: string; icon: typeof Star; hint: string }[] = [
  { key: "bannerStatus", label: "Banner", icon: Images, hint: "Hero carousel at the top of the cinema page" },
  { key: "isFeatured", label: "Featured", icon: Star, hint: "The 'Don't miss out' row" },
  { key: "isTrending", label: "Trending", icon: TrendingUp, hint: "The trending strip" },
];

export default function AdminMovieCuration() {
  const { token } = useAdminAuthStore();
  const [movies, setMovies] = useState<AdminMovie[]>([]);
  const [slots, setSlots] = useState({ banner: 0, featured: 0, trending: 0 });
  const [publication, setPublication] = useState({ pending: 0, published: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  // Opens on the review queue rather than on everything: the backlog is the
  // thing an admin comes to this screen to clear, so it should not have to be
  // gone looking for.
  const [publicationFilter, setPublicationFilter] = useState<PublicationStatus | "">("pending");
  const [rejecting, setRejecting] = useState<AdminMovie | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  // Per-movie in-flight guard, so toggling one card does not disable the rest.
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "48" });
      if (search) params.set("search", search);
      if (slotFilter) params.set("slot", slotFilter);
      if (publicationFilter) params.set("publication", publicationFilter);

      const res = await fetch(`${API_URL}/api/cinemas/admin/movies?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load movies");
      setMovies(data.data || []);
      setSlots(data.slots || { banner: 0, featured: 0, trending: 0 });
      setPublication(data.publication || { pending: 0, published: 0, rejected: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load movies");
    } finally {
      setLoading(false);
    }
  }, [token, search, slotFilter, publicationFilter]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const decide = async (
    movie: AdminMovie,
    publicationStatus: PublicationStatus,
    note?: string
  ) => {
    if (!token) return;
    setSaving(movie._id);
    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/admin/movies/${movie._id}/publication`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ publicationStatus, note }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Could not save");

      toast.success(
        publicationStatus === "published"
          ? `"${movie.title}" is live`
          : publicationStatus === "rejected"
            ? `"${movie.title}" rejected`
            : `"${movie.title}" returned to the queue`
      );
      // Reloaded rather than patched in place: publishing can change a film's
      // display slots and moves it between filtered views, so the server's
      // answer is the only reliable one.
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const toggle = async (movie: AdminMovie, slot: Slot) => {
    setSaving(movie._id);
    // Optimistic: the toggle is the whole interaction, so waiting a round trip
    // to redraw makes curating a dozen films feel broken. Rolled back below if
    // the write fails.
    const previous = movie[slot];
    setMovies((list) =>
      list.map((m) => (m._id === movie._id ? { ...m, [slot]: !previous } : m))
    );

    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/admin/movies/${movie._id}/display`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ [slot]: !previous }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update");

      setSlots((s) => {
        const key = slot === "bannerStatus" ? "banner" : slot === "isFeatured" ? "featured" : "trending";
        return { ...s, [key]: s[key as keyof typeof s] + (previous ? -1 : 1) };
      });
    } catch (e) {
      setMovies((list) =>
        list.map((m) => (m._id === movie._id ? { ...m, [slot]: previous } : m))
      );
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Slot occupancy — what is actually on the public page right now. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SLOTS.map(({ key, label, icon: Icon, hint }) => {
          const count =
            key === "bannerStatus" ? slots.banner : key === "isFeatured" ? slots.featured : slots.trending;
          return (
            <Card key={key} className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Review queue first: publication decides whether customers can see or
          buy a film at all, so it outranks which promo row it sits in. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 pb-3 dark:border-gray-800">
        {(
          [
            ["pending", "Awaiting review", publication.pending],
            ["published", "Live", publication.published],
            ["rejected", "Rejected", publication.rejected],
            ["", "All films", null],
          ] as [PublicationStatus | "", string, number | null][]
        ).map(([value, label, count]) => (
          <Button
            key={label}
            variant={publicationFilter === value ? "default" : "ghost"}
            size="sm"
            onClick={() => setPublicationFilter(value)}
          >
            {label}
            {count !== null && count > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  value === "pending"
                    ? "bg-amber-500 text-white"
                    : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {count}
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search films…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={slotFilter === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setSlotFilter("")}
          >
            All
          </Button>
          {[
            ["banner", "Bannered"],
            ["featured", "Featured"],
            ["trending", "Trending"],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={slotFilter === value ? "default" : "outline"}
              size="sm"
              onClick={() => setSlotFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <Card className="border border-dashed border-gray-300 dark:border-gray-700">
          <CardContent className="py-16 text-center">
            <Film className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {publicationFilter === "pending" && !search && !slotFilter
                ? "Nothing waiting for review. Every film has been decided on."
                : search || slotFilter || publicationFilter
                  ? "No films match that filter."
                  : "No films have been posted by any cinema yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {movies.map((movie) => (
            <Card
              key={movie._id}
              className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
            >
              <CardContent className="flex gap-3 p-4">
                <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                  {movie.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}${movie.poster}`}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-6 w-6 text-gray-300 dark:text-gray-700" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
                      {movie.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${PUBLICATION_BADGE[movie.publicationStatus]?.className ?? ""}`}
                    >
                      {PUBLICATION_BADGE[movie.publicationStatus]?.label ?? movie.publicationStatus}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {movie.cinema?.name}
                    {movie.cinema?.city ? ` · ${movie.cinema.city}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {[
                      movie.durationMinutes ? `${movie.durationMinutes} min` : null,
                      movie.ageRating,
                      movie.status === "coming_soon" ? "Coming soon" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {/* Promoting a film with nothing scheduled puts a dead card on
                      the front page — worth saying before it happens, not after. */}
                  {movie.upcomingShowtimes === 0 ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      No upcoming screenings
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {movie.upcomingShowtimes} upcoming
                    </p>
                  )}

                  {!movie.cinema?.isActive && (
                    <Badge variant="secondary" className="mt-1">
                      cinema suspended
                    </Badge>
                  )}

                  {/* Why it was rejected, or why it came back to the queue —
                      shown so the next reviewer picks up the thread. */}
                  {movie.publicationStatus !== "published" && movie.publicationNote && (
                    <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                      {movie.publicationNote}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {movie.publicationStatus !== "published" ? (
                      <Button
                        size="sm"
                        disabled={saving === movie._id}
                        onClick={() => decide(movie, "published")}
                        className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Publish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving === movie._id}
                        onClick={() => decide(movie, "pending", "Taken down for another look.")}
                        className="h-7 px-2 text-xs"
                        title="Take it off the public site and return it to the queue"
                      >
                        <EyeOff className="mr-1 h-3 w-3" />
                        Unpublish
                      </Button>
                    )}
                    {movie.publicationStatus !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving === movie._id}
                        onClick={() => {
                          setRejectNote("");
                          setRejecting(movie);
                        }}
                        className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    )}
                  </div>

                  {/* Slots are shared shelf space on the public page, and the
                      public rows filter on publication — so an unpublished film
                      cannot hold one. The server refuses it too; disabling here
                      just means the admin is not invited to try. */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {SLOTS.map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={movie[key] ? "default" : "outline"}
                        disabled={
                          saving === movie._id || movie.publicationStatus !== "published"
                        }
                        onClick={() => toggle(movie, key)}
                        className="h-7 px-2 text-xs"
                        title={
                          movie.publicationStatus !== "published"
                            ? "Publish this film before giving it a slot"
                            : movie[key]
                              ? `Remove from ${label}`
                              : `Add to ${label}`
                        }
                      >
                        <Icon className="mr-1 h-3 w-3" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rejection needs a reason. The server requires it too — a rejection with
          no note tells the cinema it failed but not what to change, so it is
          required at exactly the moment it matters rather than left optional. */}
      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject &ldquo;{rejecting?.title}&rdquo;?</DialogTitle>
            <DialogDescription>
              The cinema keeps the film and its showtimes and can edit and resubmit.
              Nothing is deleted. Tell them what needs to change.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            maxLength={500}
            placeholder="e.g. The poster is low resolution, and the synopsis is missing."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={!rejectNote.trim() || saving === rejecting?._id}
              onClick={async () => {
                const movie = rejecting;
                if (!movie) return;
                setRejecting(null);
                await decide(movie, "rejected", rejectNote.trim());
              }}
            >
              Reject film
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
