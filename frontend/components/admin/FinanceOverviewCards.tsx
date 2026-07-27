"use client";

import { useMemo } from "react";
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
import { Wallet, CheckCircle2, Clock, ReceiptText } from "lucide-react";

export interface ChapaBalance {
  currency: string;
  available_balance: number;
  ledger_balance: number;
}

export interface ChapaSummary {
  period: { from: string; to: string };
  truncated?: boolean;
  totalCount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  byCurrency: Record<string, { count: number; amount: number; charges: number }>;
  daily: Record<string, Record<string, number>>;
}

export interface LocalSummary {
  [status: string]: { count: number; amount: number };
}

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// The balance tiles, period stat cards, and daily volume chart shared by the
// main Chapa Finance overview tab and the Gift Cards tab's own overview
// sub-tab — same data, same visuals, two places to see it.
export default function FinanceOverviewCards({
  balances,
  balancesLoading,
  summary,
  summaryLoading,
  localSummary,
  chartCurrency,
  onChartCurrencyChange,
  fromDate,
  toDate,
}: {
  balances: ChapaBalance[];
  balancesLoading: boolean;
  summary: ChapaSummary | null;
  summaryLoading: boolean;
  localSummary: LocalSummary;
  chartCurrency: string;
  onChartCurrencyChange: (value: string) => void;
  fromDate: string;
  toDate: string;
}) {
  const chartData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.daily)
      .map(([day, byCurrency]) => ({
        day,
        amount: byCurrency[chartCurrency] || 0,
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [summary, chartCurrency]);

  const successStats = summary?.byStatus?.["success"];
  const pendingStats = summary?.byStatus?.["pending"];
  const failedCount = summary
    ? Object.entries(summary.byStatus)
        .filter(([s]) => !["success", "pending"].includes(s))
        .reduce((acc, [, v]) => acc + v.count, 0)
    : 0;
  const successRate =
    summary && summary.totalCount > 0 && successStats
      ? Math.round((successStats.count / summary.totalCount) * 100)
      : null;

  const localPaid = localSummary["paid"];
  const chapaVsLocalMismatch =
    successStats && localPaid && successStats.count !== localPaid.count;

  return (
    <div className="space-y-6">
      {/* Balance tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balancesLoading ? (
          <>
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </>
        ) : (
          balances.map((b) => (
            <Card key={b.currency}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Available balance ({b.currency})
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(b.available_balance, b.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Ledger (incl. awaiting settlement):{" "}
                <span className="tabular-nums">
                  {formatMoney(b.ledger_balance, b.currency)}
                </span>
              </CardContent>
            </Card>
          ))
        )}

        {/* Period status tiles */}
        {summaryLoading ? (
          <>
            <Skeleton className="h-[110px]" />
            <Skeleton className="h-[110px]" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Successful (period)
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {successStats?.count ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {successRate !== null
                  ? `${successRate}% success rate of ${summary?.totalCount} transactions`
                  : "No transactions in period"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  Pending / failed (period)
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {(pendingStats?.count ?? 0) + failedCount}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {pendingStats?.count ?? 0} pending · {failedCount} failed or
                cancelled
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Volume by currency + reconciliation */}
      {!summaryLoading && summary && (
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(summary.byCurrency).map(([currency, stats]) => (
            <Card key={currency}>
              <CardHeader className="pb-2">
                <CardDescription>Collected volume ({currency})</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoney(stats.amount, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats.count} successful payments · Chapa fees{" "}
                <span className="tabular-nums">
                  {formatMoney(stats.charges, currency)}
                </span>
              </CardContent>
            </Card>
          ))}
          <Card
            className={
              chapaVsLocalMismatch ? "border-yellow-300 dark:border-yellow-800" : ""
            }
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Pazimo records (reconciliation)
              </CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {localPaid?.count ?? 0} paid
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Chapa reports {successStats?.count ?? 0} successful vs{" "}
              {localPaid?.count ?? 0} PAID Chapa payments in Pazimo DB
              {chapaVsLocalMismatch && (
                <span className="block mt-1 text-yellow-700 dark:text-yellow-300">
                  Counts differ — worth investigating (webhooks, ticket sales
                  outside invitations, or missed records).
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily volume chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Daily collected volume ({chartCurrency})</CardTitle>
            <CardDescription>
              Successful Chapa payments per day, {fromDate} → {toDate}
            </CardDescription>
          </div>
          <Select value={chartCurrency} onValueChange={onChartCurrencyChange}>
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
          {summaryLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              No successful {chartCurrency} payments in this period
            </div>
          ) : (
            <ChartContainer
              config={{
                amount: {
                  label: `Volume (${chartCurrency})`,
                  theme: { light: "#4f46e5", dark: "#7b87f2" },
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
