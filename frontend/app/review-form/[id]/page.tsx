"use client";

import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import type { AnswerValue, RsvpEvent } from "@/lib/rsvp-types";
import { getRsvpAuthToken, resolveRsvpImageUrl, rsvpApi } from "@/lib/rsvp-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Calendar, Clock, Lock, MapPin, Users } from "lucide-react";
import { FieldRenderer } from "@/app/rsvp-form/[id]/page";
import Link from "next/link";
import { toast } from "sonner";

export default function ReviewFlow() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-300"></div>
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const publicId = params.id as string;
  const isPreview = searchParams.get("preview") === "true";
  const mongoId = searchParams.get("id");

  const [event, setEvent] = useState<RsvpEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [done, setDone] = useState(false);
  const [submitMode, setSubmitMode] = useState<"public" | "protected">("public");

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    const token = getRsvpAuthToken();

    const fetchData = async () => {
      try {
        if (isPreview && mongoId && token) {
          const form = await rsvpApi.getForm(mongoId);
          if (active) {
            setEvent(form);
            setSubmitMode("protected");
          }
        } else {
          const form = await rsvpApi.getPublicForm(publicId);
          if (active) {
            setEvent(form);
            setSubmitMode("public");
          }
        }
      } catch {
        if (token && (mongoId || publicId)) {
          try {
            const form = await rsvpApi.getForm(mongoId || publicId);
            if (active) {
              setEvent(form);
              setSubmitMode("protected");
            }
          } catch {
            if (active) setEvent(null);
          }
        } else {
          if (active) setEvent(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      active = false;
    };
  }, [publicId, isPreview, mongoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 dark:border-slate-400"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Button asChild className="rounded-full">
          <Link href="/organizer/rsvp-builder">Back</Link>
        </Button>
      </div>
    );
  }

  const visibleQuestions = event.questions.filter((q) => {
    if (!q.conditional) return true;
    const v = answers[q.conditional.questionId];
    if (v === undefined || v === null) return false;
    const target = q.conditional.value as number;
    if (q.conditional.operator === "lt") return Number(v) < target;
    if (q.conditional.operator === "gt") return Number(v) > target;
    return Number(v) === target;
  });

  const canSubmit = visibleQuestions.every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  });

  const submitReview = async () => {
    setSubmitting(true);
    try {
      const payload = {
        answers,
        metadata: {
          sourceUrl: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          preview: isPreview,
        },
      };
      if (submitMode === "protected" && (mongoId || event.id)) {
        await rsvpApi.submitProtectedResponse(mongoId || event.id, payload);
      } else {
        await rsvpApi.submitPublicResponse(event.publicId || publicId, payload);
      }
      toast.success("Review submitted! Thank you for your feedback.");
      setDone(true);
    } catch {
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container mx-auto max-w-2xl py-10 md:py-16">
        {!done ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {!done && event.coverImage && (
              <div className="overflow-hidden rounded-2xl shadow-lg aspect-[16/10] mb-10">
                <Image
                  src={resolveRsvpImageUrl(event.coverImage)}
                  alt={event.name}
                  width={1280}
                  height={800}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )}

            <div className="text-center">
              <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {event.name}
              </h1>
              {event.description && (
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  {event.description}
                </p>
              )}
              {event.anonymous && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-700/50 px-3 py-1 text-xs text-slate-600 dark:text-slate-400">
                  <Lock className="h-3 w-3" /> Anonymous responses
                </p>
              )}
            </div>

            {(event.date || event.hostedBy || event.location || event.venue || event.startTime || event.endTime) && (
              <Card className="mt-8 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="grid gap-3 sm:grid-cols-2">
                  {event.date && (
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</div>
                        <div className="text-sm text-slate-900 dark:text-white">{event.date}</div>
                      </div>
                    </div>
                  )}
                  {event.hostedBy && (
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Hosted by</div>
                        <div className="text-sm text-slate-900 dark:text-white">{event.hostedBy}</div>
                      </div>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Location</div>
                        <div className="text-sm text-slate-900 dark:text-white">{event.location}</div>
                      </div>
                    </div>
                  )}
                  {event.venue && (
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue</div>
                        <div className="text-sm text-slate-900 dark:text-white">{event.venue}</div>
                      </div>
                    </div>
                  )}
                  {(event.startTime || event.endTime) && (
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3 sm:col-span-2">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Time</div>
                        <div className="text-sm text-slate-900 dark:text-white">
                          {[event.startTime, event.endTime].filter(Boolean).join(" - ")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <Card className="mt-8 rounded-2xl bg-white dark:bg-slate-800 p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="space-y-7">
                {visibleQuestions.map((q) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <FieldRenderer
                      q={q}
                      value={answers[q.id]}
                      onChange={(v) =>
                        setAnswers({ ...answers, [q.id]: v })
                      }
                    />
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={submitReview}
                  disabled={!canSubmit || submitting}
                  className="rounded-full px-12 h-12 shadow-lg hover:shadow-xl transition-shadow text-base"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="rounded-2xl bg-white dark:bg-slate-800 p-10 text-center shadow-sm border border-slate-200 dark:border-slate-700">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shadow-lg"
              >
                <Check className="h-8 w-8" strokeWidth={3} />
              </motion.div>
              <h1 className="mt-6 text-4xl font-semibold text-slate-900 dark:text-white">
                Thank you.
              </h1>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Your feedback has been submitted successfully.
              </p>
              {/* <Button
                asChild
                className="mt-8 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Link href={`/organizer/rsvp-builder/${event.id}/analytics`}>
                  See results
                </Link>
              </Button> */}
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
