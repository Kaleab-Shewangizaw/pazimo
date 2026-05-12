"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Calendar,
  ClipboardList,
  MessageSquare,
  ArrowUpRight,
  Copy,
  Trash2,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function RSVPDashboard() {
  const router = useRouter();
  const events = useStore((s) => s.events);
  const responses = useStore((s) => s.responses);
  const loadEvents = useStore((s) => s.loadEvents);
  const createEvent = useStore((s) => s.createEvent);
  const duplicateEvent = useStore((s) => s.duplicateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"rsvp" | "review">("rsvp");

  useEffect(() => {
    void loadEvents().catch(() => toast.error("Failed to load RSVP forms"));
  }, [loadEvents]);

  const stats = useMemo(() => {
    const totalRsvp = events
      .filter((event) => event.type === "rsvp")
      .reduce((sum, event) => sum + (event.responseCount || 0), 0);
    const totalReviews = events
      .filter((event) => event.type === "review")
      .reduce((sum, event) => sum + (event.responseCount || 0), 0);
    return { totalEvents: events.length, totalRsvp, totalReviews };
  }, [events, responses]);

  const onCreate = async () => {
    const id = await createEvent(type, name.trim());
    setOpen(false);
    setName("");
    router.push(`/organizer/rsvp-builder/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Welcome back</p>
            <h1 className="mt-1 font-display text-4xl md:text-5xl font-medium tracking-tight">
              Your RSVP Events
            </h1>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="mr-1 h-4 w-4" /> New event
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { label: "Events", value: stats.totalEvents, icon: Calendar },
            { label: "RSVPs collected", value: stats.totalRsvp, icon: Users },
            { label: "Reviews collected", value: stats.totalReviews, icon: BarChart3 },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.1 }}
            >
              <Card className="rounded-2xl p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {s.label}
                    </p>
                    <p className="mt-2 text-4xl font-semibold text-slate-900 dark:text-white">
                      {s.value}
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Event grid */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {events.map((e, i) => {
              const count = e.responseCount ?? responses.filter((r) => r.eventId === e.id).length;
              const Icon = e.type === "rsvp" ? ClipboardList : MessageSquare;
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="group rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-lg border border-slate-200 dark:border-slate-700 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full ${
                          e.type === "rsvp"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                        }`}
                      >
                        {e.type === "rsvp" ? "RSVP" : "Review"}
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {e.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                      {e.description || "No description"}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{e.questions.length} questions</span>
                      <span>{count} responses</span>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="rounded-full"
                        variant="default"
                      >
                        <Link href={`/organizer/rsvp-builder/${e.id}`}>Edit</Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                        className="rounded-full"
                      >
                        <Link href={`/organizer/rsvp-builder/${e.id}/analytics`}>
                          Analytics <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                      {e.type === "rsvp" && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                        >
                          <Link href={`/organizer/rsvp-builder/${e.id}/messages`}>
                            Messages
                          </Link>
                        </Button>
                      )}
                      <div className="ml-auto flex">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            void duplicateEvent(e.id);
                            toast.success("Duplicated");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-red-600 hover:text-red-600 dark:text-red-400"
                          onClick={() => {
                            void deleteEvent(e.id);
                            toast.success("Deleted");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {events.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 text-center"
          >
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No events yet. Create your first RSVP form to get started.
            </p>
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="rounded-full"
            >
              <Plus className="mr-1 h-4 w-4" /> Create Event
            </Button>
          </motion.div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              Create a new event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-white">
                Event name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Rooftop Mixer"
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-white">
                Template type
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      id: "rsvp" as const,
                      title: "RSVP Registration",
                      desc: "Pre-event sign-ups",
                      icon: ClipboardList,
                    },
                    {
                      id: "review" as const,
                      title: "Event Review",
                      desc: "Post-event feedback",
                      icon: MessageSquare,
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      type === t.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <t.icon
                      className={`h-5 w-5 ${
                        type === t.id
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    />
                    <div className="mt-2 font-medium text-sm text-slate-900 dark:text-white">
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              Create event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
