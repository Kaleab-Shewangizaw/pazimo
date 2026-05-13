"use client";

import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/rsvp-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuestionType, Question } from "@/lib/rsvp-types";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  CircleDot,
  ListChecks,
  ChevronDown as Caret,
  Phone,
  Mail,
  Upload,
  CalendarDays,
  Star,
  Smile,
  Gauge,
  ToggleLeft,
  ArrowLeft,
  Eye,
  Settings as SettingsIcon,
  GripVertical,
  Layers,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const QTYPES: {
  id: QuestionType;
  label: string;
  icon: any;
  group: "rsvp" | "review" | "both";
}[] = [
  { id: "short_text", label: "Short text", icon: Type, group: "both" },
  { id: "long_text", label: "Long text", icon: AlignLeft, group: "both" },
  { id: "single_choice", label: "Multiple choice", icon: CircleDot, group: "both" },
  { id: "multi_choice", label: "Checkboxes", icon: ListChecks, group: "both" },
  { id: "dropdown", label: "Dropdown", icon: Caret, group: "both" },
  { id: "phone", label: "Phone", icon: Phone, group: "rsvp" },
  { id: "email", label: "Email", icon: Mail, group: "rsvp" },
  { id: "file", label: "File upload", icon: Upload, group: "rsvp" },
  { id: "date", label: "Date", icon: CalendarDays, group: "rsvp" },
  { id: "rating", label: "Star rating", icon: Star, group: "review" },
  { id: "emoji", label: "Emoji reaction", icon: Smile, group: "review" },
  { id: "nps", label: "NPS (0–10)", icon: Gauge, group: "review" },
  { id: "yes_no", label: "Yes / No", icon: ToggleLeft, group: "review" },
];

