"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import { money, type CinemaBalance, type CinemaWithdrawal } from "@/lib/cinema-api";
import {
  Clapperboard,
  Popcorn,
  Ticket,
  Wallet,
  Gift,
  Landmark,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface CinemaFinanceRow {
  cinema: {
    _id: string;
    name: string;
    city?: string | null;
    isActive: boolean;
    beverageEligibility: "eligible" | "not_eligible";
    ticketCommissionRate: number;
    beverageCommissionRate: number;
    coversCinemaVat: boolean;
  };
  availableBalance: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  streams: CinemaBalance["streams"];
  combined: CinemaBalance["combined"];
}

interface FinanceTotals {
  grossRevenue: number;
  cinemaRevenue: number;
  pazimoCommission: number;
  vatOnCommission: number;
  cinemaVat: number;
  pazimoCollected: number;
  ticketGross: number;
  beverageGross: number;
}

const STREAM_LABEL: Record<string, string> = {
  cinema_tickets: "Tickets",
  cinema_beverages: "Concessions",
};

/**
 * One read-only pool card for the admin detail dialog — no withdraw box, the
 * cinema's own money page already owns that action.
 */
function AdminPoolCard({
  title,
  icon: Icon,
  pool,
  ratePercent,
}: {
  title: string;
  icon: typeof Ticket;
  pool: CinemaBalance["streams"]["tickets"];
  ratePercent: number;
}) {
  return (
    <Card className="border border-gray-200 dark:border-gray-800">
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          {title}
        </h3>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Available balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {money(pool.availableBalance)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Gross</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.grossRevenue)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Cinema share ({ratePercent.toFixed(2)}% cut)</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.cinemaRevenue)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Pazimo collected</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.pazimoCollected)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Cinema VAT withheld</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.cinemaVat)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Pending payouts</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.pendingWithdrawals)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Paid out</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(pool.approvedWithdrawals)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/** One cinema's full ledger — the admin drill-down for a single business. */
