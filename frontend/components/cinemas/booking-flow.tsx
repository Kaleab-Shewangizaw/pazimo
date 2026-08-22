"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import {
  Armchair,
  Loader2,
  Minus,
  Plus,
  Popcorn,
  ShoppingBasket,
  Ticket,
} from "lucide-react";
import {
  fetchShowtimeSeats,
  fetchPublicConcessions,
  quoteCinemaBasket,
  startCinemaCheckout,
  type CinemaBasket,
  type CinemaConcession,
  type ShowtimeSeatMap,
} from "@/lib/cinema-api";

/**
 * Buying a seat: pick where you sit, add snacks, pay.
 *
 * Three steps, in the order a cinema actually works. Snacks come AFTER seats
 * because a customer who has not chosen where to sit has not decided to come;
 * asking about popcorn first is asking someone to shop before they have bought.
 *
 * No total shown here is authoritative. Every figure comes from the server's
 * own quote — the client sends WHICH seats and WHICH snacks and never what any
 * of it costs. The quote is re-requested on every change rather than summed
 * locally, so what the customer reads is always what they will be charged.
 */

const money = (n: number, currency = "ETB") =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

type Step = "seats" | "snacks" | "pay";

export default function BookingFlow({
  showtimeId,
  cinemaId,
  onClose,
}: {
  showtimeId: string;
  cinemaId: string;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<Step>("seats");
  const [seatMap, setSeatMap] = useState<ShowtimeSeatMap | null>(null);
  const [concessions, setConcessions] = useState<CinemaConcession[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [snacks, setSnacks] = useState<Record<string, number>>({});
  const [basket, setBasket] = useState<CinemaBasket | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [details, setDetails] = useState({ name: "", phone: "", email: "" });
  // Which provider the platform is on, and which method the customer picked.
  //
  // The provider is a PLATFORM setting read from the same endpoint the event
  // checkout reads. Hardcoding one here is what made cinema checkout the only
  // surface still calling SantimPay when it was unavailable, and the customer
  // saw a 500 rather than the other provider.
  const [provider, setProvider] = useState<"SANTIM" | "CHAPA">("SANTIM");
  const [method, setMethod] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchShowtimeSeats(showtimeId),
      // A cinema with no concession line-up is normal, not an error — the
      // snacks step simply has nothing to offer and is skipped.
      fetchPublicConcessions(cinemaId).catch(() => [] as CinemaConcession[]),
    ])
      .then(([map, lineup]) => {
        if (cancelled) return;
        setSeatMap(map);
        setConcessions(lineup.filter((l) => l.isAvailable));
      })
      .catch((error) => !cancelled && toast.error((error as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [showtimeId, cinemaId]);

  const priceByCategory = useMemo(() => {
    const map = new Map<string, { label: string; price: number; color?: string }>();
    for (const category of seatMap?.categories || []) {
      map.set(category.key, {
        label: category.label,
        price: category.price ?? 0,
        color: category.color,
      });
    }
    return map;
  }, [seatMap]);

  const snackLines = useMemo(
    () =>
      Object.entries(snacks)
        .filter(([, qty]) => qty > 0)
        .map(([cinemaBeverage, quantity]) => ({ cinemaBeverage, quantity })),
    [snacks]
  );

  // Re-quote on every change. Summing locally would drift from the server the
  // moment a price, a tier or a stock level moved.
  const refreshQuote = useCallback(async () => {
    if (selected.length === 0) {
      setBasket(null);
      return;
    }
    setQuoting(true);
    try {
      const quote = await quoteCinemaBasket({
        showtime: showtimeId,
        seats: selected,
        concessions: snackLines,
      });
      setBasket(quote);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setQuoting(false);
    }
  }, [showtimeId, selected, snackLines]);

  useEffect(() => {
    const timer = setTimeout(refreshQuote, 250);
    return () => clearTimeout(timer);
  }, [refreshQuote]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/config/payment/active`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const active = data?.data?.activeProvider;
        if (active === "CHAPA" || active === "SANTIM") setProvider(active);
      })
      // A failure here leaves the default. The server decides the provider
      // anyway — this only picks which method list to show, so being wrong
      // costs a re-pick, not a failed payment.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The method ids differ per provider ("Telebirr" vs "telebirr"), so a method
  // chosen under one is meaningless under the other.
  useEffect(() => {
    setMethod(provider === "CHAPA" ? "telebirr" : "Telebirr");
  }, [provider]);

  const toggleSeat = (seatKey: string, status: string) => {
    if (status !== "available") return;
    setSelected((current) =>
      current.includes(seatKey)
        ? current.filter((k) => k !== seatKey)
        : current.length >= 10
          ? (toast.error("You can book at most 10 seats in one order"), current)
          : [...current, seatKey]
    );
  };

  const setSnackQty = (id: string, next: number, max: number | null) => {
    const ceiling = max === null ? 20 : Math.min(max, 20);
    setSnacks((current) => ({ ...current, [id]: Math.max(0, Math.min(next, ceiling)) }));
  };

  const pay = async () => {
    if (!details.phone.trim()) {
      toast.error("A phone number is needed to pay");
      return;
    }
    if (!method) {
      toast.error("Choose how you want to pay");
      return;
    }
    setPaying(true);
    try {
      const result = await startCinemaCheckout({
        showtime: showtimeId,
        seats: selected,
        concessions: snackLines,
        phoneNumber: details.phone.trim(),
        customerName: details.name.trim() || undefined,
        customerEmail: details.email.trim() || undefined,
        method,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      // SantimPay pushes to the phone rather than redirecting, so the customer
      // is sent to the order page to wait for the webhook to land.
      toast.success("Check your phone to approve the payment");
      window.location.href = `/cinema/order/${result.transactionId}`;
    } catch (error) {
      toast.error((error as Error).message);
      // The server released the seats on failure, so the picker must be
      // refetched — showing them as still selected would be a lie.
      fetchShowtimeSeats(showtimeId).then(setSeatMap).catch(() => {});
      setSelected([]);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the room…
      </div>
    );
  }

  if (!seatMap?.assignedSeating) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        This screening sells general admission — seat selection is not available for it.
      </div>
    );
  }

  // The hall was given a seat map after this screening was scheduled, so its
  // tiers still price seat COUNTS rather than seat categories. Every seat would
  // refuse to be added; saying so beats a room where nothing works.
  if (seatMap.needsRepricing) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          This screening isn&apos;t open for seat booking yet
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">
          The cinema has just set up seating for this hall and needs to set a price
          for each type of seat. Try another screening, or buy at the box office.
        </p>
      </div>
    );
  }

  const currency = seatMap.currency || "ETB";

  return (
    <div className="space-y-6">
      {/* --- step indicator ------------------------------------------------ */}
      <div className="flex items-center gap-2 text-xs">
        {(
          [
            ["seats", "Seats", Armchair],
            ["snacks", "Snacks", Popcorn],
            ["pay", "Pay", Ticket],
          ] as [Step, string, typeof Armchair][]
        ).map(([value, label, Icon], index) => {
          const active = step === value;
          const done =
            (value === "seats" && step !== "seats") ||
            (value === "snacks" && step === "pay");
          return (
            <div key={value} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
              {index < 2 && <span className="h-px w-4 bg-border" />}
            </div>
          );
        })}
      </div>

      {/* --- seats ---------------------------------------------------------- */}
      {step === "seats" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-gradient-to-b from-muted/40 to-background p-5">
            <div className="mx-auto mb-6 w-2/3 min-w-[220px]">
              <div className="h-2 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              <p className="mt-1 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Screen
              </p>
            </div>

            <div className="space-y-2">
              {(seatMap.rows || []).map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {row.label}
                  </span>
                  <div
                    className="flex flex-1 items-center justify-center gap-1"
                    style={{
                      transform: `translateY(${row.curve * 0.35}px) translateX(${row.offset * 0.5}px)`,
                    }}
                  >
                    {row.seats.map((seat) => {
                      const isSelected = selected.includes(seat.seatKey);
                      const category = priceByCategory.get(seat.categoryKey);
                      if (seat.status === "gap") {
                        return <span key={seat.seatKey} className="h-6 w-6" />;
                      }
                      const unavailable =
                        seat.status === "sold" ||
                        seat.status === "held" ||
                        seat.status === "blocked";
                      return (
                        <button
                          key={seat.seatKey}
                          type="button"
                          disabled={unavailable}
                          onClick={() => toggleSeat(seat.seatKey, seat.status)}
                          title={
                            unavailable
                              ? `${seat.seatKey} — unavailable`
                              : `${seat.seatKey} · ${category?.label ?? ""} · ${money(category?.price ?? 0, currency)}`
                          }
                          className={`h-6 w-6 rounded-t-md text-[9px] font-semibold transition ${
                            unavailable
                              ? "cursor-not-allowed bg-muted text-muted-foreground/50"
                              : isSelected
                                ? "scale-110 text-white ring-2 ring-offset-1 ring-primary"
                                : "text-white hover:scale-110"
                          }`}
                          style={
                            unavailable
                              ? undefined
                              : { backgroundColor: category?.color || "#6366f1" }
                          }
                        >
                          {seat.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {(seatMap.categories || []).map((category) => (
              <span key={category.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: category.color || "#6366f1" }}
                />
                {category.label} · {money(category.price ?? 0, currency)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-muted" /> Taken
            </span>
          </div>

          <StepFooter
            basket={basket}
            quoting={quoting}
            currency={currency}
            disabled={selected.length === 0}
            label={
              concessions.length ? "Add snacks" : "Continue to payment"
            }
            onNext={() => setStep(concessions.length ? "snacks" : "pay")}
            onBack={onClose}
            backLabel="Cancel"
          />
        </div>
      )}

      {/* --- snacks --------------------------------------------------------- */}
      {step === "snacks" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">
              Anything from the counter? Collect it on the night.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {concessions.map((item) => {
              const qty = snacks[item._id] || 0;
              const remaining = item.stockRemaining;
              const soldOut = remaining !== null && remaining <= 0;
              return (
                <div
                  key={item._id}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                    soldOut ? "opacity-50" : ""
                  }`}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: item.beverage?.color || "#6366f1" }}
                  >
                    <Popcorn className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.beverage?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {money(item.price, currency)}
                      {soldOut
                        ? " · sold out"
                        : remaining !== null && remaining <= 10
                          ? ` · only ${remaining} left`
                          : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={qty === 0}
                      onClick={() => setSnackQty(item._id, qty - 1, remaining)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={soldOut}
                      onClick={() => setSnackQty(item._id, qty + 1, remaining)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <StepFooter
            basket={basket}
            quoting={quoting}
            currency={currency}
            label="Continue to payment"
            onNext={() => setStep("pay")}
            onBack={() => setStep("seats")}
            backLabel="Back to seats"
          />
        </div>
      )}

      {/* --- pay ------------------------------------------------------------ */}
      {step === "pay" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={details.name}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label className="text-xs">Phone (for payment)</Label>
              <Input
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                placeholder="09…"
              />
            </div>
            <div>
              <Label className="text-xs">Email (optional)</Label>
              <Input
                value={details.email}
                onChange={(e) => setDetails({ ...details, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* The same selector the event checkout uses, so the two flows offer
              the same methods and disable the same ones for a given number —
              a Telebirr prompt on an 07 line simply never arrives. */}
          <div>
            <Label className="mb-2 block text-xs">How do you want to pay?</Label>
            <PaymentMethodSelector
              phoneNumber={details.phone}
              selectedMethod={method}
              onSelect={setMethod}
              provider={provider}
              currency={currency === "USD" ? "USD" : "ETB"}
            />
          </div>

          {basket && (
            <div className="space-y-1 rounded-lg border border-border p-4 text-sm">
              {basket.tickets.map((t) => (
                <div key={t.seatKey} className="flex justify-between">
                  <span>
                    Seat {t.seatKey}{" "}
                    <span className="text-muted-foreground">({t.categoryLabel})</span>
                  </span>
                  <span className="tabular-nums">{money(t.price, currency)}</span>
                </div>
              ))}
              {basket.concessions.map((c) => (
                <div key={c.cinemaBeverage} className="flex justify-between">
                  <span>
                    {c.name} <span className="text-muted-foreground">× {c.quantity}</span>
                  </span>
                  <span className="tabular-nums">{money(c.lineTotal, currency)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(basket.total, currency)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Your seats are held for {seatMap.holdMinutes ?? 10} minutes while you pay.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(concessions.length ? "snacks" : "seats")}>
              Back
            </Button>
            <Button
              className="flex-1"
              size="lg"
              disabled={paying || !basket || !details.phone.trim() || !method}
              onClick={pay}
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting payment…
                </>
              ) : (
                `Pay ${basket ? money(basket.total, currency) : ""}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepFooter({
  basket,
  quoting,
  currency,
  label,
  onNext,
  onBack,
  backLabel,
  disabled,
}: {
  basket: CinemaBasket | null;
  quoting: boolean;
  currency: string;
  label: string;
  onNext: () => void;
  onBack?: () => void;
  backLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <div className="text-sm">
        {basket ? (
          <>
            <span className="text-muted-foreground">
              {basket.tickets.length} seat{basket.tickets.length === 1 ? "" : "s"}
              {basket.concessions.length ? ` · ${basket.concessions.length} item(s)` : ""}
            </span>
            <span className="ml-2 font-semibold tabular-nums">
              {money(basket.total, currency)}
            </span>
            {quoting && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </>
        ) : (
          <span className="text-muted-foreground">Pick your seats to see the price</span>
        )}
      </div>
      <div className="flex gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            {backLabel || "Back"}
          </Button>
        )}
        <Button onClick={onNext} disabled={disabled || !basket}>
          {label}
        </Button>
      </div>
    </div>
  );
}
