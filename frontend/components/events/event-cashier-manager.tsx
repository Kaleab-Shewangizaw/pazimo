"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Power, Users } from "lucide-react";

interface EventCashier {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Create/list/deactivate event-cashier accounts — the event-scoped twin of
 * components/cinema/cinema-cashier-manager.tsx and
 * components/venue/venue-cashier-manager.tsx. Unlike those two, there is no
 * `endpointBase`: GET/POST/PATCH /api/event-cashiers is one fixed path, and
 * the backend infers the scope from the caller's own role — an admin sees
 * every event cashier, an organizer sees only the ones it created (see
 * eventCashierController.js). Reused as-is by the organizer's own
 * "/organizer/cashiers" page and the admin dashboard's
 * "/admin/users/cashiers" page — both callers just pass whichever token
 * authorizes them.
 *
 * Creating a cashier here grants no event access on its own — that's a
 * separate step (the "Cashier code" button on an event's row, opening
 * CashierAccessDialog) where the code is generated and the cashier redeems
 * it in the mobile app.
 */
export function EventCashierManager({ token }: { token: string }) {
  const [cashiers, setCashiers] = useState<EventCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/event-cashiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load cashiers");
      setCashiers(json.data?.users || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cashiers");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.firstName.trim()) return toast.error("First name is required");
    if (!form.email.trim()) return toast.error("Email is required");
    if (!form.phoneNumber.trim()) return toast.error("Phone number is required");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/api/event-cashiers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          email: form.email.trim(),
          phoneNumber: form.phoneNumber.trim(),
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create cashier");
      toast.success("Cashier created — share an event's code with them from that event's row");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cashier");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cashier: EventCashier) => {
    setTogglingId(cashier._id);
    try {
      const res = await fetch(`${API_URL}/api/event-cashiers/${cashier._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cashier.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update cashier");
      toast.success(cashier.isActive ? "Cashier deactivated" : "Cashier reactivated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update cashier");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Users className="h-4 w-4" /> Event Cashiers
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Beverage-redemption staff for your events. They can&apos;t sell
            or manage anything — only hand over a pre-bought drink at the
            event you&apos;ve given them the code for.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add cashier
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : cashiers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No cashiers yet. Add one, then share an event&apos;s code with them
          (from that event&apos;s row) once they can sign in.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((cashier) => (
                <tr
                  key={cashier._id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {cashier.firstName} {cashier.lastName || ""}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <p>{cashier.email}</p>
                    <p className="text-xs">{cashier.phoneNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cashier.isActive ? "secondary" : "outline"}>
                      {cashier.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingId === cashier._id}
                      onClick={() => toggleActive(cashier)}
                    >
                      <Power className="mr-1 h-4 w-4" />
                      {cashier.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add cashier</DialogTitle>
            <DialogDescription>
              Creates a login this cashier can use to redeem drinks at whichever event you give them the code for.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Phone number</Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save cashier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
