"use client";

import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/rsvp-store";
import type { Question } from "@/lib/rsvp-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Calendar,
  MapPin,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function RsvpFlow() {
  const params = useParams();
  const id = params.id as string;
  
  const event = useStore((s) => s.events.find((e) => e.id === id));
  const submitResponse = useStore((s) => s.submitResponse);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);

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

  const isPayStep = event?.payment?.enabled && step === sections.length;
  const currentSection = sections[step];
  const sectionQs = useMemo(
    () =>
      event?.questions.filter((q) => q.sectionId === currentSection?.id) || [],
    [event, currentSection]
  );

  if (!event)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Button asChild className="rounded-full">
          <Link href="/organizer/rsvp-builder">Back</Link>
        </Button>
      </div>
    );

  if (event.type !== "rsvp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
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
    for (const q of sectionQs) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))
          return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!isPayStep && !validate()) return;
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  };

  const finish = () => {
    submitResponse({
      eventId: event.id,
      answers,
      status: event.payment?.enabled
        ? "unpaid"
        : event.approvalMode === "manual"
          ? "pending"
          : "approved",
    });
    setDone(true);
  };

  const completePayment = () => {
    setPaying(true);
    setTimeout(() => {
      submitResponse({
        eventId: event.id,
        answers,
        status: "paid",
      });
      setPaying(false);
      setDone(true);
    }, 1200);
  };

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="font-semibold text-slate-900 dark:text-white">
            {event.name}
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl py-10 md:py-16">
        {!done && !started ? (
          <EventDetail event={event} onStart={() => setStarted(true)} />
        ) : !done ? (
          <>
            <div className="mb-8 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                RSVP
              </p>
              <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {event.name}
              </h1>
              {event.description && (
                <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                <span>
                  Step {step + 1} of {totalSteps}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <AnimatePresence mode="wait">
              {!isPayStep && currentSection ? (
                <motion.div
                  key={currentSection.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                >
                  <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {currentSection.title}
                    </h2>
                    <div className="mt-6 space-y-6">
                      {sectionQs.map((q) => (
                        <FieldRenderer
                          key={q.id}
                          q={q}
                          value={answers[q.id]}
                          onChange={(v) =>
                            setAnswers({ ...answers, [q.id]: v })
                          }
                        />
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                >
                  <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 md:p-10 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                    <div className="mx-auto h-14 w-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold text-slate-900 dark:text-white">
                      Confirm with payment
                    </h2>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                      Your seat is reserved. Complete payment to receive your
                      ticket.
                    </p>
                    <div className="mt-8 inline-flex items-baseline gap-1.5">
                      <span className="text-5xl font-semibold text-slate-900 dark:text-white">
                        {event.payment!.price}
                      </span>
                      <span className="text-lg text-slate-600 dark:text-slate-400">
                        {event.payment!.currency}
                      </span>
                    </div>
                    {event.payment!.deadline && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        Pay before{" "}
                        {new Date(
                          event.payment!.deadline
                        ).toLocaleDateString()}
                      </p>
                    )}
                    <Button
                      onClick={completePayment}
                      disabled={paying}
                      className="mt-8 rounded-full px-8 h-12 shadow-lg hover:shadow-xl transition-shadow"
                    >
                      {paying ? "Processing…" : "Pay now"}
                    </Button>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {!isPayStep && (
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() =>
                    step === 0
                      ? window.history.back()
                      : setStep(step - 1)
                  }
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={next}
                  disabled={!validate()}
                  className="rounded-full px-6 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {step === totalSteps - 1 ? "Submit RSVP" : "Continue"}{" "}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <ConfirmationScreen event={event} eventId={event.id} />
        )}
      </main>
    </div>
  );
}

function EventDetail({
  event,
  onStart,
}: {
  event: any;
  onStart: () => void;
}) {
  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const timeLabel = event.startTime
    ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`
    : null;
  const ctaLabel = event.payment?.enabled
    ? `RSVP · ${event.payment.price} ${event.payment.currency}`
    : "RSVP";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {event.coverImage && (
        <div className="overflow-hidden rounded-2xl shadow-lg aspect-[16/10] mb-8">
          <img
            src={event.coverImage}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="text-center">
        {event.hostedBy && (
          <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Hosted by {event.hostedBy}
          </p>
        )}
        <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {event.name}
        </h1>
        {event.description && (
          <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            {event.description}
          </p>
        )}
      </div>

      <Card className="mt-8 rounded-2xl bg-white dark:bg-slate-800 p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="grid gap-5 sm:grid-cols-2">
          {dateLabel && (
            <DetailRow icon={Calendar} label="Date" value={dateLabel} />
          )}
          {timeLabel && (
            <DetailRow icon={Clock} label="Time" value={timeLabel} />
          )}
          {event.location && (
            <DetailRow
              icon={MapPin}
              label="Location"
              value={event.location}
              sub={event.venue}
            />
          )}
          {typeof event.rsvpLimit === "number" && (
            <DetailRow
              icon={Users}
              label="Capacity"
              value={`${event.rsvpLimit} guests`}
            />
          )}
        </div>
      </Card>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          onClick={onStart}
          className="rounded-full px-10 h-12 shadow-lg hover:shadow-xl transition-shadow text-base"
        >
          {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {event.approvalMode === "manual"
            ? "Subject to organizer approval"
            : "Instant confirmation"}
        </p>
      </div>
    </motion.div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {label}
        </p>
        <p className="text-sm font-medium mt-0.5 truncate text-slate-900 dark:text-white">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {sub}
          </p>
        )}
      </div>
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
          You're in.
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {event.payment?.enabled
            ? "Payment confirmed. Your ticket and QR code are on the way."
            : event.approvalMode === "manual"
              ? "Your RSVP is pending review. We'll email you once approved."
              : "Your RSVP is confirmed. We can't wait to see you."}
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-full"
          >
            <Link href={`/organizer/rsvp-builder/${eventId}/analytics`}>
              View analytics
            </Link>
          </Button>
          <Button
            asChild
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <Link href="/organizer/rsvp-builder">
              <Sparkles className="mr-1 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export function FieldRenderer({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-900 dark:text-white">
        {q.label} {q.required && <span className="text-red-500">*</span>}
      </Label>
      <div className="mt-2">
        {q.type === "short_text" && (
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-600"
          />
        )}
        {q.type === "long_text" && (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 min-h-[100px]"
          />
        )}
        {q.type === "email" && (
          <Input
            type="email"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-600"
            placeholder="you@example.com"
          />
        )}
        {q.type === "phone" && (
          <Input
            type="tel"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-600"
            placeholder="+1 555 000 0000"
          />
        )}
        {q.type === "date" && (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-600"
          />
        )}
        {q.type === "file" && (
          <Input
            type="file"
            onChange={(e) => onChange(e.target.files?.[0]?.name)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-600 file:text-slate-900 dark:file:text-white"
          />
        )}

        {q.type === "single_choice" && (
          <RadioGroup value={value || ""} onValueChange={onChange} className="space-y-2">
            {(q.options || []).map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                  value === opt
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                <span className="text-sm text-slate-900 dark:text-white">{opt}</span>
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
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                    checked
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const cur: string[] = value || [];
                      onChange(c ? [...cur, opt] : cur.filter((x) => x !== opt));
                    }}
                  />
                  <span className="text-sm text-slate-900 dark:text-white">{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {q.type === "dropdown" && (
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-11 rounded-lg border border-slate-200 dark:border-slate-600">
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
                className={`h-12 w-12 rounded-lg border transition-all ${
                  value >= n
                    ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-600 dark:text-yellow-400"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                className={`h-14 rounded-lg border text-2xl transition-all ${
                  value === e
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                className={`h-10 rounded-lg border text-sm font-medium transition-all ${
                  value === n
                    ? "border-blue-500 bg-blue-600 dark:bg-blue-500 text-white"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-900 dark:text-white"
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
                className={`h-12 rounded-lg border font-medium transition-all ${
                  value === opt
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-900 dark:text-white"
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
