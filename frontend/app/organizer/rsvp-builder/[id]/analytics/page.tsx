"use client";

import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Users,
  TrendingDown,
  Star,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function Analytics() {
  const params = useParams();
  const id = params.id as string;
  const events = useStore((s) => s.events);
  const allResponses = useStore((s) => s.responses);
  const loadEvent = useStore((s) => s.loadEvent);
  const loadResponses = useStore((s) => s.loadResponses);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const event = useMemo(() => events.find((e) => e.id === id), [events, id]);
  const responses = useMemo(
    () => allResponses.filter((r) => r.eventId === id),
    [allResponses, id]
  );

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      event || !id ? Promise.resolve() : loadEvent(id),
      loadResponses(id),
    ])
      .catch(() => {
        toast.error("Failed to load analytics data");
      })
      .finally(() => setLoading(false));
  }, [event, id, loadEvent, loadResponses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading analytics…</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container py-20 text-center">
          <Button asChild className="rounded-full">
            <Link href="/organizer/rsvp-builder">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    if (event.type === "rsvp") {
      const total = responses.length;
      const approved = responses.filter(
        (r) => r.status === "approved" || r.status === "paid"
      ).length;
      const pending = responses.filter((r) => r.status === "pending").length;
      const paid = responses.filter((r) => r.status === "paid").length;
      const unpaid = responses.filter((r) => r.status === "unpaid").length;
      const dropOff =
        total === 0 ? 0 : Math.round((unpaid / Math.max(total, 1)) * 100);
      return { total, approved, pending, paid, unpaid, dropOff };
    } else {
      const ratingQ = event.questions.find((q) => q.type === "rating");
      const npsQ = event.questions.find((q) => q.type === "nps");
      const ratings = ratingQ
        ? responses
            .map((r) => r.answers[ratingQ.id])
            .filter((n) => typeof n === "number")
        : [];
      const avgRating =
        ratings.length >0
          ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1)
          : "—";
      const npsValues = npsQ
        ? responses
            .map((r) => r.answers[npsQ.id])
            .filter((n) => typeof n === "number")
        : [];
      const promoters = npsValues.filter((n: number) => n >= 9).length;
      const detractors = npsValues.filter((n: number) => n <= 6).length;
      const nps =
        npsValues.length > 0
          ? Math.round(((promoters - detractors) / npsValues.length) * 100)
          : 0;

      // Keyword extraction
      const longTextIds = event.questions
        .filter((q) => q.type === "long_text")
        .map((q) => q.id);
      const allWords: string[] = [];
      responses.forEach((r) =>
        longTextIds.forEach((id) => {
          const v = r.answers[id];
          if (typeof v === "string")
            allWords.push(
              ...v.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
            );
        })
      );
      const counts: Record<string, number> = {};
      allWords.forEach((w) => {
        counts[w] = (counts[w] || 0) + 1;
      });
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      return { total: responses.length, avgRating, nps, top };
    }
  }, [event, responses]);

  const exportCsv = () => {
    if (responses.length === 0) {
      toast.error("No responses to export.");
      return;
    }
    const headers = ["submittedAt", "status", ...event.questions.map((q) => q.label)];
    const rows = responses.map((r) => [
      r.submittedAt,
      r.status,
      ...event.questions.map((q) => {
        const v = r.answers[q.id];
        if (Array.isArray(v)) return `"${v.join(", ")}"`;
        if (v == null) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      }),
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.name}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full"
          >
            <Link href="/organizer/rsvp-builder">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {event.type === "rsvp" && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/organizer/rsvp-builder/${event.id}/messages`}>
                  Messages
                </Link>
              </Button>
            )}
            <Button onClick={exportCsv} className="rounded-full shadow-lg hover:shadow-xl transition-shadow">
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {event.type === "rsvp" ? "RSVP analytics" : "Review analytics"}
          </p>
          <h1 className="mt-1 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {event.name}
          </h1>
        </motion.div>

        {/* Stats grid */}
        {event.type === "rsvp" ? (
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total RSVPs"
              value={`${(stats as any).total}${event.rsvpLimit ? ` / ${event.rsvpLimit}` : ""}`}
            />
            <StatCard icon={ThumbsUp} label="Approved" value={(stats as any).approved} />
            <StatCard icon={Users} label="Pending" value={(stats as any).pending} />
            <StatCard
              icon={TrendingDown}
              label="Drop-off"
              value={`${(stats as any).dropOff}%`}
              hint="Started but unpaid"
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StatCard icon={Users} label="Responses" value={(stats as any).total} />
            <StatCard
              icon={Star}
              label="Average rating"
              value={(stats as any).avgRating}
            />
            <StatCard icon={ThumbsUp} label="NPS" value={(stats as any).nps} />
          </div>
        )}

        {/* Responses table */}
        <Card className="mt-8 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Responses
          </h2>
          {responses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              No responses yet. Share the form link to start collecting.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 pr-4">Submitted</th>
                    <th className="py-3 pr-4">Status</th>
                    {event.questions.slice(0, 3).map((q) => (
                      <th key={q.id} className="py-3 pr-4 max-w-[200px] truncate">
                        {q.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                        {new Date(r.submittedAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      {event.questions.slice(0, 3).map((q) => (
                        <td key={q.id} className="py-3 pr-4 max-w-[200px] truncate text-slate-900 dark:text-white">
                          {Array.isArray(r.answers[q.id])
                            ? r.answers[q.id].join(", ")
                            : String(r.answers[q.id] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Keywords for review */}
        {event.type === "review" && (stats as any).top?.length > 0 && (
          <Card className="mt-6 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Common keywords
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(stats as any).top.map(([w, c]: [string, number]) => (
                <span
                  key={w}
                  className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                >
                  {w} <span className="text-slate-600 dark:text-slate-400 text-xs">· {c}</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: any;
  hint?: string;
}) {
  return (
    <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
          )}
        </div>
        <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    paid: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    unpaid: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <Badge
      className={`rounded-full border capitalize ${map[status] || ""}`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}
