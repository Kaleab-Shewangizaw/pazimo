"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
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
  const { events, isLoading, fetchEvents, deleteEvent } = useEventStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"rsvp" | "review">("rsvp");
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = () => {
      const authState = localStorage.getItem("auth-storage");
      if (!authState) {
        router.push("/organizer/sign-in");
        return;
      }

      try {
        const parsedAuth = JSON.parse(authState);
        if (!parsedAuth?.state?.isAuthenticated) {
          router.push("/organizer/sign-in");
        }
      } catch (error) {
        router.push("/organizer/sign-in");
      }
    };

    checkAuth();
    fetchEvents();
  }, [fetchEvents, router]);

  // Filter RSVP events only
  const rsvpEvents = events.filter((e) => e.type === "rsvp");

  const stats = useMemo(() => {
    const totalRsvp = rsvpEvents.length;
    const totalResponses = rsvpEvents.reduce((sum, event) => {
      return sum + (event.responses?.length || 0);
    }, 0);
    return { totalEvents: rsvpEvents.length, totalRsvp, totalResponses };
  }, [rsvpEvents]);

  const onCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter an event name");
      return;
    }
    // For now, just show a message that this would create an RSVP event
    toast.success("RSVP event creation would be implemented here");
    setOpen(false);
    setName("");
  };

  const handleDuplicate = (eventId: string) => {
    toast.success("Event duplicated");
  };

  const handleDelete = (eventId: string) => {
    toast.success("Event deleted");
    deleteEvent(eventId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4 mb-10"
        >
          <div>
            <p className="text-sm text-gray-500">Welcome back</p>
            <h1 className="mt-1 text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
              RSVP Events
            </h1>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="rounded-lg shadow-md hover:shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> New RSVP
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-10">
          {[
            {
              label: "RSVP Events",
              value: stats.totalEvents,
              icon: Calendar,
              color: "bg-blue-50 text-blue-600",
            },
            {
              label: "Total Responses",
              value: stats.totalResponses,
              icon: Users,
              color: "bg-green-50 text-green-600",
            },
            {
              label: "Response Rate",
              value:
                stats.totalRsvp > 0
                  ? `${Math.round((stats.totalResponses / (stats.totalRsvp * 10)) * 100)}%`
                  : "0%",
              icon: BarChart3,
              color: "bg-purple-50 text-purple-600",
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.1 }}
            >
              <Card className="rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {s.label}
                    </p>
                    <p className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">
                      {s.value}
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-lg ${s.color} flex items-center justify-center`}>
                    <s.icon className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Event grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {rsvpEvents.length > 0 ? (
              rsvpEvents.map((e, i) => {
                const responseCount = e.responses?.length || 0;
                return (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="group rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all bg-white">
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                          RSVP
                        </span>
                      </div>
                      <h3 className="font-bold text-lg leading-tight line-clamp-2 text-gray-900">
                        {e.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
                        {e.description || "No description"}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-medium">
                        <span>{e.questions?.length || 0} questions</span>
                        <span>{responseCount} responses</span>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <Button
                          asChild
                          size="sm"
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Link href={`/organizer/events/${e.id}`}>Edit</Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                        >
                          <Link href={`/organizer/events/${e.id}/responses`}>
                            View Responses
                            <ArrowUpRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                        <div className="ml-auto flex">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg hover:bg-gray-100"
                            onClick={() => {
                              handleDuplicate(e.id);
                            }}
                            title="Duplicate event"
                          >
                            <Copy className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700"
                            onClick={() => {
                              handleDelete(e.id);
                            }}
                            title="Delete event"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No RSVP events yet
                </h3>
                <p className="text-gray-600 mb-6 max-w-sm">
                  Create your first RSVP event to start collecting responses
                </p>
                <Button
                  onClick={() => setOpen(true)}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create First RSVP
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Create Event Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-lg max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Create a new RSVP event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Event name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Rooftop Mixer"
                className="mt-2 h-10 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Event type
              </label>
              <p className="text-xs text-gray-600 mt-1">
                RSVP events collect attendance confirmations
              </p>
            </div>
          </div>
          <DialogFooter className="pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create RSVP Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

