"use client";

import { useEffect, useState } from "react";
import { VenueGate } from "@/components/venue/venue-gate";
import { VenueWithdrawalForm } from "@/components/venue/venue-withdrawal-form";
import { venueRequest, type VenueFinance } from "@/lib/venue-api";
import { formatCompactMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Clock3 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

interface WithdrawalRow {
  _id: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "completed";
  notes?: string;
  createdAt: string;
  processedAt?: string;
  bankDetails?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

interface WithdrawalsResponse {
  data: WithdrawalRow[];
  pagination: { total: number; page: number; pages: number };
}

function VenueWithdrawalsContent({ venue, token }: { venue: { _id: string; name: string }; token: string }) {
  const { user } = useAuthStore();
  const [finance, setFinance] = useState<VenueFinance | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  const loadFinance = async () => {
    const res = await venueRequest<{ data: VenueFinance }>(`/api/venues/${venue._id}/finance`, token);
    setFinance(res.data);
  };

  const loadHistory = async () => {
    const memberId = user?._id || venue._id;
    const params = new URLSearchParams({ page: String(page), limit: "10", stream: "venue_beverages" });
    const res = await venueRequest<{ data: WithdrawalsResponse }>(
      `/api/withdrawals/organizer/${memberId}/withdrawals?${params}`,
      token
    );
    setWithdrawals(res.data.data);
    setPagination(res.data.pagination);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setHistoryLoading(true);
        await Promise.all([loadFinance(), loadHistory()]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHistoryLoading(false);
        }
      }
    };
    load().catch(() => {
      setLoading(false);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [page, token, venue._id, user?._id]);

  const refresh = async () => {
    setLoading(true);
    setHistoryLoading(true);
    try {
      await Promise.all([loadFinance(), loadHistory()]);
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Withdrawals</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Move venue beverage revenue out of the live balance and into your payout history.
          </p>
        </div>
        <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300">
          Venue beverages only
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
                <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Request payout</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Venue withdrawals are settled separately from ticket revenue.
                </p>
              </div>
            </div>
            {loading ? <Skeleton className="h-96 rounded-2xl" /> : <VenueWithdrawalForm token={token} available={finance?.availableBalance || 0} onSuccess={refresh} />}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Available balance</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(finance?.availableBalance || 0, finance?.currency || "ETB")}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Pending / approved</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatCompactMoney(finance?.withdrawals.pending || 0, finance?.currency || "ETB")} / {formatCompactMoney(finance?.withdrawals.approved || 0, finance?.currency || "ETB")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">History</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">The payout queue for this venue.</p>
                </div>
                <Badge variant="secondary">{pagination.total.toLocaleString()}</Badge>
              </div>

              <div className="space-y-3">
                {historyLoading ? (
                  <Skeleton className="h-44 rounded-2xl" />
                ) : withdrawals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <Clock3 className="mx-auto mb-2 h-5 w-5" />
                    No withdrawals yet.
                  </div>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <div key={withdrawal._id} className="rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-800">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCompactMoney(withdrawal.amount, withdrawal.currency)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(withdrawal.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={withdrawal.status === "pending" ? "secondary" : "outline"}>
                          {withdrawal.status}
                        </Badge>
                      </div>
                      {withdrawal.notes && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{withdrawal.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span>
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button variant="outline" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function VenueWithdrawalsPage() {
  return <VenueGate>{(venue, token) => <VenueWithdrawalsContent venue={venue} token={token} />}</VenueGate>;
}