"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Lock } from "lucide-react";
import { FieldRenderer } from "../rsvp-form/[id]/page";
import Link from "next/link";

export default function ReviewFlow() {
  const params = useParams();
  const id = params.id as string;
  
  const event = useStore((s) => s.events.find((e) => e.id === id));
  const submitResponse = useStore((s) => s.submitResponse);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);

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

  const submit = () => {
    submitResponse({ eventId: event.id, answers, status: "approved" });
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center">
          <h1 className="font-semibold text-slate-900 dark:text-white">
            {event.name}
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl py-10 md:py-16">
        {!done ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Quick feedback
              </p>
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
                  onClick={submit}
                  disabled={!canSubmit}
                  className="rounded-full px-7 h-11 shadow-lg hover:shadow-xl transition-shadow"
                >
                  Submit feedback
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
                Your feedback helps shape the next experience.
              </p>
              <Button
                asChild
                className="mt-8 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Link href={`/organizer/rsvp-builder/${event.id}/analytics`}>
                  See results
                </Link>
              </Button>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
