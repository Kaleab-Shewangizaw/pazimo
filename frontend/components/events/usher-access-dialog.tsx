"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, RefreshCw, ShieldCheck, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsherSummary {
  accessId: string;
  usher: {
    _id: string;
    firstName: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
  };
  grantedAt: string;
}

interface UsherAccessData {
  code: string | null;
  ushers: UsherSummary[];
}

// Trigger button (dropped in next to an event row's other action buttons —
// Edit/Scan/QR/etc.) that opens a dialog for generating the event's usher
// code and seeing/revoking who's scanning it. Shared between the organizer
// events list and the admin events list; the caller just passes whichever
// bearer token applies — the backend enforces ownership either way.
//
// Data loads lazily, only once the dialog is actually opened, so dropping
// this into a list of many events doesn't fire one request per row on page
// load.
export function UsherAccessDialog({
  eventId,
  eventTitle,
  token,
  triggerVariant = "outline",
  triggerClassName,
}: {
  eventId: string;
  eventTitle?: string;
  token: string;
  triggerVariant?: "outline" | "ghost";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<UsherAccessData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ushers/events/${eventId}/code`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load usher access");
      setData(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load usher access");
    } finally {
      setIsLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    if (open) fetchAccess();
  }, [open, fetchAccess]);

  const handleGenerate = async () => {
    const isRegenerating = !!data?.code;
    if (
      isRegenerating &&
      !window.confirm(
        "Generate a new code? The old code will stop working for anyone who hasn't already unlocked this event."
      )
    ) {
      return;
    }

    try {
      setIsGenerating(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ushers/events/${eventId}/code`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to generate code");
      setData((prev) => ({ code: json.data.code, ushers: prev?.ushers || [] }));
      toast.success(isRegenerating ? "Code regenerated" : "Code generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (accessId: string, usherId: string, name: string) => {
    if (!window.confirm(`Revoke ${name}'s access to this event?`)) return;
    try {
      setRevokingId(accessId);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ushers/events/${eventId}/access/${usherId}/revoke`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to revoke access");
      setData((prev) =>
        prev ? { ...prev, ushers: prev.ushers.filter((u) => u.accessId !== accessId) } : prev
      );
      toast.success(`Revoked ${name}'s access`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke access");
    } finally {
      setRevokingId(null);
    }
  };

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    toast.success("Code copied");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={triggerVariant}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={triggerClassName}
        title="Usher access"
      >
        <ShieldCheck className="h-4 w-4" />
      </Button>

      <DialogContent
        className="sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Usher Access{eventTitle ? ` — ${eventTitle}` : ""}
          </DialogTitle>
          <DialogDescription>
            Share this code with ushers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {data?.code ? (
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 px-5 py-3 font-mono text-2xl font-semibold tracking-[0.3em] text-foreground hover:bg-primary/15"
                  title="Click to copy"
                >
                  {data.code}
                  <Copy className="h-5 w-5 text-muted-foreground" />
                </button>
              ) : (
                <span className="text-sm font-medium text-foreground">
                  No code generated yet.
                </span>
              )}
              <Button
                variant={data?.code ? "outline" : "default"}
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
                {data?.code ? "Regenerate" : "Generate code"}
              </Button>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              Ushers scanning this event{" "}
              {data?.ushers?.length ? `(${data.ushers.length})` : ""}
            </h4>
            {!isLoading && (!data?.ushers || data.ushers.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                No usher has redeemed this event's code yet.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {data?.ushers.map((grant) => (
                  <li
                    key={grant.accessId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {grant.usher.firstName} {grant.usher.lastName || ""}
                        </p>
                        <p className="text-muted-foreground truncate">{grant.usher.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={revokingId === grant.accessId}
                      onClick={() =>
                        handleRevoke(
                          grant.accessId,
                          grant.usher._id,
                          `${grant.usher.firstName} ${grant.usher.lastName || ""}`.trim()
                        )
                      }
                    >
                      <X className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
