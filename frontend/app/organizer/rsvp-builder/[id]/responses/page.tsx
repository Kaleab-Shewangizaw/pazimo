"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Download, Users } from "lucide-react";
import { toast } from "sonner";

export default function ResponsesPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const events = useStore((s) => s.events);
  const allResponses = useStore((s) => s.responses);
  const loadEvent = useStore((s) => s.loadEvent);
  const loadResponses = useStore((s) => s.loadResponses);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

  const event = useMemo(() => events.find((item) => item.id === id), [events, id]);
  const responses = useMemo(
    () => allResponses.filter((response) => response.eventId === id),
    [allResponses, id]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);

    void Promise.all([
      event ? Promise.resolve() : loadEvent(id),
      loadResponses(id),
    ])
      .catch(() => toast.error("Failed to load responses"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event, id, loadEvent, loadResponses]);

  const exportCsv = () => {
    if (!event || responses.length === 0) {
      toast.error("No responses to export.");
      return;
    }

    const headers = ["submittedAt", "status", ...event.questions.map((q) => q.label)];
    const rows = responses.map((response) => [
      response.submittedAt,
      response.status,
      ...event.questions.map((q) => {
        const value = response.answers[q.id];
        if (Array.isArray(value)) return `"${value.join(", ")}"`;
        if (value == null) return "";
        return `"${String(value).replace(/"/g, '""')}"`;
      }),
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${event.name}-responses.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading responses…</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container mx-auto px-4 py-10 flex flex-col items-center">
        <div className="w-full max-w-6xl">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`/organizer/rsvp-builder/${event.id}/analytics`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to analytics
            </Link>
          </Button>
          <div className="ml-auto flex gap-2">
            <Button onClick={exportCsv} className="rounded-full shadow-lg hover:shadow-xl transition-shadow">
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Responses
          </p>
          <h1 className="mt-1 text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {event.name}
          </h1>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard icon={Users} label="Responses" value={responses.length} />
          <StatCard icon={Users} label="Questions" value={event.questions.length} />
          <StatCard icon={Users} label="Sections" value={event.sections.length} />
        </div>

        <Card className="mt-8 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700 w-full">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Response table
          </h2>
          {responses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              No responses yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 pr-4">Submitted</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Actions</th>
                    {event.questions.map((q) => (
                      <th key={q.id} className="py-3 pr-4 max-w-[200px] truncate hidden md:table-cell">
                        {q.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr key={response.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                        {new Date(response.submittedAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="rounded-full capitalize">
                          {response.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedResponse(response);
                            setDialogOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </td>
                      {event.questions.map((q) => {
                        const value = response.answers[q.id];
                        return (
                          <td key={q.id} className="py-3 pr-4 max-w-[200px] truncate text-slate-900 dark:text-white hidden md:table-cell">
                            {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>

        {/* Response detail dialog */}
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setSelectedResponse(null); setDialogOpen(v); }}>
          <DialogContent className="sm:max-w-[640px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Response details</DialogTitle>
              <DialogDescription>
                {selectedResponse ? new Date(selectedResponse.submittedAt).toLocaleString() : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">Status</div>
                <div>
                  {selectedResponse && (
                    <Badge variant="outline" className="rounded-full capitalize">
                      {selectedResponse.status}
                    </Badge>
                  )}
                </div>
              </div>
              {selectedResponse && event.questions.map((q) => (
                <div key={q.id} className="rounded-md bg-slate-50 dark:bg-slate-900 p-3">
                  <div className="text-sm text-slate-600 dark:text-slate-400">{q.label}</div>
                  <div className="mt-1 text-slate-900 dark:text-white">{Array.isArray(selectedResponse.answers[q.id]) ? selectedResponse.answers[q.id].join(", ") : String(selectedResponse.answers[q.id] ?? "—")}</div>
                </div>
              ))}
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
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
        </div>
        <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}