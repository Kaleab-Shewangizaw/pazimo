"use client";

import { useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import { cinemaRequest, type CinemaProfile } from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PasswordField } from "@/components/ui/password-field";
import { toast } from "sonner";
import { Info, KeyRound } from "lucide-react";

/**
 * Change the sign-in password — separate from the profile save above so a
 * mistyped current password never blocks an unrelated profile edit.
 *
 * The current password is required and verified server-side (PUT
 * /api/cinemas/me/security compares it before writing anything) — an admin
 * resetting one on the cinema's behalf is the only path that skips that
 * check, from the admin panel. autoComplete="off" here (rather than the
 * usual "current-password") is deliberate: that value is exactly what tells
 * a browser to offer autofilling a saved credential into the field, and this
 * one should always be typed, proving whoever is sitting at the keyboard
 * actually knows it.
 */
function PasswordCard({ token }: { token: string }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const change = async () => {
    if (!form.currentPassword) return toast.error("Enter your current password");
    if (form.newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters");
    }
    if (form.newPassword !== form.confirmPassword) {
      return toast.error("New password and confirmation don't match");
    }
    setSaving(true);
    try {
      await cinemaRequest("/api/cinemas/me/security", token, {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      toast.success("Password updated");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
      <CardContent className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Password
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <PasswordField
            label="Current password"
            autoComplete="off"
            value={form.currentPassword}
            onChange={(v) => setForm({ ...form, currentPassword: v })}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(v) => setForm({ ...form, newPassword: v })}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
          />
        </div>
        <Button onClick={change} disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
      </CardContent>
    </Card>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function AccountContent({
  cinema,
  token,
}: {
  cinema: CinemaProfile;
  token: string;
}) {
  const [form, setForm] = useState({
    name: cinema.name || "",
    description: cinema.description || "",
    city: cinema.city || "",
    address: cinema.address || "",
    phoneNumber: cinema.phoneNumber || "",
    email: cinema.email || "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    cinema.image ? `${API_URL}${cinema.image}` : null
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Cinema name is required");
    setSaving(true);
    try {
      // Multipart because the profile image goes through the same multer
      // upload the rest of the platform uses.
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v.trim()));
      if (imageFile) body.append("image", imageFile);

      await cinemaRequest("/api/cinemas/me", token, { method: "PATCH", body });
      toast.success("Cinema profile updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pct = (r: number) => `${((r || 0) * 100).toFixed(2)}%`;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Account
      </h1>

      <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Cinema profile
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) =>
                  setForm({ ...form, phoneNumber: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Email (also your sign-in email)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Logo / image</Label>
            <div className="flex items-center gap-4">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Cinema"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  if (file) setPreview(URL.createObjectURL(file));
                }}
              />
            </div>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <PasswordCard token={token} />

      {/* Read-only on purpose: the backend ignores these fields from a cinema
          and accepts them only from an admin, so showing them as editable would
          be a form that silently does nothing. */}
      {/* <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Commercial terms
          </h2>
          <p className="mb-4 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Set by Pazimo. Contact us to renegotiate — changes apply to future
            sales only, never to money already reported or paid out.
          </p>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                Ticket commission
              </dt>
              <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                {pct(cinema.ticketCommissionRate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                Concession commission
              </dt>
              <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                {pct(cinema.beverageCommissionRate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                Concessions approved
              </dt>
              <dd>
                <Badge
                  variant={
                    cinema.beverageEligibility === "eligible"
                      ? "default"
                      : "secondary"
                  }
                >
                  {cinema.beverageEligibility === "eligible" ? "Yes" : "Not yet"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                Pazimo withholds your VAT
              </dt>
              <dd>
                <Badge variant={cinema.coversCinemaVat ? "default" : "secondary"}>
                  {cinema.coversCinemaVat ? "Yes" : "No — you settle your own"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card> */}
    </div>
  );
}

export default function CinemaAccountPage() {
  return (
    <CinemaGate>
      {(cinema, token) => <AccountContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
