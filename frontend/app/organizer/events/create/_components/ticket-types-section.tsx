import { AlertCircle, DollarSign, Plus, Trash2, Waves } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { EventFormSection } from "./event-form-section";
import { FieldGroup, FieldHint } from "./field-group";
import type { TicketType, VisibleTicketEntry } from "../_lib/event-form-types";
import {
  TICKET_TYPES,
  formatDateWindow,
  formatTicketPrice,
} from "../_lib/event-form-utils";

interface TicketTypesSectionProps {
  currentDate: string;
  waveValidationError: string;
  hasMultipleDateRangedTickets: boolean;
  waveTickets: TicketType[];
  regularDateTickets: TicketType[];
  visibleTickets: VisibleTicketEntry[];
  allTicketTypes: TicketType[];
  onAddTicketType: () => void;
  onRemoveTicketType: (index: number) => void;
  onTicketTypeChange: (index: number, field: keyof TicketType, value: string | boolean) => void;
  onOpenWaveDialog: (index: number) => void;
  getWaveChildren: (ticket: TicketType, ticketTypes: TicketType[]) => TicketType[];
}

export function TicketTypesSection({
  currentDate,
  waveValidationError,
  hasMultipleDateRangedTickets,
  waveTickets,
  regularDateTickets,
  visibleTickets,
  allTicketTypes,
  onAddTicketType,
  onRemoveTicketType,
  onTicketTypeChange,
  onOpenWaveDialog,
  getWaveChildren,
}: TicketTypesSectionProps) {
  return (
    <div id="tickets" className="space-y-5">
      {hasMultipleDateRangedTickets ? (
        <Alert className="rounded-[24px] border-sky-200 bg-sky-50/80 px-4 py-4 shadow-sm">
          <AlertCircle className="h-4 w-4 text-sky-700" />
          <AlertDescription className="space-y-1 text-sky-900">
            <p className="text-sm font-semibold">Timed ticket system is active</p>
            <p className="text-sm leading-6 text-sky-800">
              Reference date: {currentDate}. Each timed ticket needs a unique price, and each wave must hand off cleanly to the next.
            </p>
            {waveValidationError ? (
              <p className="text-sm font-medium text-rose-700">{waveValidationError}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {hasMultipleDateRangedTickets ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-sky-100 bg-white/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-sky-700" />
              <h3 className="text-sm font-semibold text-slate-900">Wave chain comparison</h3>
            </div>
            <div className="grid gap-3">
              {waveTickets.map((ticket, idx) => (
                <div
                  key={`${ticket.waveGroup || "wave"}-${ticket.waveOrder || idx}`}
                  className="rounded-2xl border border-sky-100 bg-sky-50/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-sky-950">
                      {ticket.name || `Wave ${idx + 1}`}
                    </p>
                    <Badge className="rounded-full bg-white text-sky-800 hover:bg-white">
                      {(ticket.waveSwitchMode || "date").toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {formatTicketPrice(ticket)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateWindow(ticket.saleStartDate, ticket.saleEndDate)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-white/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-900">Timed regular tickets</h3>
            </div>
            <div className="grid gap-3">
              {regularDateTickets.map((ticket, idx) => (
                <div
                  key={`regular-timed-${idx}`}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3"
                >
                  <p className="text-sm font-semibold text-emerald-950">
                    Regular ticket {idx + 1}
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {formatTicketPrice(ticket)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
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
            className="rounded-full border-slate-200 bg-white px-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add ticket type
          </Button>
        }
      >
        <div className="space-y-4">
          {visibleTickets.map(({ ticket, index }, visibleIndex) => {
            const childWaves = getWaveChildren(ticket, allTicketTypes);
            const isWaveParent = Number(ticket.waveOrder || 0) === 1 && Boolean(ticket.waveGroup);
            const showStatus = isWaveParent || (ticket.name === "Regular" && ticket.hasDateRange);

            return (
              <div
                key={`${index}-${ticket.waveGroup || ticket.name}`}
                className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">
                        {isWaveParent
                          ? `Wave 1: ${ticket.name}`
                          : `Ticket Type ${visibleIndex + 1}`}
                      </h3>
                      {showStatus ? (
                        <Badge
                          className={
                            ticket.isActive
                              ? "rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : "rounded-full bg-slate-200 text-slate-700 hover:bg-slate-200"
                          }
                        >
                          {ticket.isActive ? "Active" : "Inactive"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500">
                      {isWaveParent
                        ? "This ticket is the first entry in a wave chain."
                        : "Choose a ticket type and pricing for this audience segment."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
                      onClick={() => onOpenWaveDialog(index)}
                    >
                      <Waves className="mr-2 h-4 w-4" />
                      {childWaves.length > 0 || ticket.waveGroup ? "Manage waves" : "Create waves"}
                    </Button>
                    {index > 0 && !ticket.waveGroup ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full px-3 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
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
                      {isWaveParent ? (
                        <Input
                          id={`ticket-name-${index}`}
                          value={ticket.name}
                          onChange={(e) =>
                            onTicketTypeChange(index, "name", e.target.value)
                          }
                          placeholder="Wave name"
                          className="h-11 rounded-xl border-slate-200 bg-white"
                        />
                      ) : (
                        <Select
                          value={ticket.name}
                          onValueChange={(value) => onTicketTypeChange(index, "name", value)}
                        >
                          <SelectTrigger
                            id={`ticket-name-${index}`}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                          >
                            <SelectValue placeholder="Select ticket type" />
                          </SelectTrigger>
                          <SelectContent>
                            {TICKET_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
                        placeholder="250"
                        required
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                    </FieldGroup>
                  </div>

                  {(isWaveParent || childWaves.length > 0) ? (
                    <div className="rounded-[20px] border border-sky-100 bg-sky-50/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-sky-950">Wave chain</p>
                          <p className="text-xs text-sky-800">
                            {1 + childWaves.length} waves in sequence
                          </p>
                        </div>
                        <Badge className="rounded-full bg-white text-sky-700 hover:bg-white">
                          {ticket.waveSwitchMode || "date"}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700">
                          Wave 1: {ticket.name}
                        </div>
                        {childWaves.map((wave) => (
                          <div
                            key={`${wave.waveGroup}-${wave.waveOrder}`}
                            className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700"
                          >
                            {wave.name || `Wave ${wave.waveOrder}`} • {wave.waveSwitchMode || "date"}
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
                        placeholder="750"
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                      <FieldHint>Leave empty only if you are selling exclusively in USD.</FieldHint>
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
                        placeholder="20"
                        className="h-11 rounded-xl border-slate-200 bg-white"
                      />
                      <FieldHint>Optional alternate currency for checkout.</FieldHint>
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
                      className="min-h-28 rounded-2xl border-slate-200 bg-white"
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