function CinemaDetailDialog({
  cinemaId,
  cinemaName,
  token,
  onClose,
}: {
  cinemaId: string;
  cinemaName: string;
  token: string | null;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState<CinemaBalance | null>(null);
  const [withdrawals, setWithdrawals] = useState<CinemaWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [balRes, wRes] = await Promise.all([
          fetch(`${API_URL}/api/cinemas/admin/${cinemaId}/finance`, { headers }),
          fetch(`${API_URL}/api/cinemas/admin/${cinemaId}/finance/withdrawals?limit=10`, {
            headers,
          }),
        ]);
        const bal = await balRes.json();
        const w = await wRes.json();
        if (!balRes.ok || !bal.success) throw new Error(bal.message || "Failed to load ledger");
        if (!cancelled) {
          setBalance(bal.data);
          setWithdrawals(w.success ? w.data : []);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load cinema ledger");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [cinemaId, token]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5" /> {cinemaName}
          </DialogTitle>
          <DialogDescription>
            This cinema&apos;s ledger — ticket and concession pools settle independently.
          </DialogDescription>
        </DialogHeader>

        {loading || !balance ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminPoolCard
                title="Ticket revenue"
                icon={Ticket}
                pool={balance.streams.tickets}
                ratePercent={balance.cinema.ticketCommissionRate * 100}
              />
              <AdminPoolCard
                title="Concession revenue"
                icon={Popcorn}
                pool={balance.streams.beverages}
                ratePercent={balance.cinema.beverageCommissionRate * 100}
              />
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Recent withdrawals
              </h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <th className="py-2 pl-3 pr-4">Requested</th>
                      <th className="py-2 pr-4">Pool</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500 dark:text-gray-400">
                          No withdrawals yet.
                        </td>
                      </tr>
                    )}
                    {withdrawals.map((w) => (
                      <tr key={w._id} className="border-b border-gray-100 last:border-0 dark:border-gray-800/60">
                        <td className="py-2 pl-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(w.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline">{STREAM_LABEL[w.stream] || w.stream}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {money(w.amount, w.currency)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            variant={
                              w.status === "completed"
                                ? "default"
                                : w.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {w.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Direct merchant / gift card toggle for the cinema channel's money path. */
function CinemaMoneyPathToggle({ token }: { token: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/config/payment/active`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setEnabled(!!data.data.cinemaGiftCardMode);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggle = async (checked: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/config/payment/cinema-giftcard-mode`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update");
      setEnabled(checked);
      toast.success(
        checked
          ? "Cinema payments now settle into a gift card"
          : "Cinema payments now settle directly to the merchant"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update cinema money path");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-800">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-purple-50 p-2 dark:bg-purple-950/40">
            <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Cinema money path
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Where new cinema ticket and concession payments settle. Pick the
              destination cards in Admin → Finance → Gift Cards.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Landmark className={`h-4 w-4 ${!enabled ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`} />
          <Label htmlFor="cinema-giftcard-switch" className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {enabled ? "Gift card" : "Direct merchant"}
          </Label>
          <Switch
            id="cinema-giftcard-switch"
            checked={enabled}
            onCheckedChange={toggle}
            disabled={!loaded || busy}
            className="data-[state=checked]:bg-purple-600"
          />
          <Gift className={`h-4 w-4 ${enabled ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The cinema channel's money screen for the admin: every cinema's takings on
 * one screen (getAdminCinemaFinance), plus a per-cinema drill-down
 * (getCinemaBalance) so "how much did THIS cinema make" has a direct answer
 * rather than requiring a spreadsheet built from the combined figure.
 */
export default function AdminCinemaFinancePanel({ token }: { token: string | null }) {
  const [totals, setTotals] = useState<FinanceTotals | null>(null);
  const [rows, setRows] = useState<CinemaFinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/cinemas/admin/finance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load cinema finance");
      setTotals(data.data.totals);
      setRows(data.data.rows || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load cinema finance");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const stats = [
    {
      label: "Cinema takings",
      value: formatCompactMoney(totals?.grossRevenue || 0, "ETB"),
      hint: `${formatCompactMoney(totals?.ticketGross || 0, "ETB")} tickets · ${formatCompactMoney(
        totals?.beverageGross || 0,
        "ETB"
      )} concessions`,
      icon: Clapperboard,
    },
    {
      label: "Owed to cinemas",
      value: formatCompactMoney(totals?.cinemaRevenue || 0, "ETB"),
      hint: "after commission, VAT and withholding",
      icon: Wallet,
    },
    {
      label: "Pazimo collected",
      value: formatCompactMoney(totals?.pazimoCollected || 0, "ETB"),
      hint: "commission + VAT + withheld cinema VAT",
      icon: Popcorn,
    },
    {
      label: "Withheld cinema VAT",
      value: formatCompactMoney(totals?.cinemaVat || 0, "ETB"),
      hint: "owed to government, not revenue",
      icon: Ticket,
    },
  ];

  return (
    <div className="space-y-6">
      <CinemaMoneyPathToggle token={token} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">By cinema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No cinema has sold anything yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cinema</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Concessions</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Cinema net</TableHead>
                    <TableHead className="text-right">Pazimo</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Cut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.cinema._id}
                      className="cursor-pointer"
                      onClick={() => setDetail({ id: row.cinema._id, name: row.cinema.name })}
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {row.cinema.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          {row.cinema.city}
                          {!row.cinema.isActive && (
                            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                              suspended
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.streams.tickets.ticketCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.streams.beverages.unitsSold ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(row.combined.grossRevenue, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(row.combined.cinemaRevenue, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(row.combined.pazimoCollected, "ETB")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactMoney(row.availableBalance, "ETB")}
                        {row.pendingWithdrawals > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            {formatCompactMoney(row.pendingWithdrawals, "ETB")} pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-gray-900 dark:text-gray-100">
                          {(row.cinema.ticketCommissionRate * 100).toFixed(1)}% /{" "}
                          {(row.cinema.beverageCommissionRate * 100).toFixed(1)}%
                        </span>
                        {row.cinema.coversCinemaVat && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">VAT covered</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {detail && (
        <CinemaDetailDialog
          cinemaId={detail.id}
          cinemaName={detail.name}
          token={token}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
