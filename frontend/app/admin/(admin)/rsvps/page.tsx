"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Ban as BanIcon,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Flame,
  Info,
  LayoutDashboard,
  Link as LinkIcon,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { IoMdCloseCircle } from "react-icons/io";
import { toast } from "sonner";
import { useStore } from "@/lib/rsvp-store";
import type { RsvpEvent } from "@/lib/rsvp-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS = ["All", "draft", "published", "cancelled", "hidden", "archived", "review", "closed"] as const;
const TYPE_OPTIONS = ["All", "rsvp", "review"] as const;
const VISIBILITY_OPTIONS = ["All", "Visible", "Hidden"] as const;
const FLAG_OPTIONS = ["All", "Featured", "Trending", "Banner"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];
type TypeFilter = (typeof TYPE_OPTIONS)[number];
type VisibilityFilter = (typeof VISIBILITY_OPTIONS)[number];
type FlagFilter = (typeof FLAG_OPTIONS)[number];

const statusTone: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  hidden: "bg-amber-100 text-amber-700 border-amber-200",
  archived: "bg-zinc-100 text-zinc-700 border-zinc-200",
  review: "bg-violet-100 text-violet-700 border-violet-200",
  closed: "bg-slate-200 text-slate-800 border-slate-300",
};

const typeTone: Record<"rsvp" | "review", string> = {
  rsvp: "bg-sky-100 text-sky-700 border-sky-200",
  review: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
};

const getStatusLabel = (event: RsvpEvent) => event.status || "draft";

const getPublicLink = (event: RsvpEvent) =>
  `${window.location.origin}/${event.type === "rsvp" ? "rsvp-form" : "review-form"}/${event.publicId || event.id}`;

