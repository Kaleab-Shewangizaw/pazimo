"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, KeyRound, Zap } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

interface V2Payment {
  chapa_reference: string;
  merchant_reference: string | null;
  payment_type: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  service_fee: number;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  created_at: string;
}

interface V2Payout {
  chapa_reference?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

const statusBadgeClass = (status: string) => {
  const s = status.toLowerCase();
  if (s === "success")
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900";
  if (s === "pending")
    return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900";
  return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
};

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// The v2 API reports all monetary values in cents (amount 103 = 1.03 ETB),
// unlike v1 which uses major units.
const formatCents = (cents: number, currency: string) =>
  formatMoney((Number(cents) || 0) / 100, currency);

export default function ChapaV2Section() {
  const [payments, setPayments] = useState<V2Payment[]>([]);
  const [payouts, setPayouts] = useState<V2Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const [paymentsRes, payoutsRes] = await Promise.all([
        adminApi.get(`/admin/finance/chapa/v2/payments?${params.toString()}`),
        adminApi.get("/admin/finance/chapa/v2/payouts?per_page=20"),
      ]);
      if (paymentsRes.status === "success") {
        setNotConfigured(false);
        setPayments(paymentsRes.data.items || []);
      } else if (paymentsRes.v2NotConfigured) {
        setNotConfigured(true);
        return;
      } else {
        throw new Error(paymentsRes.message || "Failed to load v2 payments");
      }
      if (payoutsRes.status === "success") {
        setPayouts(payoutsRes.data.items || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (notConfigured) {
    return (
      <Card className="border-yellow-300 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Chapa API v2 key missing or invalid
          </CardTitle>
          <CardDescription>
            Generate a scoped key from the Chapa dashboard (Payments Read is
            enough for this view), set it as{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              CHAPA_V2_API_KEY
            </code>{" "}
            in the backend environment, and restart the backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Check again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" /> API v2 payments
              </CardTitle>
              <CardDescription>
                Traffic on Chapa&apos;s next-gen API (api.chapa.global) — only
                shows payments created through v2 (e.g. payment links), not the
                v1 history in the Overview tab
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No v2 payments yet — they appear here once payments run
                      through the v2 API
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.chapa_reference}>
                      <TableCell className="font-mono text-xs">
                        {p.chapa_reference}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(p.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.payment_type?.toLowerCase().replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {[p.customer?.first_name, p.customer?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                          p.customer?.email ||
                          p.customer?.phone_number ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.payment_method || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCents(p.amount, p.currency)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCents(p.service_fee, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(p.status)}
                        >
                          {p.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API v2 payouts</CardTitle>
          <CardDescription>
            Outbound transfers made through the v2 API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : payouts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No v2 payouts yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p, i) => (
                    <TableRow key={(p.chapa_reference || p.reference || i) as string}>
                      <TableCell className="font-mono text-xs">
                        {p.chapa_reference || p.reference || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCents(
                          Number(p.amount) || 0,
                          (p.currency as string) || "ETB"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(String(p.status || ""))}
                        >
                          {String(p.status || "unknown").toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
