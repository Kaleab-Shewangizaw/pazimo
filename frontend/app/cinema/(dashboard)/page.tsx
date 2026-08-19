"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  fetchCinemaBalance,
  fetchTicketSummary,
  money,
  type CinemaBalance,
  type CinemaProfile,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Film,
  MapPin,
  Popcorn,
  Ticket,
  TrendingUp,
  Wallet,
  CalendarDays,
} from "lucide-react";

const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Film;
  label: string;
  value: string;
  sub?: string;
}) => (
  <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
      )}
    </CardContent>
  </Card>
);

type Summary = Awaited<ReturnType<typeof fetchTicketSummary>>;

function CinemaOverview({
  cinema,
  token,
}: {
  cinema: CinemaProfile;
  token: string;
}) {
  const [balance, setBalance] = useState<CinemaBalance | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCinemaBalance(token), fetchTicketSummary(token)])
      .then(([b, s]) => {
        if (cancelled) return;
        setBalance(b);
        setSummary(s);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {cinema.name}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="h-3.5 w-3.5" />
            {[cinema.city, cinema.address].filter(Boolean).join(" · ") ||
              "No address set"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={cinema.isActive ? "default" : "secondary"}>
            {cinema.isActive ? "Active" : "Suspended"}
          </Badge>
          <Badge
            variant={
              cinema.beverageEligibility === "eligible" ? "default" : "secondary"
            }
          >
            {cinema.beverageEligibility === "eligible"
              ? "Concessions approved"
              : "Concessions not approved"}
          </Badge>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* The two pools are shown side by side and never added together into a
          single headline figure: they are withdrawn separately, so one combined
          "balance" would misrepresent what can actually be taken out. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Ticket}
          label="Ticket revenue"
          value={money(balance?.streams.tickets.grossRevenue ?? 0)}
          sub={`${summary?.revenue.seatsSold ?? 0} seats sold`}
        />
        <StatCard
          icon={Wallet}
          label="Ticket balance"
          value={money(balance?.streams.tickets.availableBalance ?? 0)}
          sub="Withdrawable now"
        />
        <StatCard
          icon={Popcorn}
          label="Concession revenue"
          value={money(balance?.streams.beverages.grossRevenue ?? 0)}
          sub={`${balance?.streams.beverages.unitsSold ?? 0} items sold`}
        />
        <StatCard
          icon={TrendingUp}
          label="Concession balance"
          value={money(balance?.streams.beverages.availableBalance ?? 0)}
          sub="Withdrawable now"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Next screenings
            </h2>
            {summary?.upcoming?.length ? (
              <ul className="space-y-3">
                {summary.upcoming.slice(0, 6).map((s) => (
                  <li
                    key={s._id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {s.movie?.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(s.startsAt).toLocaleString()} · {s.hall?.name}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-xs text-gray-600 dark:text-gray-400">
                      {s.seatsSold}/{s.seatsAllocated}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nothing scheduled.{" "}
                <Link
                  href="/cinema/programme"
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Add a screening
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Top films
            </h2>
            {summary?.byMovie?.length ? (
              <ul className="space-y-3">
                {summary.byMovie.slice(0, 6).map((m) => (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">
                      {m.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                      {money(m.grossRevenue)} · {m.seatsSold} seats
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No ticket sales yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stating what Pazimo took, split by stream, because the two run at
          independently negotiated rates and a single blended figure would hide
          which one changed. */}
      {balance && (
        <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5 text-sm">
            <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
              What Pazimo collected
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Commission (tickets @{" "}
                  {(balance.cinema.ticketCommissionRate * 100).toFixed(2)}%)
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                  {money(balance.streams.tickets.pazimoCommission)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Commission (concessions @{" "}
                  {(balance.cinema.beverageCommissionRate * 100).toFixed(2)}%)
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                  {money(balance.streams.beverages.pazimoCommission)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  VAT on commission
                </dt>
                <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                  {money(balance.combined.vatOnCommission)}
                </dd>
              </div>
            </dl>
            {balance.cinema.coversCinemaVat && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Pazimo is withholding your own VAT of{" "}
                {money(balance.combined.cinemaVat)} and remitting it on your
                behalf. This is a tax liability, not a Pazimo fee.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CinemaOverviewPage() {
  return (
    <CinemaGate>
      {(cinema, token) => <CinemaOverview cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
