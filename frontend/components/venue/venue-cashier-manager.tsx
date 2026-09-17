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
import { Plus, Pencil, Power, Users } from "lucide-react";
import {
  listVenueCashiers,
  createVenueCashier,
  updateVenueCashier,
  type VenueCashier,
} from "@/lib/venue-api";

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

/**
 * Create/list/edit/deactivate a venue's own counter staff.
 *
 * Reused as-is by the venue owner's self-service page and by the admin
 * dashboard's per-venue dialog — both callers just pass the venue id and
 * whichever token authorizes them; the backend's `adminOrVenueAccount` gate
 * (see backend/src/routes/venueRoutes.js) already accepts both and neither
 * one accepts a cashier's own token, so this component never needs to know
 * which kind of caller it's rendering for.
 */
export function VenueCashierManager({
  venueId,
  token,
}: {
  venueId: string;
  token: string;
}) {
  const [cashiers, setCashiers] = useState<VenueCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VenueCashier | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listVenueCashiers(venueId, token);
      setCashiers(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cashiers");
    } finally {
      setLoading(false);
    }
  }, [venueId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (cashier: VenueCashier) => {
    setEditing(cashier);
    setForm({
      firstName: cashier.firstName || "",
      lastName: cashier.lastName || "",
      email: cashier.email,
      phoneNumber: cashier.phoneNumber || "",
      password: "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.firstName.trim()) return toast.error("First name is required");
    if (!editing) {
      if (!form.email.trim()) return toast.error("Email is required");
      if (!form.phoneNumber.trim()) return toast.error("Phone number is required");
      if (form.password.length < 6) {
        return toast.error("Password must be at least 6 characters");
      }
    }
    try {
      setSaving(true);
      if (editing) {
        await updateVenueCashier(venueId, editing._id, token, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phoneNumber: form.phoneNumber.trim(),
        });
        toast.success("Cashier updated");
      } else {
        await createVenueCashier(venueId, token, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          email: form.email.trim(),
          phoneNumber: form.phoneNumber.trim(),
          password: form.password,
        });
        toast.success("Cashier created");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cashier");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cashier: VenueCashier) => {
    setTogglingId(cashier._id);
    try {
      await updateVenueCashier(venueId, cashier._id, token, {
        isActive: !cashier.isActive,
      });
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
            <Users className="h-4 w-4" /> Cashiers
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Counter staff — can sell drinks, hand over pre-paid orders and view sales
            history. They can&apos;t touch the beverage line-up, happy hours,
            withdrawals, or create more cashiers.
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
          No cashiers yet. Add one to let counter staff sell without sharing this
          account&apos;s own login.
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(cashier)}>
                        <Pencil className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={togglingId === cashier._id}
                        onClick={() => toggleActive(cashier)}
                      >
                        <Power className="mr-1 h-4 w-4" />
                        {cashier.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
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
            <DialogTitle>{editing ? "Edit cashier" : "Add cashier"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this cashier's details."
                : "Creates a login this cashier can use to sell drinks and redeem orders at the counter."}
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
                disabled={Boolean(editing)}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              {editing && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Email can&apos;t be changed here — deactivate and add a new cashier
                  instead.
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Phone number</Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
              />
            </div>
            {!editing && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            )}
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
