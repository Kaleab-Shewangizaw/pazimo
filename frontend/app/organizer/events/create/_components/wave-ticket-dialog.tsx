"use client";

import { Plus, Trash2, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DatePickerInput } from "./date-picker-input";
import { FieldGroup, FieldHint } from "./field-group";
import type { WaveDraft } from "../_lib/event-form-types";
import { WAVE_SWITCH_MODES } from "../_lib/event-form-utils";

interface WaveTicketDialogProps {
  open: boolean;
  waveDrafts: WaveDraft[];
  onOpenChange: (open: boolean) => void;
  onAddWaveDraft: () => void;
  onRemoveWaveDraft: (waveId: string) => void;
  onUpdateWaveDraft: (
    waveId: string,
    field: keyof WaveDraft,
    value: string,
  ) => void;
  onSubmit: () => void;
}

export function WaveTicketDialog({
  open,
  waveDrafts,
  onOpenChange,
  onAddWaveDraft,
  onRemoveWaveDraft,
  onUpdateWaveDraft,
  onSubmit,
}: WaveTicketDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-[28px] border-slate-200 dark:border-slate-800 p-4 sm:p-6">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-950 dark:text-white">
            <Waves className="h-5 w-5 text-sky-700 dark:text-sky-400" />
            Wave Tickets
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Wave 1 is the default live ticket. Each later wave replaces the previous one by date or sell-out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Wave sequence</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Wave 1 opens the chain. Every next wave takes over when its trigger is met.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddWaveDraft}
              className="rounded-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add wave
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {waveDrafts.map((wave, index) => (
              <span
                key={`wave-pill-${wave.id}`}
                className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {index + 1}. {wave.name.trim() || `Wave ${index + 1}`}
              </span>
            ))}
          </div>

          <div className="space-y-4">
            {waveDrafts.map((wave, index) => (
              <div
                key={wave.id}
                className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <p className="text-base font-semibold text-slate-950 dark:text-white">
                      Wave {index + 1}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {index === 0
                        ? "Default active wave for this ticket type."
                        : index < waveDrafts.length - 1
                          ? "Replaces the previous wave when its trigger is met."
                          : "Final wave in the sequence."}
                    </p>
                  </div>
                  {index > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-800 dark:hover:text-rose-300"
                      onClick={() => onRemoveWaveDraft(wave.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup>
                      <Label>Wave name</Label>
                      <Input
                        value={wave.name}
                        onChange={(e) =>
                          onUpdateWaveDraft(wave.id, "name", e.target.value)
                        }
                        placeholder="Early Bird"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </FieldGroup>

                    {index > 0 ? (
                      <FieldGroup>
                        <Label>Activation type</Label>
                        <Select
                          value={wave.waveSwitchMode}
                          onValueChange={(value) =>
                            onUpdateWaveDraft(wave.id, "waveSwitchMode", value)
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {WAVE_SWITCH_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                    ) : (
                      <FieldGroup>
                        <Label>Activation</Label>
                        <div className="flex h-11 items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 text-sm text-slate-600 dark:text-slate-300">
                          Always active until the next wave replaces it
                        </div>
                      </FieldGroup>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldGroup>
                      <Label>Price (ETB)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wave.priceETB}
                        onChange={(e) =>
                          onUpdateWaveDraft(wave.id, "priceETB", e.target.value)
                        }
                        placeholder="500"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <Label>Price (USD)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wave.priceUSD}
                        onChange={(e) =>
                          onUpdateWaveDraft(wave.id, "priceUSD", e.target.value)
                        }
                        placeholder="15"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={wave.quantity}
                        onChange={(e) =>
                          onUpdateWaveDraft(wave.id, "quantity", e.target.value)
                        }
                        placeholder="100"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </FieldGroup>
                  </div>

                  <FieldGroup>
                    <Label>Description</Label>
                    <Input
                      value={wave.description}
                      onChange={(e) =>
                        onUpdateWaveDraft(wave.id, "description", e.target.value)
                      }
                      placeholder="Optional description for this wave"
                      className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                    />
                  </FieldGroup>

                  {index > 0 && wave.waveSwitchMode !== "quantity" ? (
                    <FieldGroup>
                      <Label>Activation date</Label>
                      <DatePickerInput
                        value={wave.saleStartDate}
                        onChange={(value) =>
                          onUpdateWaveDraft(wave.id, "saleStartDate", value)
                        }
                        placeholder="Choose the replacement date"
                      />
                    </FieldGroup>
                  ) : null}

                  {index > 0 && wave.waveSwitchMode === "quantity" ? (
                    <FieldHint>
                      This wave becomes active when the previous wave sells out.
                    </FieldHint>
                  ) : null}                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl border-slate-200 dark:border-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            className="rounded-2xl bg-sky-600 hover:bg-sky-700"
          >
            Save wave tickets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
