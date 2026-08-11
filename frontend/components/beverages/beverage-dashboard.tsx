"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getBeverageInk } from "@/lib/beverage-color";
import { Beer, Package, Receipt, TrendingUp, Wallet } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface DashboardData {
  totals: {
    revenue: number;
    units: number;
    orders: number;
    averageOrderValue: number;
    stockTotal: number;
    stockSold: number;
    stockRemaining: number;
    sellThrough: number | null;
    potentialRevenue: number;
    eventsSelling: number;
    listings: number;
  };
  byBeverage: {
    _id: string;
    name: string;
    color?: string | null;
    revenue: number;
    units: number;
    eventCount: number;
  }[];
  byEvent: {
    _id: string;
    title: string;
    organizerName?: string;
    revenue: number;
    units: number;
    drinkCount: number;
    startDate?: string;
  }[];
  byOrganizer: { _id: string; name: string; email?: string; revenue: number; units: number; eventCount: number }[];
  timeline: { date: string; revenue: number; units: number }[];
  recent: {
    _id: string;
    referenceNumber?: string;
    beverageName: string;
    quantity: number;
    totalAmount: number;
    currency: string;
    soldAt: string;
    event?: { title?: string };
  }[];
}

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

// Bars carry the drink's own colour, so the tooltip names the drink rather than
// making the reader match a swatch back to a legend.
const ChartTip = ({
  active,
  payload,
  label,
  valueKey,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Record<string, unknown> }[];
  label?: string;
  valueKey: "revenue" | "units";
  currency?: string;
}) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, unknown>;
  const title = (row.name as string) || label || "";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
      <p className="text-gray-600 dark:text-gray-400">
        {valueKey === "revenue"
          ? formatCompactMoney(row.revenue as number, currency || "ETB")
          : `${row.units as number} bottles`}
      </p>
    </div>
  );
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) => (
  <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Icon className={`h-4 w-4 ${accent || ""}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </CardContent>
  </Card>
);

export function BeverageDashboard({
  scope,
  token,
}: {
  scope: "admin" | "organizer";
  token: string;
}) {
  const isAdmin = scope === "admin";
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<number | null>(30);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams(rangeDays ? { from: isoDaysAgo(rangeDays) } : {});
      const res = await fetch(`${API_URL}/api/beverages/${scope}/dashboard?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed to load the dashboard");
      setData(body.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the dashboard");
    } finally {
      setLoading(false);
    }
  }, [scope, token, rangeDays]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Past roughly eight colour classes adjacent hues stop being tellable apart,
  // so the chart shows the leaders and the table below carries the whole list.
  const topDrinks = useMemo(
    () =>
      (data?.byBeverage || []).slice(0, 8).map((row) => ({
        ...row,
        ink: getBeverageInk(row.color, isDark),
      })),
    [data?.byBeverage, isDark]
  );

  const axisStyle = { fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" };
  const gridStroke = isDark ? "#1f2937" : "#f1f5f9";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const totals = data?.totals;
  const hasSales = (totals?.orders || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Filters sit in one row above everything they affect. */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((range) => (
          <Button
            key={range.label}
            type="button"
            size="sm"
            variant={rangeDays === range.days ? "default" : "outline"}
            onClick={() => setRangeDays(range.days)}
            className={rangeDays === range.days ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
          >
            {range.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Revenue"
          value={formatCompactMoney(totals?.revenue || 0, "ETB")}
          sub={`${totals?.orders || 0} order${totals?.orders === 1 ? "" : "s"}`}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          icon={Beer}
          label="Bottles sold"
          value={String(totals?.units || 0)}
          sub={
            totals?.averageOrderValue
              ? `${formatCompactMoney(totals.averageOrderValue, "ETB")} avg order`
              : undefined
          }
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          icon={Package}
          label="Stock remaining"
          value={String(totals?.stockRemaining || 0)}
          sub={`of ${totals?.stockTotal || 0} listed`}
          accent="text-blue-600 dark:text-blue-400"
        />
        <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium uppercase tracking-wide">Sell-through</span>
            </div>
            {totals?.sellThrough === null ? (
              <>
                <p className="mt-2 text-2xl font-bold text-gray-400 dark:text-gray-500">—</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  No bottles listed yet
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {totals?.sellThrough}%
                </p>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  role="progressbar"
                  aria-valuenow={totals?.sellThrough ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Share of listed bottles sold"
                >
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.min(totals?.sellThrough ?? 0, 100)}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasSales ? (
        <Card className="border border-dashed border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
              <Receipt className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              No sales in this period
            </p>
            <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
              {totals?.listings
                ? `${totals.stockTotal} bottles are listed across ${totals.eventsSelling} event${
                    totals.eventsSelling === 1 ? "" : "s"
                  }, worth ${formatCompactMoney(totals.potentialRevenue, "ETB")} if they all sell.`
                : isAdmin
                ? "No organizer has put drinks on an event yet."
                : "Add drinks to an event to start selling."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 lg:col-span-3">
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Revenue over time</h3>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Confirmed beverage sales, refunds excluded.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data?.timeline} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="bevRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    {/* Solid hairlines: dashed gridlines read as a threshold. */}
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={{ stroke: gridStroke }}
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value: number) => formatCompactMoney(value)}
                    />
                    <Tooltip
                      cursor={{ stroke: gridStroke, strokeWidth: 1 }}
                      content={<ChartTip valueKey="revenue" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#bevRevenueFill)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? "#0b0b0b" : "#ffffff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top drinks</h3>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  By revenue. Each bar carries the drink&apos;s own colour.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topDrinks}
                    layout="vertical"
                    margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid stroke={gridStroke} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={{ stroke: gridStroke }}
                      tickFormatter={(value: number) => formatCompactMoney(value)}
                    />
                    {/* Every bar is named on the axis, so identity never rests
                        on colour alone. */}
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: isDark ? "#ffffff0d" : "#0000000a" }}
                      content={<ChartTip valueKey="revenue" />}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {topDrinks.map((row) => (
                        <Cell key={row._id} fill={row.ink} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
            <CardContent className="p-5">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
                Which event sold what
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      {isAdmin && <TableHead>Organizer</TableHead>}
                      <TableHead className="text-right">Drinks</TableHead>
                      <TableHead className="text-right">Bottles</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.byEvent || []).map((row) => (
                      <TableRow key={row._id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {row.title}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-gray-600 dark:text-gray-400">
                            {row.organizerName || "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-gray-600 dark:text-gray-400">
                          {row.drinkCount}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400">
                          {row.units}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(row.revenue, "ETB")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* The full drink list, so the chart above can stay at eight. */}
            <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
              <CardContent className="p-5">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
                  Every drink sold
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drink</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="text-right">Bottles</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.byBeverage || []).map((row) => (
                        <TableRow key={row._id}>
                          <TableCell>
                            <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                              <span
                                aria-hidden
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: getBeverageInk(row.color, isDark) }}
                              />
                              {row.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-gray-600 dark:text-gray-400">
                            {row.eventCount}
                          </TableCell>
                          <TableCell className="text-right text-gray-600 dark:text-gray-400">
                            {row.units}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                            {formatCompactMoney(row.revenue, "ETB")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900">
              <CardContent className="p-5">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
                  {isAdmin ? "Top organizers" : "Latest sales"}
                </h3>
                {isAdmin ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organizer</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="text-right">Bottles</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.byOrganizer || []).map((row) => (
                          <TableRow key={row._id}>
                            <TableCell>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {row.name || "—"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
                            </TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">
                              {row.eventCount}
                            </TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-400">
                              {row.units}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                              {formatCompactMoney(row.revenue, "ETB")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {(data?.recent || []).map((sale) => (
                      <li
                        key={sale._id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-2.5 dark:border-gray-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {sale.quantity} × {sale.beverageName}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {sale.event?.title} · {new Date(sale.soldAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {formatCompactMoney(sale.totalAmount, sale.currency)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
