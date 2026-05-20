"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { rsvpApi, resolveRsvpImageUrl } from "@/lib/rsvp-api";
import type { RsvpEvent, Response as RsvpResponse } from "@/lib/rsvp-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Copy,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  ToggleLeft,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const emptyDraft = (form?: RsvpEvent | null): RsvpEvent => ({
  id: form?.id || "",
  publicId: form?.publicId,
  name: form?.name || "",
  description: form?.description || "",
  type: form?.type || "rsvp",
  status: form?.status || "draft",
  coverImage: form?.coverImage || "",
  date: form?.date || "",
  hostedBy: form?.hostedBy || "",
  startTime: form?.startTime || "",
  endTime: form?.endTime || "",
  location: form?.location || "",
  venue: form?.venue || "",
  rsvpLimit: form?.rsvpLimit,
  approvalMode: form?.approvalMode || "auto",
  payment: form?.payment,
  anonymous: !!form?.anonymous,
  sections: form?.sections || [],
  questions: form?.questions || [],
  createdAt: form?.createdAt || new Date().toISOString(),
  updatedAt: form?.updatedAt || new Date().toISOString(),
  publishedAt: form?.publishedAt,
  archivedAt: form?.archivedAt,
  responseCount: form?.responseCount,
  shareUrl: form?.shareUrl,
});

