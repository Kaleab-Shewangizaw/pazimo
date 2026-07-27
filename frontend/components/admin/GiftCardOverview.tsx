"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Gift, ArrowDownToLine, ArrowUpFromLine, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";

interface CurrencyBalance {
  currency: string;
  totalAvailable: number;
  cardCount: number;
}

interface CurrencyStat {
  count: number;
  amount: number;
}

interface GiftCardSummary {
  period: { from: string | null; to: string | null };
  truncated?: boolean;
  balances: CurrencyBalance[];
  topups: {
    totalCount: number;
    byCurrency: Record<string, CurrencyStat>;
    daily: Record<string, Record<string, number>>;
  };
  payouts: {
    byCurrency: Record<string, CurrencyStat>;
  };
}

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// Gift-card-only money movement: balances currently sitting inside gift
// cards, plus top-up/payout volume — separate from the general Chapa
// merchant overview (settlements/transactions live on that tab instead).
export default function GiftCardOverview({
  fromDate,
  toDate,
}: {
  fromDate: string;
  toDate: string;
}) {
  const [summary, setSummary] = useState<GiftCardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notActivated, setNotActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartCurrency, setChartCurrency] = useState("ETB");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get(
        `/admin/finance/chapa/giftcards/summary?from_date=${fromDate}&to_date=${toDate}`
      );
      if (res.status === "success") {
        setNotActivated(false);
        setSummary(res.data);
      } else if (res.linkNotActivated) {
        setNotActivated(true);
      } else {
        throw new Error(res.message || "Failed to load gift card summary");
      }
    } catch (e: any) {
      setError(e.message);
      toast.error(`Gift card overview: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.topups.daily)
      .map(([day, byCurrency]) => ({
        day,
        amount: byCurrency[chartCurrency] || 0,
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [summary, chartCurrency]);

  const currencies = useMemo(() => {
    if (!summary) return [];
    const set = new Set<string>([
      ...summary.balances.map((b) => b.currency),
      ...Object.keys(summary.topups.byCurrency),
      ...Object.keys(summary.payouts.byCurrency),
    ]);
    return Array.from(set).sort();
  }, [summary]);

  if (notActivated) {
    return (
      <Card className="border-yellow-300 dark:border-yellow-800">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Chapa Link isn&apos;t activated yet — see the Manage tab for setup
          instructions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {summary?.truncated && (
        <Card className="border-yellow-300 dark:border-yellow-800">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            More than 500 gift-card transactions on file — figures below only
            cover the most recent 500.
          </CardContent>
        </Card>
      )}

      {/* Balances currently held inside gift cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </>
        ) : summary && summary.balances.length > 0 ? (
          summary.balances.map((b) => (
            <Card key={b.currency}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Gift card balance ({b.currency})
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(b.totalAvailable, b.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {b.cardCount} active {b.cardCount === 1 ? "card" : "cards"}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="sm:col-span-2 lg:col-span-4">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No active gift cards yet
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top-up / payout volume for the selected period */}
      {!loading && summary && currencies.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {currencies.map((currency) => {
            const topup = summary.topups.byCurrency[currency];
            const payout = summary.payouts.byCurrency[currency];
            return (
              <Card key={currency}>
                <CardHeader className="pb-2">
                  <CardDescription>{currency} activity (period)</CardDescription>
                  <CardTitle className="flex items-center gap-1.5 text-lg tabular-nums text-green-700 dark:text-green-400">
                    <ArrowDownToLine className="h-4 w-4" />
                    {formatMoney(topup?.amount ?? 0, currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  <div>{topup?.count ?? 0} successful top-ups</div>
                  <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    {formatMoney(payout?.amount ?? 0, currency)} sent out
                    <span className="text-muted-foreground">
                      ({payout?.count ?? 0})
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Daily top-up volume chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Daily gift card top-ups ({chartCurrency})</CardTitle>
            <CardDescription>
              Successful top-ups per day, {fromDate} → {toDate}
            </CardDescription>
          </div>
          <Select value={chartCurrency} onValueChange={setChartCurrency}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETB">ETB</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              No successful {chartCurrency} top-ups in this period
            </div>
          ) : (
            <ChartContainer
              config={{
                amount: {
                  label: `Top-ups (${chartCurrency})`,
                  theme: { light: "#16a34a", dark: "#4ade80" },
                },
              }}
              className="h-[240px] w-full"
            >
              <BarChart data={chartData} margin={{ top: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.35} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="amount"
                  fill="var(--color-amount)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