export default function AdminRsvpPage() {
  const router = useRouter();
  const events = useStore((state) => state.events);
  const responses = useStore((state) => state.responses);
  const loadEvents = useStore((state) => state.loadEvents);
  const createEvent = useStore((state) => state.createEvent);
  const duplicateEvent = useStore((state) => state.duplicateEvent);
  const deleteEvent = useStore((state) => state.deleteEvent);
  const publishEvent = useStore((state) => state.publishEvent);
  const cancelEvent = useStore((state) => state.cancelEvent);
  const archiveEvent = useStore((state) => state.archiveEvent);
  const toggleVisibility = useStore((state) => state.toggleVisibility);
  const toggleFeatured = useStore((state) => state.toggleFeatured);
  const toggleTrending = useStore((state) => state.toggleTrending);
  const toggleBanner = useStore((state) => state.toggleBanner);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"rsvp" | "review">("rsvp");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("All");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RsvpEvent | null>(null);

  useEffect(() => {
    void loadEvents().catch(() => toast.error("Failed to load RSVP forms"));
  }, [loadEvents]);

  const stats = useMemo(() => {
    const published = events.filter((event) => event.status === "published").length;
    const featured = events.filter((event) => event.isFeatured).length;
    const bannered = events.filter((event) => event.bannerStatus).length;
    const totalResponses = events.reduce((sum, event) => sum + (event.responseCount || 0), 0);
    return { total: events.length, published, featured, bannered, totalResponses };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const text = `${event.name} ${event.description || ""} ${event.hostedBy || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase().trim());
      const matchesStatus = statusFilter === "All" || getStatusLabel(event) === statusFilter;
      const matchesType = typeFilter === "All" || event.type === typeFilter;
      const matchesVisibility =
        visibilityFilter === "All" ||
        (visibilityFilter === "Visible" ? event.isPublic !== false : event.isPublic === false);
      const matchesFlag =
        flagFilter === "All" ||
        (flagFilter === "Featured" ? !!event.isFeatured : flagFilter === "Trending" ? !!event.isTrending : !!event.bannerStatus);
      return matchesSearch && matchesStatus && matchesType && matchesVisibility && matchesFlag;
    });
  }, [events, search, statusFilter, typeFilter, visibilityFilter, flagFilter]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredEvents.some((event) => event.id === id)));
  }, [filteredEvents]);

  const openCreateDialog = () => {
    setName("");
    setType("rsvp");
    setIsCreateDialogOpen(true);
  };

  const onCreate = async () => {
    try {
      const id = await createEvent(type, name.trim());
      setIsCreateDialogOpen(false);
      router.push(`/admin/rsvps/${id}`);
    } catch {
      toast.error("Failed to create RSVP form");
    }
  };

  const copyLink = async (event: RsvpEvent) => {
    try {
      await navigator.clipboard.writeText(getPublicLink(event));
      toast.success("Public link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const runRowAction = async (event: RsvpEvent, action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const requestDelete = (event: RsvpEvent) => {
    setDeleteTarget(event);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEvent(deleteTarget.id);
      toast.success("RSVP form deleted");
    } catch {
      toast.error("Failed to archive RSVP form");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const bulkAction = async (handler: (id: string) => Promise<void>, message: string) => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        await handler(id);
      }
      toast.success(message);
      setSelectedIds([]);
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const selectAllVisible = () => {
    if (selectedIds.length === filteredEvents.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredEvents.map((event) => event.id));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.10),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.16),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
      <main className="container mx-auto max-w-[1600px] px-4 py-8 md:px-6 md:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="flex flex-col gap-5 border-b border-slate-200/70 pb-6 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
            <div>
            
              
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="rounded-full" onClick={() => void loadEvents()}>
                Refresh
              </Button>
              <Button onClick={openCreateDialog} className="rounded-full shadow-lg shadow-sky-500/15">
                <Plus className="mr-2 h-4 w-4" /> New form
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Forms", value: stats.total, icon: BookOpen, tone: "bg-sky-100 text-sky-700" },
            { label: "Published", value: stats.published, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
            { label: "Featured", value: stats.featured, icon: Sparkles, tone: "bg-violet-100 text-violet-700" },
            { label: "Bannered", value: stats.bannered, icon: Flame, tone: "bg-amber-100 text-amber-700" },
            { label: "Responses", value: stats.totalResponses, icon: Users, tone: "bg-slate-100 text-slate-700" },
          ].map((item, index) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{item.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 p-4 dark:border-slate-800 md:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-[240px] flex-1 lg:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search forms, hosts, descriptions" className="h-11 rounded-full pl-10" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All statuses" : option}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All types" : option.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={flagFilter}
                onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {FLAG_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800 md:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={selectAllVisible}>
                {selectedIds.length === filteredEvents.length ? "Clear selection" : `Select ${filteredEvents.length} visible`}
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => publishEvent(id), "Selected forms published")} disabled={selectedIds.length === 0}>
                Publish
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => cancelEvent(id), "Selected forms cancelled")} disabled={selectedIds.length === 0}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => toggleVisibility(id), "Selected forms visibility updated")} disabled={selectedIds.length === 0}>
                Toggle visibility
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => toggleFeatured(id), "Selected forms featured toggled")} disabled={selectedIds.length === 0}>
                Toggle featured
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => toggleTrending(id), "Selected forms trending toggled")} disabled={selectedIds.length === 0}>
                Toggle trending
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => toggleBanner(id), "Selected forms banner toggled")} disabled={selectedIds.length === 0}>
                Toggle banner
              </Button>
              <Button variant="destructive" size="sm" className="rounded-full" onClick={() => void bulkAction((id) => deleteEvent(id), "Selected forms deleted")} disabled={selectedIds.length === 0}>
                Delete
              </Button>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200/80 dark:border-slate-800">
                  <TableHead className="w-12 px-5">
                    <input
                      type="checkbox"
                      checked={filteredEvents.length > 0 && selectedIds.length === filteredEvents.length}
                      onChange={selectAllVisible}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                  </TableHead>
                  <TableHead className="px-5">Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="px-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filteredEvents.map((event, index) => {
                    const responseCount = event.responseCount ?? responses.filter((response) => response.eventId === event.id).length;
                    const isSelected = selectedIds.includes(event.id);
                    const status = getStatusLabel(event);

                    return (
                      <TableRow key={event.id} className="border-slate-200/70 dark:border-slate-800" style={{ animationDelay: `${index * 25}ms` }}>
                        <TableCell className="px-5 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(event.id)
                                  ? current.filter((id) => id !== event.id)
                                  : [...current, event.id]
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                          />
                        </TableCell>
                        <TableCell className="max-w-[360px] px-5 align-top">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-slate-950 dark:text-white">{event.name}</p>
                                <Badge variant="outline" className={`rounded-full border ${typeTone[event.type]}`}>{event.type.toUpperCase()}</Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{event.description || "No description provided."}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span>{event.publicId || event.id}</span>
                                <span>•</span>
                                <span>{event.questions.length} questions</span>
                                <span>•</span>
                                <span>{event.sections.length} sections</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={`rounded-full border ${statusTone[status] || statusTone.draft}`}>{status}</Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={`rounded-full border ${event.isPublic === false ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                              {event.isPublic === false ? "Hidden" : "Public"}
                            </Badge>
                            {event.isClosed ? <Badge variant="outline" className="rounded-full border bg-rose-100 text-rose-700 border-rose-200">Closed</Badge> : null}
                          </div>
                        </TableCell>
                        {/* Flags column removed per admin UI update */}
                        <TableCell className="align-top text-slate-600 dark:text-slate-300">{responseCount}</TableCell>
                        <TableCell className="align-top text-slate-600 dark:text-slate-300">
                          {new Date(event.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="px-5 align-top">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => window.open(getPublicLink(event), "_blank")}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-purple-600 hover:text-purple-700"
                              title="Analytics"
                              onClick={() => router.push(`/admin/rsvps/${event.id}/analytics`)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-purple-600 hover:text-purple-700"
                              title="Messages"
                              onClick={() => router.push(`/admin/rsvps/${event.id}/messages`)}
                            >
                              <Megaphone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => router.push(`/admin/rsvps/${event.id}`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-yellow-500 hover:text-yellow-600"
                              onClick={() => void runRowAction(event, () => toggleBanner(event.id, !event.bannerStatus), event.bannerStatus ? "Removed from banner" : "Added to banner")}
                            >
                              <Star className={`h-4 w-4 ${event.bannerStatus ? "fill-current" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-purple-600 hover:text-purple-700"
                              onClick={() => void runRowAction(event, () => toggleFeatured(event.id, !event.isFeatured), event.isFeatured ? "Removed from featured" : "Marked as featured")}
                            >
                              <Sparkles className={`h-4 w-4 ${event.isFeatured ? "fill-current" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700"
                              onClick={() => void runRowAction(event, () => toggleTrending(event.id, !event.isTrending), event.isTrending ? "Removed from trending" : "Marked as trending")}
                            >
                              <Flame className={`h-4 w-4 ${event.isTrending ? "fill-current" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={
                                event.status === "published"
                                  ? "text-gray-600 hover:text-gray-700"
                                  : "text-blue-600 hover:text-blue-700"
                              }
                              onClick={() => void runRowAction(event, status === "published" ? () => publishEvent(event.id) : () => publishEvent(event.id), status === "published" ? "Form unpublished" : "Form published")}
                            >
                              {status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => void runRowAction(event, () => cancelEvent(event.id), event.status !== "cancelled" ? "Form cancelled" : "Form restored")}
                            >
                              {status !== "cancelled" ? <IoMdCloseCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => void runRowAction(event, () => deleteEvent(event.id), "Form deleted")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredEvents.map((event) => {
              const responseCount = event.responseCount ?? responses.filter((response) => response.eventId === event.id).length;
              const status = getStatusLabel(event);
              const checked = selectedIds.includes(event.id);

              return (
                <Card key={event.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.includes(event.id)
                            ? current.filter((id) => id !== event.id)
                            : [...current, event.id]
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-slate-950 dark:text-white">{event.name}</h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.description || "No description provided."}</p>
                        </div>
                        <Badge variant="outline" className={`rounded-full border ${statusTone[status] || statusTone.draft}`}>{status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={`rounded-full border ${typeTone[event.type]}`}>{event.type.toUpperCase()}</Badge>
                        {event.isFeatured ? <Badge variant="outline" className="rounded-full border bg-violet-100 text-violet-700 border-violet-200">Featured</Badge> : null}
                        {event.isTrending ? <Badge variant="outline" className="rounded-full border bg-amber-100 text-amber-700 border-amber-200">Trending</Badge> : null}
                        {event.bannerStatus ? <Badge variant="outline" className="rounded-full border bg-sky-100 text-sky-700 border-sky-200">Banner</Badge> : null}
                        <Badge variant="outline" className={`rounded-full border ${event.isPublic === false ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                          {event.isPublic === false ? "Hidden" : "Public"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <div>{event.questions.length} questions</div>
                        <div>{responseCount} responses</div>
                        <div>{event.viewCount || 0} views</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => router.push(`/admin/rsvps/${event.id}`)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => router.push(`/admin/rsvps/${event.id}/responses`)}>
                          Responses
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copyLink(event)}>
                          Copy link
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="border-t border-slate-200/80 px-6 py-12 text-center dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">No RSVP forms match the current filters.</p>
            </div>
          ) : null}
        </Card>
      </main>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create RSVP form</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="rsvp-form-name">Form name</Label>
              <Input id="rsvp-form-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Conference guest list" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Form type</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "rsvp" as const, title: "RSVP", description: "Attendance capture" },
                  { value: "review" as const, title: "Review", description: "Feedback collection" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`rounded-2xl border p-4 text-left transition-all ${type === option.value ? "border-sky-500 bg-sky-50 shadow-sm dark:bg-sky-950/30" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60"}`}
                  >
                    <div className="font-medium text-slate-950 dark:text-white">{option.title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" className="rounded-full" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void onCreate()} disabled={!name.trim()}>
              Create form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive RSVP form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the form. Responses and analytics remain in the system, but the form will no longer be public.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-rose-600 text-white hover:bg-rose-700" onClick={() => void confirmDelete()}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}