export default function AdminRsvpPage() {
  const { token } = useAdminAuthStore();
  const [forms, setForms] = useState<RsvpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<RsvpEvent | null>(null);
  const [draft, setDraft] = useState<RsvpEvent>(emptyDraft());
  const [responses, setResponses] = useState<RsvpResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  const fetchForms = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await rsvpApi.getForms();
      setForms(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load RSVP forms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchForms();
  }, [token]);

  const filteredForms = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();
    return forms.filter((form) => {
      const matchesSearch =
        !lowerQuery ||
        form.name.toLowerCase().includes(lowerQuery) ||
        (form.description || "").toLowerCase().includes(lowerQuery);
      const matchesStatus = statusFilter === "all" || form.status === statusFilter;
      const matchesType = typeFilter === "all" || form.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [forms, searchQuery, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const published = forms.filter((form) => form.status === "published").length;
    const drafts = forms.filter((form) => form.status === "draft").length;
    const totalResponses = forms.reduce((sum, form) => sum + (form.responseCount || 0), 0);
    return { total: forms.length, published, drafts, totalResponses };
  }, [forms]);

  const openEdit = (form: RsvpEvent) => {
    setActiveForm(form);
    setDraft(emptyDraft(form));
    setEditOpen(true);
  };

  const openResponses = async (form: RsvpEvent) => {
    setActiveForm(form);
    setResponses([]);
    setResponsesOpen(true);
    try {
      setResponsesLoading(true);
      const data = await rsvpApi.getResponses(form.id);
      setResponses(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load responses");
    } finally {
      setResponsesLoading(false);
    }
  };

  const saveForm = async () => {
    if (!activeForm) return;
    try {
      setSaving(true);
      const saved = await rsvpApi.updateForm(activeForm.id, draft);
      setForms((current) => current.map((form) => (form.id === saved.id ? saved : form)));
      setActiveForm(saved);
      setDraft(emptyDraft(saved));
      setEditOpen(false);
      toast.success("RSVP form updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update RSVP form");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (form: RsvpEvent) => {
    try {
      const saved = await rsvpApi.publishForm(form.id, form.status !== "published");
      setForms((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      toast.success(saved.status === "published" ? "RSVP form published" : "RSVP form unpublished");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update publish state");
    }
  };

  const copyLink = async (form: RsvpEvent) => {
    const url = `${window.location.origin}/${form.type === "review" ? "review-form" : "rsvp-form"}/${form.publicId || form.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Public link copied");
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-600">Admin RSVP</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Manage RSVP forms</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Review every RSVP form, edit the details, and publish the ones you want to surface on the home page.
          </p>
        </div>
        <Button onClick={() => void fetchForms()} className="rounded-full">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total forms", value: stats.total, icon: ClipboardList },
          { label: "Published", value: stats.published, icon: Sparkles },
          { label: "Drafts", value: stats.drafts, icon: ToggleLeft },
          { label: "Responses", value: stats.totalResponses, icon: Users },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl border border-gray-200 shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{item.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border border-gray-200 shadow-sm">
        <CardHeader className="space-y-4 border-b border-gray-200 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-xl">All RSVP forms</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search RSVP forms"
                  className="h-11 rounded-full pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 rounded-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 rounded-full sm:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="rsvp">RSVP</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading RSVP forms
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center text-gray-500">
              <ClipboardList className="h-10 w-10 text-gray-300" />
              <p className="mt-4 text-lg font-medium text-gray-900">No RSVP forms found</p>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                Create a form from the organizer builder, then publish it here for the home page.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-b-3xl border-t border-gray-200">
              <div className="grid grid-cols-1 divide-y divide-gray-200">
                {filteredForms.map((form) => {
                  const imageUrl = resolveRsvpImageUrl(form.coverImage);
                  return (
                    <div key={form.id} className="grid gap-4 p-5 lg:grid-cols-[1.3fr_0.8fr_0.7fr_auto] lg:items-center">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-24 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt={form.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600">
                              <ClipboardList className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-gray-900">{form.name}</h3>
                            <Badge variant="secondary" className="rounded-full uppercase tracking-wide">
                              {form.type === "review" ? "Review" : "RSVP"}
                            </Badge>
                            <Badge
                              className={`rounded-full uppercase tracking-wide ${
                                form.status === "published"
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : form.status === "draft"
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {form.status}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                            {form.description || "No description provided."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                            <span>{form.questions.length} questions</span>
                            <span>{form.responseCount || 0} responses</span>
                            <span>{form.publishedAt ? `Published ${new Date(form.publishedAt).toLocaleDateString()}` : "Not published"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900">{form.date || "No date set"}</p>
                        <p>{form.location || form.venue || "No location set"}</p>
                        <p>{form.hostedBy || "Unassigned"}</p>
                      </div>

                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900">{form.approvalMode === "manual" ? "Manual approval" : "Auto approval"}</p>
                        <p>{form.rsvpLimit ? `${form.rsvpLimit} RSVP limit` : "No RSVP limit"}</p>
                        <p>{form.anonymous ? "Anonymous enabled" : "Named responses"}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEdit(form)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="secondary" size="sm" className="rounded-full" onClick={() => openResponses(form)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Responses
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => togglePublish(form)}>
                          <Sparkles className="mr-1 h-3.5 w-3.5" /> {form.status === "published" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => copyLink(form)}>
                          <Copy className="mr-1 h-3.5 w-3.5" /> Link
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit RSVP form</DialogTitle>
            <DialogDescription>
              Update the form details and publish state from one place.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-900">Title</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-900">Description</label>
              <Textarea
                value={draft.description || ""}
                onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                className="mt-2 min-h-28 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Type</label>
              <Select value={draft.type} onValueChange={(value) => setDraft((current) => ({ ...current, type: value as RsvpEvent["type"] }))}>
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rsvp">RSVP</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Status</label>
              <Select value={draft.status || "draft"} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as RsvpEvent["status"] }))}>
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Date</label>
              <Input
                value={draft.date || ""}
                onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
                placeholder="2026-05-19"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Hosted by</label>
              <Input
                value={draft.hostedBy || ""}
                onChange={(e) => setDraft((current) => ({ ...current, hostedBy: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Location</label>
              <Input
                value={draft.location || ""}
                onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Venue</label>
              <Input
                value={draft.venue || ""}
                onChange={(e) => setDraft((current) => ({ ...current, venue: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Start time</label>
              <Input
                value={draft.startTime || ""}
                onChange={(e) => setDraft((current) => ({ ...current, startTime: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">End time</label>
              <Input
                value={draft.endTime || ""}
                onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">RSVP limit</label>
              <Input
                value={draft.rsvpLimit ?? ""}
                onChange={(e) => setDraft((current) => ({ ...current, rsvpLimit: e.target.value ? Number(e.target.value) : undefined }))}
                className="mt-2 h-11 rounded-xl"
                type="number"
                min={0}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Approval mode</label>
              <Select value={draft.approvalMode} onValueChange={(value) => setDraft((current) => ({ ...current, approvalMode: value as RsvpEvent["approvalMode"] }))}>
                <SelectTrigger className="mt-2 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-900">Cover image URL</label>
              <Input
                value={draft.coverImage || ""}
                onChange={(e) => setDraft((current) => ({ ...current, coverImage: e.target.value }))}
                className="mt-2 h-11 rounded-xl"
                placeholder="/uploads/... or https://..."
              />
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void saveForm()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={responsesOpen} onOpenChange={setResponsesOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>RSVP responses</DialogTitle>
            <DialogDescription>
              View every submitted response for the selected form.
            </DialogDescription>
          </DialogHeader>
          {responsesLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading responses
            </div>
          ) : responses.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No responses yet.</div>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => (
                <div key={response.id} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">{response.status}</Badge>
                    {response.tag ? <Badge className="rounded-full">{response.tag}</Badge> : null}
                    <span className="text-sm text-gray-500">{new Date(response.submittedAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    {Object.entries(response.answers || {}).slice(0, 4).map(([key, value]) => (
                      <p key={key} className="truncate">
                        <span className="font-medium text-gray-900">{key}:</span> {Array.isArray(value) ? value.join(", ") : String(value)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
