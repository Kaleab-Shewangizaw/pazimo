"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/rsvp-store";
import type { Response } from "@/lib/rsvp-types";
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
import { ArrowLeft, CheckCircle2, Download, ScanLine, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadHighQualityQR } from "@/lib/downloadQR";

export default function ResponsesPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const basePath = pathname.startsWith("/admin/")
    ? "/admin/rsvps"
    : "/organizer/rsvp-builder";
  const events = useStore((s) => s.events);
  const allResponses = useStore((s) => s.responses);
  const loadEvent = useStore((s) => s.loadEvent);
  const loadResponses = useStore((s) => s.loadResponses);
  const updateResponseStatus = useStore((s) => s.updateResponseStatus);
  const sendBulkMessage = useStore((s) => s.sendBulkMessage);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageScope, setMessageScope] = useState<"all" | "selected">("all");
  const [messageChannel, setMessageChannel] = useState<"email" | "sms" | "both">("both");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

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

    const headers = [
      "submittedAt",
      "status",
      "fullName",
      "email",
      "phone",
      ...event.questions.map((q) => q.label),
    ];
    const rows = responses.map((response) => [
      response.submittedAt,
      response.status,
      `"${String(response.attendee?.fullName || "").replace(/"/g, '""')}"`,
      `"${String(response.attendee?.email || "").replace(/"/g, '""')}"`,
      `"${String(response.attendee?.phone || "").replace(/"/g, '""')}"`,
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

  const handleStatusUpdate = async (
    responseId: string,
    status: "approved" | "rejected"
  ) => {
    await updateResponseStatus(responseId, status);
    setSelectedResponse((current) =>
      current && current.id === responseId ? { ...current, status } : current
    );
    toast.success(status === "approved" ? "Response approved" : "Response declined");
  };

  const openMessageComposer = (scope: "all" | "selected", response?: Response) => {
    setMessageScope(scope);
    setSelectedResponse(response || null);
    setMessageChannel("both");
    setMessageSubject(scope === "selected" ? `Message for ${response?.attendee?.fullName || "attendee"}` : `Message about ${event.name}`);
    setMessageBody("");
    setMessageDialogOpen(true);
  };

  const handleSendMessage = async () => {
    const recipientIds =
      messageScope === "selected" && selectedResponse
        ? [selectedResponse.id]
        : responses.map((response) => response.id);

    if (!recipientIds.length) {
      toast.error("No RSVP responses found to message.");
      return;
    }

    if ((messageChannel === "email" || messageChannel === "both") && !messageSubject.trim()) {
      toast.error("Email messages need a subject.");
      return;
    }

    if (!messageBody.trim()) {
      toast.error("Message body is required.");
      return;
    }

    setSendingMessage(true);
    try {
      const result = await sendBulkMessage({
        eventId: id,
        channel: messageChannel,
        subject: messageSubject.trim() || undefined,
        body: messageBody,
        segments: [],
        responseIds: recipientIds,
        recipientCount: recipientIds.length,
      });

      const deliveredCount = result.emailCount + result.smsCount;
      toast.success(
        deliveredCount > 0
          ? `Message sent to ${deliveredCount} delivery destination${deliveredCount === 1 ? "" : "s"}.`
          : "Message processed, but no deliveries were possible."
      );
      setMessageDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send RSVP message.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 dark:border-slate-400"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container py-20 text-center">
          <Button asChild className="rounded-full">
            <Link href={basePath}>Back</Link>
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
              <Link href={`${basePath}/${event.id}/analytics`}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to analytics
              </Link>
            </Button>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => openMessageComposer("all")}
              >
                Message responders
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/organizer/qr-scanner?mode=rsvp&formId=${id}`}>
                  <ScanLine className="mr-1 h-4 w-4" />
                  Open scanner
                </Link>
              </Button>
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
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Phone</th>
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
                      <td className="py-3 pr-4 text-slate-900 dark:text-white">
                        {response.attendee?.fullName || "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-900 dark:text-white">
                        {response.attendee?.email || "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-900 dark:text-white">
                        {response.attendee?.phone || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleStatusUpdate(response.id, "approved")}
                            disabled={response.status === "approved"}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          {response.status !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-red-600 hover:text-red-600 dark:text-red-400"
                              onClick={() => handleStatusUpdate(response.id, "rejected")}
                              disabled={response.status === "rejected"}
                            >
                              <XCircle className="mr-1 h-4 w-4" /> Decline
                            </Button>
                          )}
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
                          {response.qrCodeDataUrl ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                downloadHighQualityQR(
                                  response.qrCodeDataUrl,
                                  `${event.name.replace(/\s+/g, "-").toLowerCase()}-${response.responseId || response.id}.png`,
                                )
                              }
                            >
                              QR
                            </Button>
                          ) : null}
                        </div>
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

        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogContent className="sm:max-w-[720px] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Message responders</DialogTitle>
              <DialogDescription>
                Send a message by email, SMS, or both to {messageScope === "selected" && selectedResponse ? selectedResponse.attendee?.fullName || "the selected attendee" : "all matching RSVP responses"}.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                  Channel
                  <select
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    value={messageChannel}
                    onChange={(event) => setMessageChannel(event.target.value as "email" | "sms" | "both")}
                  >
                    <option value="both">Email and SMS</option>
                    <option value="email">Email only</option>
                    <option value="sms">SMS only</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                  Subject
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    value={messageSubject}
                    onChange={(event) => setMessageSubject(event.target.value)}
                    placeholder="Optional for SMS, required for email"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                Message
                <textarea
                  className="min-h-[180px] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write the message you want to send to attendees."
                />
              </label>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                This will target {messageScope === "selected" && selectedResponse ? 1 : responses.length} response{(messageScope === "selected" && selectedResponse ? 1 : responses.length) === 1 ? "" : "s"}.
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" className="rounded-full" onClick={() => setMessageDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-full" onClick={handleSendMessage} disabled={sendingMessage}>
                {sendingMessage ? "Sending..." : "Send message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              {selectedResponse && (
                <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-3">
                  <div className="text-sm text-slate-600 dark:text-slate-400">Attendee</div>
                  <div className="mt-1 text-slate-900 dark:text-white">
                    {(selectedResponse.attendee?.fullName || "—") + " · " + (selectedResponse.attendee?.email || "—") + " · " + (selectedResponse.attendee?.phone || "—")}
                  </div>
                </div>
              )}
              {selectedResponse?.qrCodeDataUrl ? (
                <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">QR pass</div>
                  <div className="mt-3 flex flex-col items-center gap-3">
                    <Image
                      src={selectedResponse.qrCodeDataUrl}
                      alt={`${selectedResponse.attendee?.fullName || "Attendee"} QR pass`}
                      width={192}
                      height={192}
                      className="h-48 w-48 rounded-lg border bg-white p-3"
                      unoptimized
                    />
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        downloadHighQualityQR(
                          selectedResponse.qrCodeDataUrl,
                          `${event.name.replace(/\s+/g, "-").toLowerCase()}-${selectedResponse.responseId || selectedResponse.id}.png`,
                        )
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download QR
                    </Button>
                  </div>
                </div>
              ) : null}
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
              {selectedResponse && (
                <div className="mr-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openMessageComposer("selected", selectedResponse)}
                  >
                    Message attendee
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => handleStatusUpdate(selectedResponse.id, "approved")}
                    disabled={selectedResponse.status === "approved"}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full text-red-600 hover:text-red-600 dark:text-red-400"
                    onClick={async () => handleStatusUpdate(selectedResponse.id, "rejected")}
                    disabled={selectedResponse.status === "rejected"}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Decline
                  </Button>
                </div>
              )}
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
  icon: React.ComponentType<{ className?: string }>;
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
