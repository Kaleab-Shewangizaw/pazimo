"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Route } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/adminApi";

interface GiftCard {
  ref_id: string;
  name: string;
  card_number: string;
  currency: string;
  status: number;
  available_amount: number;
}

const CURRENCIES = ["ETB", "USD"] as const;

// Which gift card receives ticket payments (per currency) when the admin
// header's "Gift card" toggle is on. Separate from the gift-card CRUD table
// below — this only sets the routing, it doesn't create/manage cards.
export default function GiftCardRouting() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState<Record<string, string | null>>({
    ETB: null,
    USD: null,
  });
  const [saving, setSaving] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, cardsRes] = await Promise.all([
        adminApi.get("/config/payment/active"),
        adminApi.get("/admin/finance/chapa/giftcards?limit=100"),
      ]);
      if (configRes.success) {
        setRouting({
          ETB: configRes.data.giftCardRouting?.ETB || null,
          USD: configRes.data.giftCardRouting?.USD || null,
        });
      }
      if (cardsRes.status === "success") {
        setCards(cardsRes.data.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load payment routing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSelect = async (currency: string, cardNumber: string) => {
    setSaving(currency);
    try {
      const res = await adminApi.patch("/config/payment/giftcard-routing", {
        currency,
        cardNumber,
      });
      if (res.success) {
        setRouting((r) => ({ ...r, [currency]: cardNumber }));
        toast.success(res.message || `${currency} routing updated`);
      } else {
        throw new Error(res.message || "Failed to update routing");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" /> Ticket payment routing
        </CardTitle>
        <CardDescription>
          When the admin header&apos;s &quot;Gift card&quot; toggle is on,
          ticket checkout settles into the card selected here — one per
          currency — instead of the merchant balance.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {CURRENCIES.map((currency) => {
          const options = cards.filter(
            (c) => c.currency === currency && c.status === 1
          );
          return (
            <div key={currency} className="space-y-1.5">
              <Label>{currency} gift card</Label>
              <Select
                value={routing[currency] || undefined}
                onValueChange={(v) => handleSelect(currency, v)}
                disabled={loading || saving === currency}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loading
                        ? "Loading…"
                        : options.length === 0
                        ? `No active ${currency} cards`
                        : "Select a card"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((card) => (
                    <SelectItem key={card.card_number} value={card.card_number}>
                      {card.name} — {card.card_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {options.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground">
                  Create an active {currency} gift card below first.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
