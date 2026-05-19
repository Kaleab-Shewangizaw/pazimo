"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, Suspense } from "react";
import Image from "next/image";
import type { Question, RsvpEvent } from "@/lib/rsvp-types";
import { resolveRsvpImageUrl, rsvpApi } from "@/lib/rsvp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Sparkles,
  BookOpen,
  ImageIcon,
  Calendar,
  MapPin,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import Link from "next/link";

export default function RsvpFlow() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RsvpContent />
    </Suspense>
  );
}

function RsvpContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const publicId = params.id as string;
  const isPreview = searchParams.get("preview") === "true";
  const mongoId = searchParams.get("id");
  
  const [event, setEvent] = useState<RsvpEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [mobileTab, setMobileTab] = useState<"rsvp" | "description" | "images">("rsvp");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const token = useAdminAuthStore.getState().token;

    const fetchData = async () => {
      try {
        // If it's a preview and we have a mongoId + token, use the private endpoint
        if (isPreview && mongoId && token) {
          const form = await rsvpApi.getForm(mongoId);
          if (active) setEvent(form);
        } else {
          // Normal public fetch
          const form = await rsvpApi.getPublicForm(publicId);
          if (active) setEvent(form);
        }
      } catch (err) {
        // Fallback for edge cases
        if (token && (mongoId || publicId)) {
          try {
            const form = await rsvpApi.getForm(mongoId || publicId);
            if (active) setEvent(form);
          } catch (innerErr) {
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

  const sections = useMemo(
    () =>
      event?.sections.filter((s) =>
        event.questions.some((q) => q.sectionId === s.id)
      ) || [],
    [event]
  );

  const totalSteps = useMemo(
    () => sections.length + (event?.payment?.enabled ? 1 : 0),
    [sections.length, event?.payment?.enabled]
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9][0-9\s().-]{6,}$/;

  const isPayStep = Boolean(event?.payment?.enabled && step === sections.length);
  const currentSection = sections[step];
  const sectionQs = useMemo(
    () =>
      event?.questions.filter((q) => q.sectionId === currentSection?.id) || [],
    [event, currentSection]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center transition-colors">
        <div className="text-gray-600 dark:text-gray-300">Loading form…</div>
      </div>
    );
  }

  if (!event)
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center transition-colors">
        <Button asChild className="rounded-full">
          <Link href="/organizer/rsvp-builder">Back</Link>
        </Button>
      </div>
    );

  if (event.type !== "rsvp") {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center transition-colors">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">
            This event uses the Review template.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link href={`/review-form/${event.id}`}>Continue</Link>
          </Button>
        </div>
      </div>
    );
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    for (const q of sectionQs) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))
          nextErrors[q.id] = "This field is required.";
      }

      const value = answers[q.id];
      if (q.type === "email" && value && !emailRegex.test(String(value).trim())) {
        nextErrors[q.id] = "Enter a valid email address, like name@example.com.";
      }

      if (q.type === "phone" && value && !phoneRegex.test(String(value).trim())) {
        nextErrors[q.id] = "Enter a valid phone number, like +1 555 000 0000.";
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (!isPayStep && !validate()) return;
    setFieldErrors({});
    if (step < totalSteps - 1) setStep(step + 1);
    else submitForm();
  };

  const submitForm = async () => {
    setSubmitting(true);
    try {
      if (!validate()) {
        setSubmitting(false);
        return;
      }
      setFieldErrors({});
      await rsvpApi.submitPublicResponse(event.publicId || publicId, {
        answers,
        metadata: {
          sourceUrl: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });
      toast.success("RSVP submitted successfully!");
      setDone(true);
    } catch (error) {
      toast.error("Failed to submit RSVP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const completePayment = () => {
    setPaying(true);
    setTimeout(() => {
      void rsvpApi
        .submitPublicResponse(event.publicId || publicId, {
          answers,
          metadata: {
            sourceUrl: typeof window !== "undefined" ? window.location.href : "",
            referrer: typeof document !== "undefined" ? document.referrer : "",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        })
        .then(() => setDone(true))
        .catch(() => {})
        .finally(() => setPaying(false));
    }, 1200);
  };

  const progress = ((step + 1) / totalSteps) * 100;
  const mobileDateLabel = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;
  const mobileDayName = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", { weekday: "short" })
    : null;
  const mobileDayNumber = event?.date
    ? new Date(event.date).getDate().toString().padStart(2, "0")
    : null;
  const mobileMonthName = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", { month: "short" })
    : null;
  const mobileTimeLabel = event?.startTime
    ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`
    : null;
  const mobileCtaLabel = event?.payment?.enabled
    ? `RSVP · ${event.payment.price} ${event.payment.currency}`
    : "RSVP";
  const mobileDescription = event?.description?.trim() || "No description available.";
  const eventDateLabel = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date to be announced";
  const eventLocationLabel = event?.location?.trim() || event?.venue?.trim() || "Location to be announced";

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 -mt-1 transition-colors duration-300">
      {isPreview && (
        <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-[#0a0f1f]/80">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9"
                onClick={() => router.push(`/organizer/rsvp-builder/${event?.id || mongoId}`)}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Editor
              </Button>
              <h1 className="font-semibold text-gray-900 dark:text-white">{event?.name}</h1>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2.5 py-1 rounded-full">
              Preview Mode
            </span>
          </div>
        </header>
      )}

      <div className="relative w-full overflow-hidden md:hidden">
        <div className="block md:hidden px-8 py-4">
          <div className="relative w-full max-w-md mx-auto">
            {event.coverImage ? (
              <Image
                src={resolveRsvpImageUrl(event.coverImage)}
                alt={`${event.name} - Event cover`}
                width={600}
                height={300}
                className="w-full h-auto object-cover rounded-lg shadow-md"
                priority
              />
            ) : (
              <div className="w-full h-[220px] bg-gray-200 dark:bg-white/10 rounded-lg" />
            )}
          </div>
        </div>

        <div className="block md:hidden px-4 py-4 bg-white dark:bg-[#0A0A0A] transition-colors">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight flex-1">
              {event.name}
            </h1>
          </div>

          <div className="flex gap-4 items-start">
            {mobileDayName && mobileDayNumber && mobileMonthName && (
              <div className="shrink-0 bg-white dark:bg-[#1A1D24] border border-gray-200 dark:border-white/10 rounded-lg p-3 text-center shadow-sm min-w-[70px]">
                <div className="text-xs font-medium text-gray-600 dark:text-yellow-400 uppercase tracking-wide">
                  {mobileDayName}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none mt-1">
                  {mobileDayNumber}
                </div>
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mt-1">
                  {mobileMonthName}
                </div>
              </div>
            )}

            <div className="flex-1 space-y-3">
              {event.location && (
                <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">{event.location}</div>
                  </div>
                </div>
              )}
              {mobileDateLabel && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm">{mobileDateLabel}</span>
                </div>
              )}
              {mobileTimeLabel && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Clock className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm">{mobileTimeLabel}</span>
                </div>
              )}
              {event.hostedBy && <div className="text-xs text-gray-500 dark:text-gray-400">by {event.hostedBy}</div>}
            </div>
          </div>
        </div>
      </div>

      <section className="relative bg-gray-300 dark:bg-[#1A1D24] hidden md:block transition-colors">
        <div className="relative h-[50vh] md:h-[75vh] w-[100%] mx-auto bg-gray-600 dark:bg-[#0A0A0A] overflow-hidden">
          {event.coverImage ? (
            <Image
              src={resolveRsvpImageUrl(event.coverImage)}
              alt={`${event.name} - Event banner`}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              quality={90}
            />
          ) : (
            <div className="absolute inset-0 bg-gray-300 dark:bg-white/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/40" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-6 md:px-10 md:pb-10 lg:px-16 lg:pb-14">
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black dark:text-white leading-tight mb-3">
            {event.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-5 text-black/90 dark:text-white/90 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-300 dark:text-blue-400 shrink-0" />
              {eventDateLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-300 dark:text-blue-400 shrink-0" />
              {mobileTimeLabel || "Time TBA"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-300 dark:text-blue-400 shrink-0" />
              {eventLocationLabel}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 md:hidden">
        <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as typeof mobileTab)} className="w-full">
          <TabsList className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#1A1D24] border-t border-gray-200 dark:border-white/10 w-full justify-around rounded-none h-12 p-0 shadow-t">
            <TabsTrigger value="rsvp" className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs">
              <Sparkles className="h-4 w-4 mb-0.5" />
              <span className="text-xs">RSVP</span>
            </TabsTrigger>
            <TabsTrigger value="description" className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs">
              <BookOpen className="h-4 w-4 mb-0.5" />
              <span className="text-xs">About</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="flex-1 flex flex-col items-center justify-center rounded-none text-gray-700 dark:text-gray-400 data-[state=active]:border-t-2 data-[state=active]:border-[#0D47A1] dark:data-[state=active]:border-yellow-400 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-yellow-400/10 h-12 px-0 text-xs">
              <ImageIcon className="h-4 w-4 mb-0.5" />
              <span className="text-xs">Images</span>
            </TabsTrigger>
          </TabsList>

          <div className="pb-16 md:pb-0 mt-0">
            <TabsContent value="rsvp" className="mt-0 space-y-4">
              {!done && !started ? (
                <EventStartCard
                  event={event}
                  mobileCtaLabel={mobileCtaLabel}
                  mobileTimeLabel={mobileTimeLabel}
                  eventDateLabel={eventDateLabel}
                  eventLocationLabel={eventLocationLabel}
                  onStart={() => setStarted(true)}
                />
              ) : !done ? (
                <RsvpFlowCard
                  event={event}
                  step={step}
                  totalSteps={totalSteps}
                  progress={progress}
                  isPayStep={isPayStep}
                  currentSection={currentSection}
                  sectionQs={sectionQs}
                  answers={answers}
                  fieldErrors={fieldErrors}
                  submitting={submitting}
                  paying={paying}
                  onBack={() => {
                    setStarted(false);
                    setStep(0);
                    setFieldErrors({});
                  }}
                  onPrev={() => setStep(step - 1)}
                  onNext={next}
                  onCompletePayment={completePayment}
                  onChangeAnswer={(questionId, value) => setAnswers({ ...answers, [questionId]: value })}
                />
              ) : (
                <ConfirmationScreen event={event} eventId={event.id} />
              )}
            </TabsContent>

            <TabsContent value="description" className="mt-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">About The Event</h2>
              <p className="mt-4 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{mobileDescription}</p>
            </TabsContent>

            <TabsContent value="images" className="mt-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Images</h2>
              <div className="mt-4 relative aspect-video rounded-lg overflow-hidden">
                {event.coverImage ? (
                  <Image src={resolveRsvpImageUrl(event.coverImage)} alt={`${event.name} cover`} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gray-200 dark:bg-white/10" />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {!started && !done ? (
        <section className="py-10 md:py-16 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
              <div className="lg:col-span-2 space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About This Event</h2>
                  <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-4">
                    <p className="whitespace-pre-line">{mobileDescription}</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Event Image</h2>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                    {event.coverImage ? (
                      <Image src={resolveRsvpImageUrl(event.coverImage)} alt={`${event.name} image`} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 dark:bg-white/10" />
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24 space-y-4">
                  <EventStartCard
                    event={event}
                    mobileCtaLabel={mobileCtaLabel}
                    mobileTimeLabel={mobileTimeLabel}
                    eventDateLabel={eventDateLabel}
                    eventLocationLabel={eventLocationLabel}
                    onStart={() => setStarted(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-10 md:py-16 hidden md:block">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {!done ? (
              <RsvpFlowCard
                event={event}
                step={step}
                totalSteps={totalSteps}
                progress={progress}
                isPayStep={isPayStep}
                currentSection={currentSection}
                sectionQs={sectionQs}
                answers={answers}
                fieldErrors={fieldErrors}
                submitting={submitting}
                paying={paying}
                onBack={() => {
                  setStarted(false);
                  setStep(0);
                  setFieldErrors({});
                }}
                onPrev={() => setStep(step - 1)}
                onNext={next}
                onCompletePayment={completePayment}
                onChangeAnswer={(questionId, value) => setAnswers({ ...answers, [questionId]: value })}
              />
            ) : (
              <ConfirmationScreen event={event} eventId={event.id} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function EventStartCard({
  event,
  mobileCtaLabel,
  mobileTimeLabel,
  eventDateLabel,
  eventLocationLabel,
  onStart,
}: {
  event: any;
  mobileCtaLabel: string;
  mobileTimeLabel: string | null;
  eventDateLabel: string;
  eventLocationLabel: string;
  onStart: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <Card className="rounded-[1.75rem] border border-white/70 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            RSVP form
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Ready to RSVP?
          </h2>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            Review the event details, then continue into the RSVP flow without losing the page's event-detail look.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          <InfoRow icon={Calendar} label="Date" value={eventDateLabel} compact />
          <InfoRow icon={Clock} label="Time" value={mobileTimeLabel || "Time to be announced"} compact />
          <InfoRow icon={MapPin} label="Location" value={eventLocationLabel} compact />
          <InfoRow icon={Users} label="Hosted by" value={event.hostedBy || "Organizer"} compact />
        </div>

        <div className="mt-6 flex items-center justify-center">
          <Button onClick={onStart} className="h-12 rounded-full px-10 text-base shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/25">
            {mobileCtaLabel} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function RsvpFlowCard({
  event,
  step,
  totalSteps,
  progress,
  isPayStep,
  currentSection,
  sectionQs,
  answers,
  fieldErrors,
  submitting,
  paying,
  onBack,
  onPrev,
  onNext,
  onCompletePayment,
  onChangeAnswer,
}: {
  event: any;
  step: number;
  totalSteps: number;
  progress: number;
  isPayStep: boolean;
  currentSection?: { id: string; title: string };
  sectionQs: Question[];
  answers: Record<string, any>;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  paying: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCompletePayment: () => void;
  onChangeAnswer: (questionId: string, value: any) => void;
  mobile?: boolean;
}) {
  return (
    <Card className="rounded-[1.75rem] border border-white/70 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#111827]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">RSVP flow</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{event.name}</h2>
        </div>
        <Button type="button" variant="ghost" onClick={onBack} className="rounded-full text-slate-600 dark:text-slate-300">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          <span>
            Step {step + 1} of {totalSteps}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-slate-100 dark:bg-white/10" />
      </div>

      <AnimatePresence mode="wait">
        {!isPayStep && currentSection ? (
          <motion.div
            key={currentSection.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="mt-6 rounded-[1.5rem] border border-slate-200/80 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{currentSection.title}</h3>
              <div className="mt-5 space-y-5">
                {sectionQs.map((q) => (
                  <FieldRenderer
                    key={q.id}
                    q={q}
                    value={answers[q.id]}
                    error={fieldErrors[q.id]}
                    onChange={(value) => onChangeAnswer(q.id, value)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="pay" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            <Card className="mt-6 rounded-[1.5rem] border border-slate-200/80 bg-slate-50 p-5 text-center dark:border-white/10 dark:bg-white/5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Confirm with payment</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">Your seat is reserved. Complete payment to receive your ticket.</p>
              <div className="mt-8 inline-flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold text-slate-950 dark:text-white">{event.payment!.price}</span>
                <span className="text-base text-slate-600 dark:text-slate-400">{event.payment!.currency}</span>
              </div>
              {event.payment!.deadline && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Pay before {new Date(event.payment!.deadline).toLocaleDateString()}</p>}
              <Button onClick={onCompletePayment} disabled={paying} className="mt-8 h-12 rounded-full px-8 shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/25">
                {paying ? "Processing…" : "Pay now"}
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!isPayStep && (
        <div className="mt-6 flex items-center justify-end gap-3">
          {step > 0 && (
            <Button variant="ghost" className="rounded-full" onClick={onPrev}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          <Button onClick={onNext} disabled={submitting} className="rounded-full px-6 shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/25 min-w-[140px]">
            {submitting ? "Submitting..." : step === totalSteps - 1 ? "Submit RSVP" : <><span>Continue</span><ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
        </div>
      )}
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: any;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-[1.25rem] border border-slate-200/80 bg-slate-50 ${compact ? "px-3 py-2.5" : "px-4 py-3"} dark:border-white/10 dark:bg-white/5`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-blue-600 dark:text-blue-300">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function ConfirmationScreen({
  event,
  eventId,
}: {
  event: any;
  eventId: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="rounded-[1.75rem] border border-white/70 bg-white p-8 text-center shadow-[0_16px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#111827]">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-lg dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-8 w-8" strokeWidth={3} />
        </motion.div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">You're in.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-400">
          {event.payment?.enabled
            ? "Payment confirmed. Your ticket and QR code are on the way."
            : event.approvalMode === "manual"
              ? "Your RSVP is pending review. We'll email you once approved."
              : "Your RSVP is confirmed. We can't wait to see you."}
        </p>
      </Card>
    </motion.div>
  );
}

export function FieldRenderer({
  q,
  value,
  error,
  onChange,
}: {
  q: Question;
  value: any;
  error?: string;
  onChange: (v: any) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-950 dark:text-white">
        {q.label} {q.required && <span className="text-red-500">*</span>}
      </Label>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2">
        {q.type === "short_text" && (
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
          />
        )}
        {q.type === "long_text" && (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[100px] rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
          />
        )}
        {q.type === "email" && (
          <Input
            type="email"
            inputMode="email"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
            placeholder="you@example.com"
          />
        )}
        {q.type === "phone" && (
          <Input
            type="tel"
            inputMode="tel"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
            pattern="^\+?[0-9][0-9\s().-]{6,}$"
            placeholder="+1 555 000 0000"
          />
        )}
        {q.type === "date" && (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
          />
        )}
        {q.type === "file" && (
          <Input
            type="file"
            onChange={(e) => onChange(e.target.files?.[0]?.name)}
            className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a] file:text-slate-900 dark:file:text-white"
          />
        )}

        {q.type === "single_choice" && (
          <RadioGroup value={value || ""} onValueChange={onChange} className="space-y-2">
            {(q.options || []).map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                  value === opt
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:bg-white/5"
                }`}
              >
                <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                <span className="text-sm text-slate-950 dark:text-white">{opt}</span>
              </label>
            ))}
          </RadioGroup>
        )}

        {q.type === "multi_choice" && (
          <div className="space-y-2">
            {(q.options || []).map((opt) => {
              const checked = (value || []).includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    checked
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:bg-white/5"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const cur: string[] = value || [];
                      onChange(c ? [...cur, opt] : cur.filter((x) => x !== opt));
                    }}
                  />
                  <span className="text-sm text-slate-950 dark:text-white">{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {q.type === "dropdown" && (
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(q.options || []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {q.type === "rating" && (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-12 w-12 rounded-xl border transition-all ${
                  value >= n
                    ? "border-yellow-500 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:bg-white/5"
                }`}
              >
                <span className="text-xl">★</span>
              </button>
            ))}
          </div>
        )}

        {q.type === "emoji" && (
          <div className="grid grid-cols-5 gap-2">
            {["😍", "🙂", "😐", "😕", "😡"].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange(e)}
                className={`h-14 rounded-xl border text-2xl transition-all ${
                  value === e
                    ? "border-blue-500 bg-blue-50 scale-105 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:hover:bg-white/5"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {q.type === "nps" && (
          <div className="grid grid-cols-11 gap-1.5">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 rounded-xl border text-sm font-medium transition-all ${
                  value === n
                    ? "border-blue-500 bg-blue-600 text-white dark:bg-blue-400"
                    : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:text-white dark:hover:bg-white/5"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {q.type === "yes_no" && (
          <div className="grid grid-cols-2 gap-3">
            {["Yes", "No"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`h-12 rounded-xl border font-medium transition-all ${
                  value === opt
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f172a] dark:text-white dark:hover:bg-white/5"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