export default function Builder() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const event = useStore((s) => s.events.find((e) => e.id === id));
  const loadEvent = useStore((s) => s.loadEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const addQuestion = useStore((s) => s.addQuestion);
  const updateQuestion = useStore((s) => s.updateQuestion);
  const deleteQuestion = useStore((s) => s.deleteQuestion);
  const reorderQuestion = useStore((s) => s.reorderQuestion);
  const addSection = useStore((s) => s.addSection);
  const updateSection = useStore((s) => s.updateSection);
  const deleteSection = useStore((s) => s.deleteSection);
  const addOption = useStore((s) => s.addOption);
  const deleteOption = useStore((s) => s.deleteOption);
  const [activeSection, setActiveSection] = useState<string>("");
  const [loading, setLoading] = useState(!event);

  useEffect(() => {
    if (!event && id) {
      setLoading(true);
      void loadEvent(id)
        .catch(() => toast.error("Failed to load form"))
        .finally(() => setLoading(false));
    }
  }, [event, id, loadEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading form…</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container py-20 text-center">
          <p className="text-slate-600 dark:text-slate-400">Event not found.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link href="/organizer/rsvp-builder">Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentSection = activeSection || event.sections[0]?.id;
  const allowedTypes = QTYPES.filter(
    (t) => t.group === "both" || t.group === event.type
  );
  const previousNumeric = event.questions.filter((q) =>
    ["rating", "nps"].includes(q.type)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container mx-auto px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              onClick={async () => {
                const emptyQs = event.questions.filter((q) => !q.label.trim());
                if (emptyQs.length > 0) {
                  toast.info(`Note: ${emptyQs.length} question(s) were missing titles. They have been set to "Untitled Question" for the live form.`);
                  // Update empty questions in the store (which will sync to backend)
                  for (const q of emptyQs) {
                    await updateQuestion(event.id, q.id, { label: "Untitled Question" });
                  }
                }
                
                // Always ensure status is published when explicitly saving
                await updateEvent(event.id, { status: "published" });
                toast.success("Form saved and published successfully");
              }}
              variant="default"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95"
            >
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link 
                href={event.type === 'review' 
                  ? `/review-form/${event.publicId || event.id}?preview=true&id=${event.id}` 
                  : `/rsvp-form/${event.publicId || event.id}?preview=true&id=${event.id}`
                }
              >
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: builder */}
          <div className="space-y-6">
            <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
              <Input
                value={event.name}
                onChange={(e) => updateEvent(event.id, { name: e.target.value })}
                className="border-0 bg-transparent px-0 text-3xl md:text-4xl font-semibold h-auto focus-visible:ring-0 shadow-none text-slate-900 dark:text-white"
              />
              <Textarea
                value={event.description || ""}
                onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                placeholder="Add a short description for attendees…"
                className="mt-3 border-0 bg-transparent px-0 resize-none focus-visible:ring-0 shadow-none text-slate-600 dark:text-slate-400"
                rows={2}
              />
            </Card>

            {/* Sections tabs */}
            <Tabs value={currentSection} onValueChange={setActiveSection}>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <TabsList className="rounded-full bg-slate-100 dark:bg-slate-700/50 p-1 h-auto flex-wrap">
                  {event.sections.map((s) => (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      className="rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4"
                    >
                      <Layers className="mr-1.5 h-3 w-3" /> {s.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full shrink-0"
                  onClick={() => addSection(event.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Section
                </Button>
              </div>

              {event.sections.map((section) => (
                <TabsContent key={section.id} value={section.id} className="mt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <SectionTitleEditor
                      initialValue={section.title}
                      onSave={(newTitle) => updateSection(event.id, section.id, { title: newTitle })}
                    />
                    {event.sections.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full text-red-600 dark:text-red-400"
                        onClick={() => deleteSection(event.id, section.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <AnimatePresence mode="popLayout">
                    {event.questions
                      .filter((q) => q.sectionId === section.id)
                      .map((q, i) => (
                        <motion.div
                          key={q.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                        >
                          <QuestionCard
                            q={q}
                            index={i}
                            onPatch={(p) => updateQuestion(event.id, q.id, p)}
                            onDelete={() => deleteQuestion(event.id, q.id)}
                            onMove={(d) => reorderQuestion(event.id, q.id, d)}
                            onAddOption={() => addOption(event.id, q.id)}
                            onDeleteOption={(idx) => deleteOption(event.id, q.id, idx)}
                            previousNumeric={previousNumeric.filter((p) => p.id !== q.id)}
                          />
                        </motion.div>
                      ))}
                  </AnimatePresence>

                  {/* Add question palette */}
                  <Card className="rounded-2xl border-dashed border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 p-5">
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Add a question
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {allowedTypes.map((t) => (
                        <Button
                          key={t.id}
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            addQuestion(event.id, section.id, t.id);
                            toast.success(`Added ${t.label}`);
                          }}
                        >
                          <t.icon className="mr-1.5 h-3.5 w-3.5" /> {t.label}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Right: settings panel */}
          <Card className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm border border-slate-200 dark:border-slate-700 lg:sticky lg:top-24 h-fit">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <Label className="text-sm text-slate-900 dark:text-white">
                  Cover image
                </Label>
                <div className="mt-1.5 space-y-3">
                  {event.coverImage && (
                    <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 aspect-video bg-slate-100 dark:bg-slate-700">
                      <img
                        src={typeof event.coverImage === "string" && event.coverImage.startsWith("data:") ? event.coverImage : event.coverImage}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          updateEvent(event.id, { coverImage: ev.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-slate-900 dark:text-white">
                  Hosted by
                </Label>
                <Input
                  value={event.hostedBy || ""}
                  onChange={(e) =>
                    updateEvent(event.id, { hostedBy: e.target.value })
                  }
                  className="mt-1.5 h-10 rounded-lg"
                />
              </div>

              {event.type === "rsvp" && (
                <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-slate-900 dark:text-white">Date</Label>
                  <Input
                    type="date"
                    value={event.date || ""}
                    onChange={(e) => updateEvent(event.id, { date: e.target.value })}
                    className="mt-1.5 h-10 rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-sm text-slate-900 dark:text-white">
                    Start time
                  </Label>
                  <Input
                    type="time"
                    value={event.startTime || ""}
                    onChange={(e) =>
                      updateEvent(event.id, { startTime: e.target.value })
                    }
                    className="mt-1.5 h-10 rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-sm text-slate-900 dark:text-white">
                    End time
                  </Label>
                  <Input
                    type="time"
                    value={event.endTime || ""}
                    onChange={(e) =>
                      updateEvent(event.id, { endTime: e.target.value })
                    }
                    className="mt-1.5 h-10 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-slate-900 dark:text-white">
                  Location
                </Label>
                <Input
                  value={event.location || ""}
                  onChange={(e) =>
                    updateEvent(event.id, { location: e.target.value })
                  }
                  placeholder="Address"
                  className="mt-1.5 h-10 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-sm text-slate-900 dark:text-white">
                  Venue / area
                </Label>
                <Input
                  value={event.venue || ""}
                  onChange={(e) =>
                    updateEvent(event.id, { venue: e.target.value })
                  }
                  placeholder="Neighborhood, city"
                  className="mt-1.5 h-10 rounded-lg"
                />
              </div>

                  <div>
                    <Label className="text-sm text-slate-900 dark:text-white">
                      RSVP limit
                    </Label>
                    <Input
                      type="number"
                      value={event.rsvpLimit ?? ""}
                      onChange={(e) =>
                        updateEvent(event.id, {
                          rsvpLimit: Number(e.target.value) || undefined,
                        })
                      }
                      className="mt-1.5 h-10 rounded-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-900 dark:text-white">
                      Approval mode
                    </Label>
                    <Select
                      value={event.approvalMode}
                      onValueChange={(v: any) =>
                        updateEvent(event.id, { approvalMode: v })
                      }
                    >
                      <SelectTrigger className="mt-1.5 h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatic — instant RSVP</SelectItem>
                        <SelectItem value="manual">Manual — organizer reviews</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-slate-50 dark:bg-slate-700/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-slate-900 dark:text-white">
                          Require payment after RSVP
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Tickets issue after payment.
                        </p>
                      </div>
                      <Switch
                        checked={!!event.payment?.enabled}
                        onCheckedChange={(v) =>
                          updateEvent(event.id, {
                            payment: {
                              ...(event.payment || {
                                price: 0,
                                currency: "USD",
                              }),
                              enabled: v,
                            },
                          })
                        }
                      />
                    </div>

                    <AnimatePresence>
                      {event.payment?.enabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-slate-900 dark:text-white">
                                Price
                              </Label>
                              <Input
                                type="number"
                                value={event.payment.price}
                                onChange={(e) =>
                                  updateEvent(event.id, {
                                    payment: {
                                      ...event.payment!,
                                      price: Number(e.target.value),
                                    },
                                  })
                                }
                                className="mt-1 h-10 rounded-lg"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-900 dark:text-white">
                                Currency
                              </Label>
                              <Select
                                value={event.payment.currency}
                                onValueChange={(v) =>
                                  updateEvent(event.id, {
                                    payment: {
                                      ...event.payment!,
                                      currency: v,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1 h-10 rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["USD", "EUR", "GBP", "AED", "SAR", "INR", "ETB"].map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-slate-900 dark:text-white">
                                Payment deadline
                              </Label>
                              <Input
                                type="date"
                                value={event.payment.deadline || ""}
                                onChange={(e) =>
                                  updateEvent(event.id, {
                                    payment: {
                                      ...event.payment!,
                                      deadline: e.target.value,
                                    },
                                  })
                                }
                                className="mt-1 h-10 rounded-lg"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
                )}

              {event.type === "review" && (
                <>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium text-slate-900 dark:text-white">
                        Anonymous responses
                      </Label>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Hide attendee identity.
                      </p>
                    </div>
                    <Switch
                      checked={!!event.anonymous}
                      onCheckedChange={(v) =>
                        updateEvent(event.id, { anonymous: v })
                      }
                    />
                  </div>

                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-300">
                      Conditional logic
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 text-xs">
                      Add a Long Text question and set its condition to a previous
                      Rating or NPS question to ask follow-ups only when needed.
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
        </div>
      </main>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  onPatch,
  onDelete,
  onMove,
  onAddOption,
  onDeleteOption,
  previousNumeric,
}: {
  q: Question;
  index: number;
  onPatch: (p: Partial<Question>) => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
  onAddOption: () => void;
  onDeleteOption: (idx: number) => void;
  previousNumeric: Question[];
}) {
  const [localLabel, setLocalLabel] = useState(q.label);
  
  useEffect(() => {
    setLocalLabel(q.label);
  }, [q.label]);

  const needsOptions =
    q.type === "single_choice" ||
    q.type === "multi_choice" ||
    q.type === "dropdown";
  const Icon = QTYPES.find((t) => t.id === q.type)?.icon || Type;

  return (
    <Card className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            onClick={() => onMove(-1)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <GripVertical className="h-4 w-4 text-slate-400 dark:text-slate-600" />
          <button
            onClick={() => onMove(1)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Icon className="h-3.5 w-3.5" />
            <span>
              Question {index + 1} · {QTYPES.find((t) => t.id === q.type)?.label}
            </span>
          </div>
          <Input
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => {
              if (localLabel !== q.label) {
                onPatch({ label: localLabel });
              }
            }}
            placeholder="Untitled Question"
            className="h-11 rounded-lg text-base font-medium text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 focus-visible:ring-blue-500"
          />

          {needsOptions && (
            <div className="space-y-2">
              {(q.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <OptionEditor
                    index={i}
                    initialValue={opt}
                    onSave={(newVal) => {
                      const next = [...(q.options || [])];
                      next[i] = newVal;
                      onPatch({ options: next });
                    }}
                    onDelete={() => onDeleteOption(i)}
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full h-8 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={onAddOption}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add option
              </Button>
            </div>
          )}

          {/* Conditional logic for review */}
          {q.type === "long_text" && previousNumeric.length > 0 && (
            <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3 text-xs space-y-2">
              <div className="font-medium text-slate-900 dark:text-white">Show only when…</div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={q.conditional?.questionId || "none"}
                  onValueChange={(v) =>
                    onPatch({
                      conditional:
                        v === "none"
                          ? undefined
                          : {
                              questionId: v,
                              operator: q.conditional?.operator || "lt",
                              value: q.conditional?.value ?? 3,
                            },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-44 rounded-lg text-xs border border-slate-300 dark:border-slate-600">
                    <SelectValue placeholder="No condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No condition</SelectItem>
                    {previousNumeric.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {q.conditional && (
                  <>
                    <Select
                      value={q.conditional.operator}
                      onValueChange={(v: any) =>
                        onPatch({
                          conditional: { ...q.conditional!, operator: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-20 rounded-lg text-xs border border-slate-300 dark:border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lt">&lt;</SelectItem>
                        <SelectItem value="eq">=</SelectItem>
                        <SelectItem value="gt">&gt;</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={q.conditional.value as number}
                      onChange={(e) =>
                        onPatch({
                          conditional: {
                            ...q.conditional!,
                            value: Number(e.target.value),
                          },
                        })
                      }
                      className="h-8 w-20 rounded-lg text-xs border border-slate-300 dark:border-slate-600"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={q.required}
                onCheckedChange={(v) => onPatch({ required: v })}
                id={`req-${q.id}`}
              />
              <Label htmlFor={`req-${q.id}`} className="text-xs text-slate-700 dark:text-slate-300">
                Required
              </Label>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
function SectionTitleEditor({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (val: string) => void;
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <Input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val.trim() !== initialValue) {
          onSave(val.trim());
        }
      }}
      placeholder="Section title"
      className="h-10 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 max-w-sm font-semibold"
    />
  );
}
function OptionEditor({
  index,
  initialValue,
  onSave,
  onDelete,
}: {
  index: number;
  initialValue: string;
  onSave: (val: string) => void;
  onDelete: () => void;
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <>
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val !== initialValue) {
            onSave(val);
          }
        }}
        placeholder={`Option ${index + 1}`}
        className="h-9 rounded-lg border border-slate-200 dark:border-slate-600"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
