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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CupSoda } from "lucide-react";
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
 * Which gift card receives EVENT-REFILL drink payments (per currency), and
 * whether that routing is even on. Kept apart from ticket routing and cinema
 * routing above/below it so a ticket-holder's drink money is never
 * inseparable from ticket money or cinema money inside one card's
 * transaction history — same reasoning as CinemaGiftCardRouting.
 */
export default function BeverageGiftCardRouting() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
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
        setEnabled(!!configRes.data.beverageGiftCardMode);
        setRouting({
          ETB: configRes.data.beverageGiftCardRouting?.ETB || null,
          USD: configRes.data.beverageGiftCardRouting?.USD || null,
        });
      }
      if (cardsRes.status === "success") {
        setCards(cardsRes.data.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load beverage payment routing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggle = async (next: boolean) => {
    setTogglingMode(true);
    try {
      const res = await adminApi.patch("/config/payment/beverage-giftcard-mode", {
        enabled: next,
      });
      if (res.success) {
        setEnabled(next);
        toast.success(res.message || "Beverage gift card mode updated");
      } else {
        throw new Error(res.message || "Failed to update gift card mode");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTogglingMode(false);
    }
  };

  const handleSelect = async (currency: string, cardNumber: string) => {
    setSaving(currency);
    try {
      const res = await adminApi.patch("/config/payment/beverage-giftcard-routing", {
        currency,
        cardNumber,
      });
      if (res.success) {
        setRouting((r) => ({ ...r, [currency]: cardNumber }));
        toast.success(res.message || `${currency} beverage routing updated`);
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
          <CupSoda className="h-5 w-5" /> Event drink payment routing
          <Badge variant={enabled ? "default" : "secondary"} className="ml-1">
            {enabled ? "Gift card" : "Direct merchant"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Drinks a ticket-holder buys through the mobile app&apos;s
          &quot;refill&quot; checkout — kept apart from ticket money and
          cinema money so the channels never share a card&apos;s transaction
          history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Route drink payments to a gift card</Label>
            <p className="text-xs text-muted-foreground">
              Off settles to the merchant balance directly.
            </p>
          </div>
          <Switch checked={enabled} disabled={togglingMode || loading} onCheckedChange={handleToggle} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {CURRENCIES.map((currency) => {
            const options = cards.filter(
              (c) => c.currency === currency && c.status === 1
            );
            return (
              <div key={currency} className="space-y-1.5">
                <Label>{currency} drink gift card</Label>
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
        </div>
      </CardContent>
    </Card>
  );
}
