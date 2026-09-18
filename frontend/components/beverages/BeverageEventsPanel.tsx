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
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import { Search, Check, X, Loader2, Info, Package } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface BeverageEvent {
  _id: string;
  title: string;
  status: string;
  startDate?: string;
  organizer?: { firstName?: string; lastName?: string; email?: string } | null;
  commissionRate: number;
  commissionPercent: number;
  // Set on the event, not on the bar: an event whose VAT Pazimo covers has it
  // withheld on drinks too. Read-only here — it is edited on the Commission
  // &amp; VAT screen so there is one place to turn it on.
  coversOrganizerVat: boolean;
  totalCutPercent: number;
  drinksOffered: number;
  stockTotal: number;
  stockSold: number;
  stockRemaining: number;
  salesCount: number;
  unitsSold: number;
  totalCollected: number;
  organizerNet: number;
  organizerVat: number;
  pazimoCollected: number;
}

/**
 * Events selling drinks: what each has taken at the bar, and its commission
 * rate, editable inline.
 *
 * The beverage counterpart of the ticket commission table. Only events with an
 * actual line-up appear — an event that sells no drinks has no bar rate worth
 * showing.
 */
export default function BeverageEventsPanel({ token }: { token: string | null }) {
  const [events, setEvents] = useState<BeverageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`${API}/api/beverages/finance/events?${params}`, { headers });
      if (!res.ok) throw new Error();
      setEvents((await res.json()).data || []);
    } catch {
      toast.error("Could not load beverage events");
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const saveRate = async (event: BeverageEvent) => {
    const percent = Number(draft);
    if (!Number.isFinite(percent) || percent < 0 || percent > 25) {
      toast.error("Enter a rate between 0 and 25");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/admin/commission/events/${event._id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ beverageCommissionRate: percent }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message);
      toast.success(
        `${event.title} — drinks now ${payload.data.beverageCommissionPercent}% ` +
          `(${payload.data.beverageTotalCutPercent}% with VAT)`,
        { description: "Applies to future sales. Drinks already sold keep the rate they were sold under." }
      );
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the rate");
    } finally {
      setSaving(false);
    }
  };

  const money = (n: number) => formatCompactMoney(n, "ETB");

  const totals = events.reduce(
    (acc, e) => ({
      collected: acc.collected + e.totalCollected,
      pazimo: acc.pazimo + e.pazimoCollected,
      units: acc.units + e.unitsSold,
    }),
    { collected: 0, pazimo: 0, units: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Events selling drinks
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {loading
              ? " "
              : `${events.length} event${events.length === 1 ? "" : "s"} · ${totals.units.toLocaleString()} items sold · ${money(totals.collected)} collected · ${money(totals.pazimo)} to Pazimo`}
          </p>
        </div>
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
          Drinks carry their own commission, separate from the event&apos;s ticket
          rate. Changing it affects future sales only — every sale records the rate
          it was made under. VAT coverage is set per event on the{" "}
          <strong>Commission &amp; VAT</strong> screen and applies to drinks as
          well as tickets.
        </p>
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead className="text-right">Line-up</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Organizer keeps</TableHead>
                  <TableHead className="text-right">Pazimo</TableHead>
                  <TableHead className="text-right w-[150px]">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                      <Package className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                      No events have a beverage line-up yet
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100 max-w-[220px]">
                        <span className="block truncate">{event.title}</span>
                        {event.startDate && (
                          <span className="block text-[11px] text-gray-400">
                            {new Date(event.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400 max-w-[160px] truncate">
                        {event.organizer
                          ? `${event.organizer.firstName ?? ""} ${event.organizer.lastName ?? ""}`.trim() ||
                            event.organizer.email
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {event.drinksOffered}
                        <span className="block text-[10px] text-gray-400">
                          {event.stockRemaining.toLocaleString()} left
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {event.unitsSold.toLocaleString()}
                        <span className="block text-[10px] text-gray-400">
                          {event.salesCount.toLocaleString()} sales
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(event.totalCollected)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {money(event.organizerNet)}
                        {event.organizerVat > 0 && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                            after {money(event.organizerVat)} VAT
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-indigo-600 dark:text-indigo-400">
                        {money(event.pazimoCollected)}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing === event._id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRate(event);
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className="h-8 w-16 text-right"
                              inputMode="decimal"
                              aria-label="Beverage commission percent"
                            />
                            <Button size="sm" disabled={saving} onClick={() => saveRate(event)} className="h-8 px-2">
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="h-8 px-2">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(event._id);
                              setDraft(String(event.commissionPercent));
                            }}
                            className="inline-flex flex-col items-end rounded px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Click to change — applies to future sales only"
                          >
                            <Badge
                              variant="outline"
                              className={
                                Math.abs(event.commissionRate - 0.03) < 1e-9
                                  ? "border-gray-300 dark:border-gray-600"
                                  : "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                              }
                            >
                              {event.commissionPercent}%
                            </Badge>
                            <span className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                              {event.totalCutPercent}% deducted
                            </span>
                            {event.coversOrganizerVat && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                Pazimo covers VAT
                              </span>
                            )}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
