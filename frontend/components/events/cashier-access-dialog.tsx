"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, Plus, RefreshCw, Wallet, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashierSummary {
  accessId: string;
  cashier: {
    _id: string;
    firstName: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
  };
  grantedAt: string;
}

interface CashierAccessData {
  code: string | null;
  cashiers: CashierSummary[];
}

const EMPTY_NEW_CASHIER = { firstName: "", lastName: "", email: "", phoneNumber: "", password: "" };

// Trigger button (dropped in next to an event row's other action buttons —
// Edit/Usher access/QR/etc.) that opens a dialog for generating the event's
// cashier code, seeing/revoking who's redeeming it, and creating a brand
// new cashier account without leaving the row. Shared between the organizer
// events list and the admin events list — the event-scoped twin of
// UsherAccessDialog, for beverage redemption instead of ticket scanning.
//
// Data loads lazily, only once the dialog is actually opened, so dropping
// this into a list of many events doesn't fire one request per row on page
// load.
export function CashierAccessDialog({
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
  const [data, setData] = useState<CashierAccessData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCashier, setNewCashier] = useState(EMPTY_NEW_CASHIER);

  const fetchAccess = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/event-cashiers/events/${eventId}/code`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load cashier access");
      setData(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cashier access");
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/event-cashiers/events/${eventId}/code`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to generate code");
      setData((prev) => ({ code: json.data.code, cashiers: prev?.cashiers || [] }));
      toast.success(isRegenerating ? "Code regenerated" : "Code generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (accessId: string, cashierId: string, name: string) => {
    if (!window.confirm(`Revoke ${name}'s access to this event?`)) return;
    try {
      setRevokingId(accessId);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/event-cashiers/events/${eventId}/access/${cashierId}/revoke`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to revoke access");
      setData((prev) =>
        prev ? { ...prev, cashiers: prev.cashiers.filter((c) => c.accessId !== accessId) } : prev
      );
      toast.success(`Revoked ${name}'s access`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke access");
    } finally {
      setRevokingId(null);
    }
  };

  const handleCreateCashier = async () => {
    if (!newCashier.firstName.trim()) return toast.error("First name is required");
    if (!newCashier.email.trim()) return toast.error("Email is required");
    if (!newCashier.phoneNumber.trim()) return toast.error("Phone number is required");
    if (newCashier.password.length < 6) return toast.error("Password must be at least 6 characters");

    try {
      setCreating(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/event-cashiers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newCashier.firstName.trim(),
          lastName: newCashier.lastName.trim() || undefined,
          email: newCashier.email.trim(),
          phoneNumber: newCashier.phoneNumber.trim(),
          password: newCashier.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create cashier");
      toast.success("Cashier account created — share the event code above with them");
      setNewCashier(EMPTY_NEW_CASHIER);
      setShowCreateForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create cashier");
    } finally {
      setCreating(false);
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
        title="Cashier access"
      >
        <Wallet className="h-4 w-4" />
      </Button>

      <DialogContent
        className="sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Cashier Access{eventTitle ? ` — ${eventTitle}` : ""}
          </DialogTitle>
          <DialogDescription>
            Share this code with cashiers so they can hand out pre-bought drinks.
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
              Cashiers redeeming this event{" "}
              {data?.cashiers?.length ? `(${data.cashiers.length})` : ""}
            </h4>
            {!isLoading && (!data?.cashiers || data.cashiers.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                No cashier has redeemed this event&apos;s code yet.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {data?.cashiers.map((grant) => (
                  <li
                    key={grant.accessId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {grant.cashier.firstName} {grant.cashier.lastName || ""}
                        </p>
                        <p className="text-muted-foreground truncate">{grant.cashier.email}</p>
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
                          grant.cashier._id,
                          `${grant.cashier.firstName} ${grant.cashier.lastName || ""}`.trim()
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

          <div className="border-t border-border pt-4">
            {showCreateForm ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">New cashier</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates a login — it doesn&apos;t grant access on its own. Share the code
                  above with them once they can sign in.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>First name</Label>
                    <Input
                      value={newCashier.firstName}
                      onChange={(e) => setNewCashier((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last name</Label>
                    <Input
                      value={newCashier.lastName}
                      onChange={(e) => setNewCashier((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newCashier.email}
                      onChange={(e) => setNewCashier((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Phone number</Label>
                    <Input
                      value={newCashier.phoneNumber}
                      onChange={(e) => setNewCashier((p) => ({ ...p, phoneNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newCashier.password}
                      onChange={(e) => setNewCashier((p) => ({ ...p, password: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateCashier} disabled={creating} className="w-full">
                  {creating ? "Creating…" : "Create cashier"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> New cashier
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
