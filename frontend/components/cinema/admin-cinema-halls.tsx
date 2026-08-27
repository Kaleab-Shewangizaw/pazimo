"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DoorOpen, Trash2, Pencil, Plus } from "lucide-react";

/**
 * A cinema's rooms, edited by the admin — the piece the cinema's own
 * Programme page already had (name, capacity, screen type, turnaround,
 * active) but the admin side never got, per the same "admin controls
 * everything about the cinema" the account/password fixes cover.
 *
 * Deliberately NOT a seat-map editor: laying out chairs is an operational
 * job the cinema does for itself, and duplicating SeatMapEditor here would
 * mean two places that can disagree about what a room looks like. This
 * dialog only edits the room's basic facts, which is what an admin
 * correcting a typo or renaming "Screen 1" actually needs.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Hall {
  _id: string;
  name: string;
  capacity: number;
  screenType?: string;
  isActive: boolean;
  turnaroundMinutes: number | null;
  hasAssignedSeating: boolean;
}

interface HallFormState {
  name: string;
  capacity: string;
  screenType: string;
  turnaroundMinutes: string;
  isActive: boolean;
}

const EMPTY_FORM: HallFormState = {
  name: "",
  capacity: "",
  screenType: "",
  turnaroundMinutes: "",
  isActive: true,
};

function HallForm({
  form,
  setForm,
  onSave,
  onCancel,
  busy,
  showActiveToggle,
  capacityDisabled,
}: {
  form: HallFormState;
  setForm: (form: HallFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  showActiveToggle: boolean;
  capacityDisabled: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <Input
        placeholder="Name (Screen 1)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Input
            type="number"
            placeholder="Capacity"
            value={form.capacity}
            disabled={capacityDisabled}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
          {capacityDisabled && (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Set by the seat map on the cinema&apos;s own dashboard.
            </p>
          )}
        </div>
        <Input
          placeholder="Screen type (3D, IMAX…)"
          value={form.screenType}
          onChange={(e) => setForm({ ...form, screenType: e.target.value })}
        />
      </div>
      <Input
        type="number"
        placeholder="Turnaround minutes — blank uses the cinema default"
        value={form.turnaroundMinutes}
        onChange={(e) => setForm({ ...form, turnaroundMinutes: e.target.value })}
      />
      {showActiveToggle && (
        <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
          <Label className="text-xs font-normal">Active</Label>
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => setForm({ ...form, isActive: v })}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onSave}
          disabled={busy || !form.name.trim() || !form.capacity}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function AdminCinemaHalls({
  cinemaId,
  cinemaName,
  open,
  onOpenChange,
}: {
  cinemaId: string;
  cinemaName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { token } = useAdminAuthStore();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // The hall id being edited, "new" while adding one, or null for none.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HallFormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cinemas/admin/${cinemaId}/halls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load halls");
      setHalls(data.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load halls");
    } finally {
      setLoading(false);
    }
  }, [token, cinemaId]);

  useEffect(() => {
    if (!open) return;
    load();
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, [open, load]);

  const startEdit = (h: Hall) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      capacity: String(h.capacity),
      screenType: h.screenType || "",
      turnaroundMinutes:
        h.turnaroundMinutes === null ? "" : String(h.turnaroundMinutes),
      isActive: h.isActive,
    });
  };

  const startCreate = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    const isNew = editingId === "new";
    setBusy(true);
    try {
      const url = isNew
        ? `${API_URL}/api/cinemas/admin/${cinemaId}/halls`
        : `${API_URL}/api/cinemas/admin/${cinemaId}/halls/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          capacity: Number(form.capacity),
          screenType: form.screenType || undefined,
          turnaroundMinutes:
            form.turnaroundMinutes === "" ? null : Number(form.turnaroundMinutes),
          ...(isNew ? {} : { isActive: form.isActive }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save hall");
      toast.success(isNew ? "Hall added" : "Hall updated");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save hall");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (hallId: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/admin/${cinemaId}/halls/${hallId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to remove hall");
      toast.success(data.message || "Hall removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove hall");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            {cinemaName}&apos;s halls
          </DialogTitle>
          <DialogDescription>
            Name, capacity, screen type and whether a room can be scheduled. Seat
            layout stays on the cinema&apos;s own dashboard — this is the room&apos;s
            basic details only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {halls.map((h) => (
              <div
                key={h._id}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              >
                {editingId === h._id ? (
                  <HallForm
                    form={form}
                    setForm={setForm}
                    onSave={save}
                    onCancel={cancelEdit}
                    busy={busy}
                    showActiveToggle
                    capacityDisabled={h.hasAssignedSeating}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {h.name}{" "}
                        {!h.isActive && <Badge variant="secondary">off</Badge>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {h.capacity} seats
                        {h.screenType ? ` · ${h.screenType}` : ""}
                        {h.turnaroundMinutes !== null
                          ? ` · ${h.turnaroundMinutes} min turnaround`
                          : " · default turnaround"}
                        {h.hasAssignedSeating ? " · assigned seating" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(h)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(h._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {halls.length === 0 && editingId !== "new" && (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No halls yet.
              </p>
            )}

            {editingId === "new" ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
                <HallForm
                  form={form}
                  setForm={setForm}
                  onSave={save}
                  onCancel={cancelEdit}
                  busy={busy}
                  showActiveToggle={false}
                  capacityDisabled={false}
                />
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={startCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add a hall
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
