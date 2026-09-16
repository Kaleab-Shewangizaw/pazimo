"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import PaginationControls from "@/components/invitations/PaginationControls";
import { formatCompactMoney } from "@/lib/utils";
import {
  Wallet,
  Users,
  Landmark,
  Receipt,
  ShieldCheck,
  Percent,
  Search,
  Check,
  X,
  Info,
  Loader2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;
type Currency = "ETB" | "USD";

/** One income stream's split. Every figure below belongs to that stream alone. */
interface Stream {
  totalCollected: number;
  organizerNet: number;
  pazimoCommission: number;
  vatOnCommission: number;
  organizerVat: number;
  taxPayable: number;
  pazimoCollected: number;
  count: number;
  effectiveCommissionRate: number;
}

interface Summary {
  currency: Currency;
  vatRate: number;
  organizerVatRate: number;
  // The response also carries combined tickets+beverages totals at the top
  // level. They are deliberately not typed here: this panel is the admin
  // TICKETS page, and reading them is what made it report bar takings as
  // ticket sales.
  streams: { tickets: Stream; beverages: Stream };
}

interface EventRow {
  _id: string;
  title: string;
  status: string;
  organizer?: { firstName?: string; lastName?: string; email?: string } | null;
  commissionRate: number;
  commissionPercent: number;
  coversOrganizerVat: boolean;
  organizerVatPercent: number;
  totalCutPercent: number;
  ticketCount: number;
  totalCollected: number;
  organizerNet: number;
  pazimoCommission: number;
  vatOnCommission: number;
  organizerVat: number;
  pazimoCollected: number;
}

/** What PATCH /admin/commission/events/:id returns. */
interface RateChange {
  commissionPercent: number;
  beverageCommissionPercent: number;
  totalCutPercent: number;
  beverageTotalCutPercent: number;
  coversOrganizerVat: boolean;
  organizerVatPercent: number;
  ticketsAlreadySoldAtPreviousRate: number;
}

interface Defaults {
  defaultCommissionRate: number;
  minCommissionRate: number;
  maxCommissionRate: number;
  vatRate: number;
  organizerVatRate: number;
}

export default function CommissionPanel({ token }: { token: string | null }) {
  const [currency, setCurrency] = useState<Currency>("ETB");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPercent, setDraftPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; pages: number } | null>(null);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        currency,
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (search) params.set("search", search);

      const [summaryRes, eventsRes] = await Promise.all([
        fetch(`${API}/api/admin/commission/summary?currency=${currency}`, { headers }),
        fetch(`${API}/api/admin/commission/events?${params}`, { headers }),
      ]);

      if (summaryRes.ok) setSummary((await summaryRes.json()).data);
      if (eventsRes.ok) {
        const payload = await eventsRes.json();
        setEvents(payload.data || []);
        setDefaults(payload.defaults || null);
        setPagination(payload.pagination || null);
      }
    } catch {
      toast.error("Could not load commission data");
    } finally {
      setLoading(false);
    }
  }, [token, currency, search, page]);

  // A currency switch or a new search term invalidates whatever page we were
  // on — going back to page 1 avoids landing past the end of a now-shorter
  // result set (or, on this component's own state, silently re-requesting a
  // stale page number the debounced effect below would otherwise send).
  useEffect(() => {
    setPage(1);
  }, [currency, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0); // debounce typing
    return () => clearTimeout(timer);
  }, [load, search]);

  /**
   * Both edits go through the same PATCH, so the "applies to future sales
   * only" wording is written once and cannot drift between the two.
   */
  const patchEvent = async (
    event: EventRow,
    body: Record<string, unknown>,
    summarise: (data: RateChange) => string
  ) => {
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/admin/commission/events/${event._id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message);

      const sold = payload.data.ticketsAlreadySoldAtPreviousRate;
      toast.success(summarise(payload.data), {
        description:
          sold > 0
            ? `Applies to future sales. ${sold.toLocaleString()} ticket${sold === 1 ? "" : "s"} already sold keep their original terms.`
            : "Applies to future sales.",
      });
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    } finally {
      setSaving(false);
    }
  };

  const saveRate = (event: EventRow) => {
    const percent = Number(draftPercent);
    if (!Number.isFinite(percent)) {
      toast.error("Enter a number, for example 3 or 2.5");
      return;
    }
    const max = (defaults?.maxCommissionRate ?? 0.25) * 100;
    if (percent < 0 || percent > max) {
      toast.error(`Commission must be between 0% and ${max}%`);
      return;
    }

    return patchEvent(
      event,
      { commissionRate: percent },
      (d) =>
        `${event.title} is now ${d.commissionPercent}% ` +
        `(${d.totalCutPercent}% total deduction)`
    );
  };

  const toggleVatCoverage = (event: EventRow) =>
    patchEvent(event, { coversOrganizerVat: !event.coversOrganizerVat }, (d) =>
      d.coversOrganizerVat
        ? `Pazimo now covers VAT for ${event.title} — ${d.organizerVatPercent}% of sales withheld, ${d.totalCutPercent}% deducted in total`
        : `${event.title} settles its own VAT again — ${d.totalCutPercent}% deducted in total`
    );

  const money = (n: number) => formatCompactMoney(n, currency);

  // This is the admin TICKETS page, so every figure on it is the ticket stream
  // alone. Bar sales are a separate income stream with their own screen; they
  // used to be added in here, which reported 3,154 when ticket sales were 274.
  const tickets = summary?.streams.tickets;
  const beverages = summary?.streams.beverages;

  // The last three add up to the first. Revenue and tax are deliberately two
  // different cards: tax is money Pazimo holds and owes onward, and folding it
  // into "Pazimo collected" is exactly how a platform talks itself into
  // thinking it earned 18% when it earned 3%.
  const cards = [
    {
      label: "Ticket sales",
      hint: "Tickets only, before any deduction — no bar or invitation money",
      value: tickets?.totalCollected ?? 0,
      icon: Wallet,
      tone: "text-blue-600 dark:text-blue-400",
      ring: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Organizers keep",
      hint: "After commission, VAT on it, and any VAT Pazimo covers",
      value: tickets?.organizerNet ?? 0,
      icon: Users,
      tone: "text-emerald-600 dark:text-emerald-400",
      ring: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      label: "Pazimo revenue",
      hint: "Commission only — the money Pazimo actually earned",
      value: tickets?.pazimoCommission ?? 0,
      icon: Landmark,
      tone: "text-indigo-600 dark:text-indigo-400",
      ring: "bg-indigo-100 dark:bg-indigo-900/30",
    },
    {
      label: "Held for government",
      hint: tickets
        ? `${money(tickets.vatOnCommission)} VAT on commission + ${money(tickets.organizerVat)} organizer VAT covered`
        : "VAT owed, not earned",
      value: tickets?.taxPayable ?? 0,
      icon: Receipt,
      tone: "text-amber-600 dark:text-amber-400",
      ring: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Ticket commission &amp; VAT
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Ticket sales only — bar, invitation and campaign money is counted on
            its own screen. Each event has its own rate
            {defaults && defaults.vatRate > 0
              ? `, and the government charges ${(defaults.vatRate * 100).toFixed(0)}% VAT on that commission, so an event at 4% costs the organizer ${(4 * (1 + defaults.vatRate)).toFixed(2)}%.`
              : "."}
          </p>
        </div>
        <Select value={currency} onValueChange={(v: Currency) => setCurrency(v)}>
          <SelectTrigger className="w-[110px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ETB">ETB</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards 2 + 3 + 4 always equal card 1. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <CardContent className="p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {loading ? "—" : money(card.value)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {card.hint}
                </p>
              </div>
              <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${card.ring}`}>
                <card.icon className={`h-5 w-5 ${card.tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      

      {/* Per-event rates */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Commission by event
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
              Changing a rate or VAT coverage affects{" "}
              <strong>future sales only</strong>. Every ticket records the terms
              it was sold under, so past revenue and payouts never move.{" "}
              <strong>Covers VAT</strong> is for organizers with no VAT licence:
              Pazimo withholds a further{" "}
              {((defaults?.organizerVatRate ?? 0.15) * 100).toFixed(0)}% of
              their sales and remits it to the government for them. That money
              is a liability, never Pazimo revenue — commission stays exactly
              where you set it.
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Pazimo earned</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-center">Covers VAT</TableHead>
                  <TableHead className="w-[130px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => {
                    const isDefault =
                      Math.abs(event.commissionRate - (defaults?.defaultCommissionRate ?? 0.03)) < 1e-9;
                    return (
                      <TableRow key={event._id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100 max-w-[220px] truncate">
                          {event.title}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400 text-sm">
                          {event.organizer
                            ? `${event.organizer.firstName ?? ""} ${event.organizer.lastName ?? ""}`.trim() ||
                              event.organizer.email
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {event.ticketCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(event.totalCollected)}
                        </TableCell>
                        {/* Commission alone. The tax withheld alongside it is
                            shown under the coverage toggle, so the two are
                            never read as one number. */}
                        <TableCell className="text-right tabular-nums text-indigo-600 dark:text-indigo-400">
                          {money(event.pazimoCommission)}
                        </TableCell>
                        <TableCell className="text-right">
                          {editing === event._id ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                autoFocus
                                value={draftPercent}
                                onChange={(e) => setDraftPercent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRate(event);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                className="h-8 w-20 text-right"
                                inputMode="decimal"
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <Badge
                                variant="outline"
                                className={
                                  isDefault
                                    ? "border-gray-300 dark:border-gray-600"
                                    : "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                }
                              >
                                {event.commissionPercent}%
                              </Badge>
                              <span className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                                {event.totalCutPercent}% deducted
                              </span>
                            </div>
                          )}
                        </TableCell>
                        {/* Coverage is a property of the event, so it applies
                            to bar sales as well as tickets. */}
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={event.coversOrganizerVat ? "default" : "outline"}
                            disabled={saving}
                            onClick={() => toggleVatCoverage(event)}
                            title={
                              event.coversOrganizerVat
                                ? `Pazimo withholds ${event.organizerVatPercent}% of this event's sales and remits it. Click to stop.`
                                : "This organizer settles their own VAT. Click to have Pazimo cover it."
                            }
                            className={
                              event.coversOrganizerVat
                                ? "h-8 px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                                : "h-8 px-2.5 text-gray-500"
                            }
                          >
                            {event.coversOrganizerVat ? (
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span className="tabular-nums">
                                  {event.organizerVatPercent}%
                                </span>
                              </span>
                            ) : (
                              "Off"
                            )}
                          </Button>
                          {event.organizerVat > 0 && (
                            <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                              {money(event.organizerVat)} withheld
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editing === event._id ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                disabled={saving}
                                onClick={() => saveRate(event)}
                                className="h-8 px-2"
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(null)}
                                className="h-8 px-2"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                setEditing(event._id);
                                setDraftPercent(String(event.commissionPercent));
                              }}
                            >
                              Change
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {pagination && (
            <PaginationControls
              currentPage={page}
              totalPages={pagination.pages}
              onPageChange={setPage}
              totalItems={pagination.total}
              itemName="events"
              itemsPerPage={PAGE_SIZE}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
