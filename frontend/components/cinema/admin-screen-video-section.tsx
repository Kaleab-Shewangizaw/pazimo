"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import { Clapperboard } from "lucide-react";
import { fetchScreenVideo } from "@/lib/cinema-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildVideoUrl = (video?: string | null) => (video ? `${API_URL}${video}` : null);

/**
 * The single looping clip that plays behind the seat map on every cinema's
 * seat-selection screen, on both the web checkout and the mobile app —
 * platform-wide, unlike a cinema's own promo video (that one is per-cinema
 * and plays on that cinema's own page, set from the Cinemas tab instead).
 */
export default function AdminScreenVideoSection() {
  const { token } = useAdminAuthStore();
  const [video, setVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchVideo = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScreenVideo();
      setVideo(data.video || null);
      setPreview(buildVideoUrl(data.video));
    } catch {
      toast.error("Failed to load the seat-selection screen video");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.append("video", file);
      const res = await fetch(`${API_URL}/api/cinemas/admin/screen-video`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token || ""}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save the video");
      setVideo(data.video || null);
      setPreview(buildVideoUrl(data.video));
      setFile(null);
      toast.success("Screen video updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5" /> Seat-selection screen
        </CardTitle>
        <CardDescription>
          Plays on the auditorium screen behind the seat map while a customer is
          choosing seats — one clip for every cinema on the platform, not set
          per cinema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-32 w-56 rounded-xl" />
        ) : (
          <div className="flex items-center gap-4">
            {preview ? (
              <video
                key={preview}
                src={preview}
                controls
                muted
                className="h-32 w-56 rounded-xl bg-black object-cover ring-1 ring-gray-200 dark:ring-gray-800"
              />
            ) : (
              <div className="flex h-32 w-56 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No video set
              </div>
            )}
            <div className="space-y-2">
              <Label>Replace with</Label>
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setFile(next);
                  setPreview(next ? URL.createObjectURL(next) : buildVideoUrl(video));
                }}
              />
              <Button onClick={handleSave} disabled={!file || saving} size="sm">
                {saving ? "Saving…" : "Save video"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
