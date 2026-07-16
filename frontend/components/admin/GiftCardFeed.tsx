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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  X,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import GiftCardTxTable, { CardTransaction } from "./GiftCardTxTable";

const PAGE_SIZE = 20;

export default function GiftCardFeed() {
  const [kind, setKind] = useState<"all" | "topup" | "payout">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        kind,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      const res = await adminApi.get(
        `/admin/finance/chapa/giftcards/feed?${params.toString()}`
      );
      if (res.status === "success") {
        setTransactions(res.data.transactions || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      } else {
        throw new Error(res.message || "Failed to load transactions");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [kind, search, page]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Back to page 1 whenever the tab or search changes
  useEffect(() => {
    setPage(1);
  }, [kind, search]);

  const submitSearch = () => setSearch(searchInput.trim());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" /> All gift card transactions
            </CardTitle>
            <CardDescription>
              Every top-up and withdrawal across all cards, newest first —
              search by phone number, card number, bank account, name, or
              reference
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Phone, card, account, name…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                className="w-[240px] pl-8 pr-8"
              />
              {search && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={submitSearch}>
              Search
            </Button>
            <Button variant="outline" size="icon" onClick={fetchFeed}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="topup">Top-ups</TabsTrigger>
            <TabsTrigger value="payout">Withdrawals</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4">
          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search
                ? `No ${
                    kind === "all" ? "transactions" : kind + "s"
                  } match “${search}”`
                : "No transactions yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <GiftCardTxTable transactions={transactions} showCard />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} · {total} transaction{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
