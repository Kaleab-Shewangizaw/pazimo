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
import { Badge } from "@/components/ui/badge";
import { Clapperboard } from "lucide-react";
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

/**
 * Which gift card receives CINEMA payments (per currency), separate from
 * the general ticket routing above it. Cinema takings only actually settle
 * here once the "Direct merchant / Gift card" toggle on Admin → Cinema →
 * Money is switched on — this panel just picks the destination card.
 */
export default function CinemaGiftCardRouting() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
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
        setEnabled(!!configRes.data.cinemaGiftCardMode);
        setRouting({
          ETB: configRes.data.cinemaGiftCardRouting?.ETB || null,
          USD: configRes.data.cinemaGiftCardRouting?.USD || null,
        });
      }
      if (cardsRes.status === "success") {
        setCards(cardsRes.data.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load cinema payment routing");
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
      const res = await adminApi.patch("/config/payment/cinema-giftcard-routing", {
        currency,
        cardNumber,
      });
      if (res.success) {
        setRouting((r) => ({ ...r, [currency]: cardNumber }));
        toast.success(res.message || `${currency} cinema routing updated`);
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
          <Clapperboard className="h-5 w-5" /> Cinema payment routing
          <Badge variant={enabled ? "default" : "secondary"} className="ml-1">
            {enabled ? "Gift card" : "Direct merchant"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Cinema ticket and concession money — kept apart from event ticket
          money above so the two channels never share a card&apos;s
          transaction history. Turn the path on or off from Admin →
          Cinema → Money.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {CURRENCIES.map((currency) => {
          const options = cards.filter(
            (c) => c.currency === currency && c.status === 1
          );
          return (
            <div key={currency} className="space-y-1.5">
              <Label>{currency} cinema gift card</Label>
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
