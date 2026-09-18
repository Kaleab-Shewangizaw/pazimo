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
import { Martini } from "lucide-react";
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
 * Which gift card receives VENUE drink payments (per currency), and whether
 * that routing is even on. Kept apart from every other channel's routing so
 * a venue's takings never share a card's transaction history with ticket,
 * event-drink or cinema money — a different owner's money entirely.
 */
export default function VenueGiftCardRouting() {
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
        setEnabled(!!configRes.data.venueBeverageGiftCardMode);
        setRouting({
          ETB: configRes.data.venueBeverageGiftCardRouting?.ETB || null,
          USD: configRes.data.venueBeverageGiftCardRouting?.USD || null,
        });
      }
      if (cardsRes.status === "success") {
        setCards(cardsRes.data.items || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load venue payment routing");
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
      const res = await adminApi.patch("/config/payment/venue-beverage-giftcard-mode", {
        enabled: next,
      });
      if (res.success) {
        setEnabled(next);
        toast.success(res.message || "Venue gift card mode updated");
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
      const res = await adminApi.patch("/config/payment/venue-beverage-giftcard-routing", {
        currency,
        cardNumber,
      });
      if (res.success) {
        setRouting((r) => ({ ...r, [currency]: cardNumber }));
        toast.success(res.message || `${currency} venue routing updated`);
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
          <Martini className="h-5 w-5" /> Venue drink payment routing
          <Badge variant={enabled ? "default" : "secondary"} className="ml-1">
            {enabled ? "Gift card" : "Direct merchant"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Drinks a customer buys through the mobile app at a venue — kept
          apart from every other channel so venue money never shares a
          card&apos;s transaction history.
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
                <Label>{currency} venue gift card</Label>
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
