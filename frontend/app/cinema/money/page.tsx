"use client";

import { useCallback, useEffect, useState } from "react";
import { CinemaGate } from "@/components/cinema/cinema-gate";
import {
  fetchCinemaBalance,
  fetchCinemaWithdrawals,
  money,
  requestCinemaWithdrawal,
  type CinemaBalance,
  type CinemaPool,
  type CinemaProfile,
  type CinemaWithdrawal,
} from "@/lib/cinema-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Popcorn, Ticket, Wallet } from "lucide-react";

const STREAM_LABEL: Record<string, string> = {
  cinema_tickets: "Tickets",
  cinema_beverages: "Concessions",
};

/**
 * One pool, with its own withdraw box.
 *
 * The two pools are rendered as two independent panels rather than one balance
 * with a stream picker, because that is what they are: seat money and
 * concession money are settled separately, and a single input would invite the
 * assumption that they are one wallet.
 */
function PoolPanel({
  title,
  icon: Icon,
  pool,
  stream,
  ratePercent,
  onDone,
  token,
}: {
  title: string;
  icon: typeof Ticket;
  pool: CinemaPool;
  stream: "cinema_tickets" | "cinema_beverages";
  ratePercent: number;
  onDone: () => void;
  token: string;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestCinemaWithdrawal(token, {
        amount: Number(amount),
        stream,
      });
      toast.success("Withdrawal requested");
      setAmount("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
      <CardContent className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          {title}
        </h2>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Available to withdraw
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {money(pool.availableBalance)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Gross</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {money(pool.grossRevenue)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              Your share (after {ratePercent.toFixed(2)}% + VAT)
            </dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {money(pool.cinemaRevenue)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Pending payouts</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {money(pool.pendingWithdrawals)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Paid out</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {money(pool.approvedWithdrawals)}
            </dd>
          </div>
        </dl>

        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount (ETB)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            onClick={submit}
            disabled={
              busy ||
              !amount ||
              Number(amount) <= 0 ||
              Number(amount) > pool.availableBalance
            }
          >
            Withdraw
          </Button>
        </div>
        {Number(amount) > pool.availableBalance && (
          <p className="text-xs text-red-600 dark:text-red-400">
            More than this pool holds. Each pool is withdrawn separately.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MoneyContent({ token }: { cinema: CinemaProfile; token: string }) {
  const [balance, setBalance] = useState<CinemaBalance | null>(null);
  const [history, setHistory] = useState<CinemaWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [b, w] = await Promise.all([
      fetchCinemaBalance(token),
      fetchCinemaWithdrawals(token),
    ]);
    setBalance(b);
    setHistory(w);
  }, [token]);

  useEffect(() => {
    reload()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [reload]);

  if (loading || !balance) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Money
      </h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Ticket and concession revenue are two separate balances, settled
        independently.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <PoolPanel
          title="Ticket revenue"
          icon={Ticket}
          pool={balance.streams.tickets}
          stream="cinema_tickets"
          ratePercent={balance.cinema.ticketCommissionRate * 100}
          onDone={reload}
          token={token}
        />
        <PoolPanel
          title="Concession revenue"
          icon={Popcorn}
          pool={balance.streams.beverages}
          stream="cinema_beverages"
          ratePercent={balance.cinema.beverageCommissionRate * 100}
          onDone={reload}
          token={token}
        />
      </div>

      <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Withdrawal history
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-2 pr-4">Requested</th>
                  <th className="py-2 pr-4">Pool</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4 text-right">Net</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No withdrawals yet.
                    </td>
                  </tr>
                )}
                {history.map((w) => (
                  <tr
                    key={w._id}
                    className="border-b border-gray-100 dark:border-gray-800/60"
                  >
                    <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(w.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline">
                        {STREAM_LABEL[w.stream] || w.stream}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {money(w.amount, w.currency)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {money(w.netAmount ?? w.amount, w.currency)}
                    </td>
                    <td className="py-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function CinemaMoneyPage() {
  return (
    <CinemaGate>
      {(cinema, token) => <MoneyContent cinema={cinema} token={token} />}
    </CinemaGate>
  );
}
