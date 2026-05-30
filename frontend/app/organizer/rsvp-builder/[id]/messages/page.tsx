"use client";

import { useParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  Mail,
  MessageSquare,
  Bell,
  Crown,
  Users,
  Newspaper,
  History,
} from "lucide-react";
import { toast } from "sonner";
import type { AttendeeTag, MessageChannel } from "@/lib/rsvp-types";
import Link from "next/link";

const SEGMENTS: {
  id: AttendeeTag;
  icon: any;
  hint: string;
}[] = [
  { id: "VIP", icon: Crown, hint: "Top-tier guests" },
  { id: "Guest", icon: Users, hint: "General attendees" },
  { id: "Press", icon: Newspaper, hint: "Media & press" },
];

const CHANNELS: {
  id: MessageChannel;
  label: string;
  icon: any;
}[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "push", label: "Push", icon: Bell },
];

export default function Messages() {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const basePath = pathname.startsWith("/admin/")
    ? "/admin/rsvps"
    : "/organizer/rsvp-builder";
  
  const events = useStore((s) => s.events);
  const allResponses = useStore((s) => s.responses);
  const allMessages = useStore((s) => s.messages);
  const loadEvent = useStore((s) => s.loadEvent);
  const loadResponses = useStore((s) => s.loadResponses);
  const setResponseTag = useStore((s) => s.setResponseTag);
  const sendBulkMessage = useStore((s) => s.sendBulkMessage);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<AttendeeTag>>(
    new Set(["VIP", "Guest", "Press"])
  );
  const [channel, setChannel] = useState<MessageChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const event = useMemo(() => events.find((e) => e.id === id), [events, id]);
  const responses = useMemo(
    () => allResponses.filter((r) => r.eventId === id),
    [allResponses, id]
  );
  const messages = useMemo(
    () => allMessages.filter((m) => m.eventId === id),
    [allMessages, id]
  );

  const segmentCounts = useMemo(() => {
    const c: Record<AttendeeTag, number> = { VIP: 0, Guest: 0, Press: 0 };
    responses.forEach((r) => {
      const t = (r.tag || "Guest") as AttendeeTag;
      c[t] = (c[t] || 0) + 1;
    });
    return c;
  }, [responses]);

  const recipientCount = useMemo(
    () => Array.from(selected).reduce((sum, s) => sum + (segmentCounts[s] || 0), 0),
    [selected, segmentCounts]
  );

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      event || !id ? Promise.resolve() : loadEvent(id),
      loadResponses(id),
    ])
      .catch(() => {
        toast.error("Failed to load message data");
      })
      .finally(() => setLoading(false));
  }, [event, id, loadEvent, loadResponses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading messages…</div>
      </div>
    );
  }

  if (!event || event.type !== "rsvp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container py-20 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Bulk messaging is available for RSVP events.
          </p>
          <Button asChild className="rounded-full">
            <Link href={basePath}>
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const toggleSegment = (s: AttendeeTag) => {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelected(next);
  };

  const onSend = () => {
    if (selected.size === 0)
      return toast.error("Select at least one segment.");
    if (!body.trim()) return toast.error("Message body is required.");
    if (channel === "email" && !subject.trim())
      return toast.error("Subject is required for email.");
    if (recipientCount === 0)
      return toast.error(
        "No attendees match the selected segments."
      );

    sendBulkMessage({
      eventId: event.id,
      channel,
      subject: channel === "email" ? subject.trim() : undefined,
      body: body.trim(),
      segments: Array.from(selected),
      recipientCount,
    });
    setSubject("");
    setBody("");
    toast.success(`Sent to ${recipientCount} attendee${recipientCount === 1 ? "" : "s"}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container mx-auto px-4 py-10 flex flex-col items-center">
        <div className="w-full max-w-6xl">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full"
          >
            <Link href={basePath}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`${basePath}/${event.id}/analytics`}>
              Analytics
            </Link>
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Bulk messaging
          </p>
          <h1 className="mt-1 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {event.name}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Send updates to attendees by segment.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Composer */}
          <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Compose message
            </h2>

            {/* Segments */}
            <div className="mt-5">
              <Label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Segments
              </Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SEGMENTS.map((s) => {
                  const active = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSegment(s.id)}
                      className={`text-left rounded-xl border p-4 transition-all ${
                        active
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <s.icon
                          className={`h-5 w-5 ${
                            active
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {segmentCounts[s.id] || 0}
                        </span>
                      </div>
                      <div className={`mt-2 font-medium text-sm ${active ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-white'}`}>
                        {s.id}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {s.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel */}
            <div className="mt-5">
              <Label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Channel
              </Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as MessageChannel)}
              >
                <SelectTrigger className="mt-2 h-11 rounded-lg border border-slate-200 dark:border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            {channel === "email" && (
              <div className="mt-5">
                <Label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Subject
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, 120))}
                  placeholder="Last-minute info for tonight"
                  className="mt-2 h-11 rounded-lg border border-slate-200 dark:border-slate-600"
                />
              </div>
            )}

            {/* Body */}
            <div className="mt-5">
              <Label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Message
              </Label>
              <Textarea
                value={body}
                onChange={(e) =>
                  setBody(
                    e.target.value.slice(
                      0,
                      channel === "sms" ? 480 : 4000
                    )
                  )
                }
                placeholder={
                  channel === "sms"
                    ? "Short and friendly..."
                    : "Write your update..."
                }
                rows={channel === "sms" ? 4 : 7}
                className="mt-2 rounded-lg border border-slate-200 dark:border-slate-600"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {recipientCount} recipient
                  {recipientCount === 1 ? "" : "s"}
                </span>
                <span>{body.length} chars</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={onSend}
                className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Send className="mr-1 h-4 w-4" /> Send to{" "}
                {recipientCount}
              </Button>
            </div>
          </Card>

          {/* Attendees + History */}
          <div className="space-y-6">
            <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Attendees
              </h2>
              {responses.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  No RSVPs yet.
                </p>
              ) : (
                <div className="mt-4 max-h-72 overflow-y-auto pr-1 space-y-2">
                  {responses.map((r) => {
                    const name = r.attendee?.fullName || "Attendee";
                    const email = r.attendee?.email || "";
                    const phone = r.attendee?.phone || "";
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/20 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {String(name)}
                          </div>
                          <div className="truncate text-xs text-slate-600 dark:text-slate-400">
                            {String(email || phone || "No contact captured")}
                          </div>
                        </div>
                        <Select
                          value={(r.tag || "Guest") as AttendeeTag}
                          onValueChange={(v) =>
                            setResponseTag(r.id, v as AttendeeTag)
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] rounded-full text-xs border border-slate-200 dark:border-slate-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEGMENTS.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Send history
                </h2>
              </div>
              {messages.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  No messages sent yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map((m) => {
                      const Channel =
                        CHANNELS.find((c) => c.id === m.channel)?.icon ||
                        Mail;
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/20 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <Channel className="h-3.5 w-3.5" />
                              <span className="uppercase tracking-wider">
                                {m.channel}
                              </span>
                              <span>·</span>
                              <span>
                                {new Date(m.sentAt).toLocaleString()}
                              </span>
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {m.recipientCount} sent
                            </span>
                          </div>
                          {m.subject && (
                            <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                              {m.subject}
                            </div>
                          )}
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap">
                            {m.body}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.segments.map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="rounded-full text-[10px]"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
