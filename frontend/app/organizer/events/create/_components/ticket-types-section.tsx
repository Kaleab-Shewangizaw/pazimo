import { AlertCircle, DollarSign, Plus, Trash2, Waves } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { EventFormSection } from "./event-form-section";
import { FieldGroup, FieldHint } from "./field-group";
import type { TicketType, VisibleTicketEntry } from "../_lib/event-form-types";
import {
  formatDateWindow,
  formatWaveActivationSummary,
  formatTicketPrice,
} from "../_lib/event-form-utils";

interface TicketTypesSectionProps {
  currentDate: string;
  waveValidationError: string;
  hasMultipleDateRangedTickets: boolean;
  waveTickets: TicketType[];
  regularDateTickets: TicketType[];
  visibleTickets: VisibleTicketEntry[];
  onAddTicketType: () => void;
  onRemoveTicketType: (index: number) => void;
  onTicketTypeChange: (index: number, field: keyof TicketType, value: string | boolean) => void;
  onOpenWaveDialog: (index: number) => void;
}

export function TicketTypesSection({
  currentDate,
  waveValidationError,
  hasMultipleDateRangedTickets,
  waveTickets,
  regularDateTickets,
  visibleTickets,
  onAddTicketType,
  onRemoveTicketType,
  onTicketTypeChange,
  onOpenWaveDialog,
}: TicketTypesSectionProps) {
  return (
    <div id="tickets" className="space-y-5">
      {hasMultipleDateRangedTickets ? (
        <Alert className="rounded-[24px] border-sky-200 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/30 px-4 py-4 shadow-sm">
          <AlertCircle className="h-4 w-4 text-sky-700 dark:text-sky-400" />
          <AlertDescription className="space-y-1 text-sky-900 dark:text-sky-200">
            <p className="text-sm font-semibold">Timed ticket system is active</p>
            <p className="text-sm leading-6 text-sky-800 dark:text-sky-300">
              Reference date: {currentDate}. Each timed ticket needs a unique price, and each wave must hand off cleanly to the next.
            </p>
            {waveValidationError ? (
              <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{waveValidationError}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {hasMultipleDateRangedTickets ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-sky-100 dark:border-sky-900/60 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-sky-700 dark:text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Wave chain comparison</h3>
            </div>
            <div className="grid gap-3">
              {waveTickets.map((ticket, idx) => (
                <div
                  key={ticket._id || `wave-ticket-${idx}`}
                  className="rounded-2xl border border-sky-100 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/30 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                      {ticket.name || `Wave chain ${idx + 1}`}
                    </p>
                    <Badge className="rounded-full bg-white dark:bg-slate-900 text-sky-800 dark:text-sky-300 hover:bg-white dark:hover:bg-slate-800">
                      {(ticket.waves?.[1]?.waveSwitchMode || "date").toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {formatTicketPrice(ticket)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {ticket.waves && ticket.waves.length > 0
                      ? formatWaveActivationSummary(ticket.waves[0], 0)
                      : null}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-100 dark:border-emerald-900/60 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Timed regular tickets</h3>
            </div>
            <div className="grid gap-3">
              {regularDateTickets.map((ticket, idx) => (
                <div
                  key={`regular-timed-${idx}`}
                  className="rounded-2xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-3"
                >
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Regular ticket {idx + 1}
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {formatTicketPrice(ticket)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateWindow(ticket.saleStartDate, ticket.saleEndDate)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <EventFormSection
        id="tickets-panel"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={onAddTicketType}
            className="rounded-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add ticket type
          </Button>
        }
      >
        <div className="space-y-4">
          {visibleTickets.map(({ ticket, index }, visibleIndex) => {
            const isWaveParent = Boolean(ticket.waves && ticket.waves.length > 0);
            const childWaves = isWaveParent ? ticket.waves!.slice(1) : [];
            const showStatus = isWaveParent || (ticket.name === "Regular" && ticket.hasDateRange);

            return (
              <div
                key={`ticket-${index}`}
                className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                        {isWaveParent
                          ? `Wave chain: ${ticket.name}`
                          : `Ticket Type ${visibleIndex + 1}`}
                      </h3>
                      {showStatus ? (
                        <Badge
                          className={
                            ticket.isActive
                              ? "rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                              : "rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                          }
                        >
                          {ticket.isActive ? "Active" : "Inactive"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isWaveParent
                        ? "This ticket is the default live wave until a later wave replaces it."
                        : "Choose a ticket type and pricing for this audience segment."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-sky-200 dark:border-sky-900/60 bg-white dark:bg-slate-900 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                      onClick={() => onOpenWaveDialog(index)}
                    >
                      <Waves className="mr-2 h-4 w-4" />
                      {isWaveParent ? "Manage waves" : "Create waves"}
                    </Button>
                    {index > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full px-3 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-800 dark:hover:text-rose-300"
                        onClick={() => onRemoveTicketType(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <FieldGroup>
                      <Label htmlFor={`ticket-name-${index}`}>Name</Label>
                      <Input
                        id={`ticket-name-${index}`}
                        value={ticket.name}
                        onChange={(e) =>
                          onTicketTypeChange(index, "name", e.target.value)
                        }
                        readOnly={isWaveParent}
                        placeholder={isWaveParent ? "Wave name" : "e.g. Regular, VIP, VVIP, Gold…"}
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 read-only:bg-slate-50 dark:read-only:bg-slate-800/60 read-only:text-slate-500"
                      />
                      {isWaveParent ? (
                        <FieldHint>Current wave's name — edit it via "Manage waves".</FieldHint>
                      ) : null}
                    </FieldGroup>

                    <FieldGroup>
                      <Label htmlFor={`ticket-quantity-${index}`}>Quantity available</Label>
                      <Input
                        id={`ticket-quantity-${index}`}
                        type="number"
                        min="0"
                        value={ticket.quantity}
                        onChange={(e) =>
                          onTicketTypeChange(index, "quantity", e.target.value)
                        }
                        readOnly={isWaveParent}
                        placeholder="250"
                        required
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 read-only:bg-slate-50 dark:read-only:bg-slate-800/60 read-only:text-slate-500"
                      />
                      {isWaveParent ? (
                        <FieldHint>Current wave's remaining stock — set starting quantity via "Manage waves".</FieldHint>
                      ) : null}
                    </FieldGroup>
                  </div>

                  {(isWaveParent || childWaves.length > 0) ? (
                    <div className="rounded-[20px] border border-sky-100 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">Wave chain</p>
                          <p className="text-xs text-sky-800 dark:text-sky-300">
                            {1 + childWaves.length} waves in sequence
                          </p>
                        </div>
                        <Badge className="rounded-full bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 hover:bg-white dark:hover:bg-slate-800">
                          {ticket.waves?.[1]?.waveSwitchMode || "date"}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                          Wave 1: {ticket.waves?.[0]?.name || ticket.name} • Default active wave
                        </div>
                        {childWaves.map((wave, childIndex) => (
                          <div
                            key={wave.id}
                            className="rounded-2xl bg-white/80 dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
                          >
                            {wave.name || `Wave ${childIndex + 2}`} •{" "}
                            {formatWaveActivationSummary(wave, childIndex + 1)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup>
                      <Label htmlFor={`ticket-price-etb-${index}`}>Price (ETB)</Label>
                      <Input
                        id={`ticket-price-etb-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={ticket.priceETB}
                        onChange={(e) =>
                          onTicketTypeChange(index, "priceETB", e.target.value)
                        }
                        readOnly={isWaveParent}
                        placeholder="750"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 read-only:bg-slate-50 dark:read-only:bg-slate-800/60 read-only:text-slate-500"
                      />
                      <FieldHint>
                        {isWaveParent
                          ? "Current wave's price — edit it via \"Manage waves\"."
                          : "Leave empty only if you are selling exclusively in USD."}
                      </FieldHint>
                    </FieldGroup>

                    <FieldGroup>
                      <Label htmlFor={`ticket-price-usd-${index}`}>Price (USD)</Label>
                      <Input
                        id={`ticket-price-usd-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={ticket.priceUSD}
                        onChange={(e) =>
                          onTicketTypeChange(index, "priceUSD", e.target.value)
                        }
                        readOnly={isWaveParent}
                        placeholder="20"
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 read-only:bg-slate-50 dark:read-only:bg-slate-800/60 read-only:text-slate-500"
                      />
                      <FieldHint>
                        {isWaveParent
                          ? "Current wave's price — edit it via \"Manage waves\"."
                          : "Optional alternate currency for checkout."}
                      </FieldHint>
                    </FieldGroup>
                  </div>

                  <FieldGroup>
                    <Label htmlFor={`ticket-description-${index}`}>Description</Label>
                    <Textarea
                      id={`ticket-description-${index}`}
                      value={ticket.description}
                      onChange={(e) =>
                        onTicketTypeChange(index, "description", e.target.value)
                      }
                      placeholder="What does this ticket include?"
                      className="min-h-28 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    />
                  </FieldGroup>
                </div>
              </div>
            );
          })}
        </div>
      </EventFormSection>
    </div>
  );
}
