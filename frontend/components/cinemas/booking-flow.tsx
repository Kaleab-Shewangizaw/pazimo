"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import {
  Armchair,
  Loader2,
  Minus,
  Plus,
  Popcorn,
  ShoppingBasket,
  Ticket,
  X,
} from "lucide-react";
import {
  fetchShowtimeSeats,
  fetchPublicConcessions,
  quoteCinemaBasket,
  startCinemaCheckout,
  cancelCinemaCheckout,
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

// The film page's own accent, so the sheet reads as part of the page it opened
// from rather than as a generic dialog dropped on top of it.
const ACCENT =
  "bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-300";

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
  const { user } = useAuthStore();
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
        // NOT filtered again here.
        //
        // The public endpoint already returns only what is on sale and in
        // stock. This used to re-filter on `l.isAvailable`, a field that
        // endpoint does not send — so every item read as undefined, the list
        // came out empty, and the snacks step was skipped for every customer at
        // every cinema. A second filter over a projection you do not control is
        // a bug waiting for someone to trim a field.
        setConcessions(lineup);
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

  // Seed the paying number from the account as a starting point, not a lock:
  // the phone that approves the payment is often not the account's number, so
  // it stays editable and is only filled while still blank.
  useEffect(() => {
    if (user?.phoneNumber) {
      setDetails((d) => (d.phone ? d : { ...d, phone: user.phoneNumber || "" }));
    }
  }, [user]);

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

  // The per-line cap the server enforces. Kept in step with
  // cinemaCheckoutService.MAX_QUANTITY_PER_LINE.
  const MAX_PER_LINE = 20;

  /**
   * Set how many of one item the customer wants.
   *
   * Capped ONLY at the per-line maximum, never at a stock figure, because the
   * public listing deliberately does not expose one — it returns what is in
   * stock and withholds the sales numbers behind it. Depending on a figure that
   * is not sent is what broke this: `Math.min(undefined, 20)` is NaN, every
   * quantity became NaN, `qty > 0` filtered them all out, and no snack ever
   * reached the order however many times it was clicked.
   *
   * Running out between here and payment is handled where it can be handled
   * atomically — the stock claim at fulfilment — not by a number the browser
   * read some seconds ago.
   */
  const setSnackQty = (id: string, next: number) => {
    const wanted = Number.isFinite(next) ? next : 0;
    setSnacks((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(wanted, MAX_PER_LINE)),
    }));
  };

  // A started order that the customer walks away from.
  //
  // startCheckout locks the seats before calling the provider, so backing out
  // of the pay step without this leaves them locked for the full ten minutes.
  // Cleared on success too, so a paid order is never cancelled.
  const [startedRef, setStartedRef] = useState<string | null>(null);

  const abandonIfStarted = async () => {
    if (!startedRef) return;
    const ref = startedRef;
    setStartedRef(null);
    await cancelCinemaCheckout(ref).catch(() => {});
    // The picker has to be refetched: those seats are free again, and showing
    // them as still selected would be a lie.
    fetchShowtimeSeats(showtimeId).then(setSeatMap).catch(() => {});
    setSelected([]);
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
        // A signed-in customer's name and email come from the account rather
        // than from fields they were not shown.
        customerName:
          (user
            ? [user.firstName, user.lastName].filter(Boolean).join(" ")
            : details.name.trim()) || undefined,
        customerEmail: (user ? user.email : details.email.trim()) || undefined,
        method,
      });
      // Cards go to a hosted page; mobile money does not. A direct charge puts
      // the prompt on the customer's phone and never leaves the site, so
      // redirecting them to a checkout page for a charge they have already been
      // asked to approve is the wrong thing to do.
      // Remembered only long enough for the Back button to release it. Cleared
      // the moment we hand off to a provider, because from then on the order is
      // in flight and cancelling it would strand a payment in progress.
      setStartedRef(result.transactionId);

      if (result.action === "redirect" && result.checkoutUrl) {
        setStartedRef(null);
        window.location.href = result.checkoutUrl;
        return;
      }
      setStartedRef(null);
      toast.success("Approve the payment on your phone");
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
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-6 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the room…
      </div>
    );
  }

  if (!seatMap?.assignedSeating) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          This screening sells general admission — seat selection is not available
          for it.
        </p>
      </div>
    );
  }

  // The hall was given a seat map after this screening was scheduled, so its
  // tiers still price seat COUNTS rather than seat categories. Every seat would
  // refuse to be added; saying so beats a room where nothing works.
  if (seatMap.needsRepricing) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            This screening isn&apos;t open for seat booking yet
          </p>
          <p className="mt-1.5 leading-relaxed text-amber-800 dark:text-amber-300/90">
            The cinema has just set up seating for this hall and needs to set a
            price for each type of seat. Try another screening, or buy at the box
            office.
          </p>
        </div>
      </div>
    );
  }

  const currency = seatMap.currency || "ETB";
  const seatCount = selected.length;

  const goBack =
    step === "seats"
      ? { label: "Cancel", run: onClose }
      : step === "snacks"
        ? { label: "Back", run: () => setStep("seats") }
        : {
            label: "Back",
            run: async () => {
              await abandonIfStarted();
              setStep(concessions.length ? "snacks" : "seats");
            },
          };

  const goNext =
    step === "seats"
      ? {
          label: concessions.length ? "Add snacks" : "Continue",
          run: () => setStep(concessions.length ? "snacks" : "pay"),
          disabled: seatCount === 0 || !basket,
        }
      : step === "snacks"
        ? {
            label: "Continue to payment",
            run: () => setStep("pay"),
            disabled: !basket,
          }
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* --- step rail ------------------------------------------------------ */}
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {(
            [
              ["seats", "Seats", Armchair],
              ["snacks", "Snacks", Popcorn],
              ["pay", "Pay", Ticket],
            ] as [Step, string, typeof Armchair][]
          )
            .filter(([value]) => value !== "snacks" || concessions.length > 0)
            .map(([value, label, Icon], index, list) => {
              const order: Step[] = ["seats", "snacks", "pay"];
              const active = step === value;
              const done = order.indexOf(step) > order.indexOf(value);
              return (
                <div key={value} className="flex flex-1 items-center gap-1.5 last:flex-none sm:gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                      active
                        ? "bg-[#0D47A1] text-white dark:bg-yellow-400 dark:text-black"
                        : done
                          ? "bg-[#0D47A1]/10 text-[#0D47A1] dark:bg-yellow-400/15 dark:text-yellow-300"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                  {index < list.length - 1 && (
                    <span
                      className={`h-px flex-1 ${done ? "bg-[#0D47A1]/40 dark:bg-yellow-400/40" : "bg-border"}`}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* --- the step itself ------------------------------------------------ */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {step === "seats" && (
          <div className="space-y-4">
            <SeatPlan
              seatMap={seatMap}
              selected={selected}
              onToggle={toggleSeat}
              priceByCategory={priceByCategory}
              currency={currency}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {(seatMap.categories || []).map((category) => (
                <span key={category.key} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ backgroundColor: category.color || "#6366f1" }}
                  />
                  {category.label}
                  <span className="font-medium text-foreground">
                    {money(category.price ?? 0, currency)}
                  </span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-muted-foreground/30" />
                Taken
              </span>
            </div>

            {/* What you have picked, with a way to drop one without hunting
                for it back in the grid. */}
            {seatCount > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {selected.map((seatKey) => (
                  <button
                    key={seatKey}
                    type="button"
                    onClick={() => toggleSeat(seatKey, "available")}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-2 text-xs font-medium transition-colors hover:border-destructive/50 hover:text-destructive"
                  >
                    {seatKey}
                    <X className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "snacks" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <ShoppingBasket className="mt-0.5 h-4 w-4 shrink-0 text-[#0D47A1] dark:text-yellow-400" />
              <p className="text-sm text-muted-foreground">
                Anything from the counter? Collect it on the night — no queue.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {concessions.map((item) => {
                const qty = snacks[item._id] || 0;
                // No sold-out state here: the public listing only returns items
                // that are on sale and have something left, so anything rendered
                // is buyable. It used to derive one from `stockRemaining`, which
                // this endpoint does not send.
                return (
                  <div
                    key={item._id}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                      qty > 0
                        ? "border-[#0D47A1] bg-[#0D47A1]/5 dark:border-yellow-400/60 dark:bg-yellow-400/5"
                        : "border-border"
                    }`}
                  >
                    {/* The artwork the admin uploaded for this product.
                        Falls back to the brand colour with an icon, which is what
                        this always showed — so a product with no image still
                        renders as something rather than an empty box. */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{
                        backgroundColor: item.beverage?.image
                          ? undefined
                          : item.beverage?.color || "#6366f1",
                      }}
                    >
                      {item.beverage?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL}${item.beverage.image}`}
                          alt={item.beverage.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Popcorn className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.beverage?.name}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {money(item.price, currency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full"
                        disabled={qty === 0}
                        onClick={() => setSnackQty(item._id, qty - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                        <span className="sr-only">One fewer {item.beverage?.name}</span>
                      </Button>
                      <span className="w-5 text-center text-sm font-medium tabular-nums">
                        {qty}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full"
                        disabled={qty >= MAX_PER_LINE}
                        onClick={() => setSnackQty(item._id, qty + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only">One more {item.beverage?.name}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "pay" && (
          <div className="space-y-5">
            {/* A signed-in customer is only asked for the paying number.
                Their name and email are already known, and re-asking implies we
                might send the ticket somewhere other than their account — which
                we do not. The paying number still has to be asked for: it is the
                wallet being charged, and it is often not the account's number. */}
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Booking as</span>
                  <span className="truncate font-medium">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      user.email}
                  </span>
                </div>
                <div>
                  <Label className="text-xs">Phone to pay from</Label>
                  <Input
                    className="mt-1.5"
                    inputMode="tel"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    placeholder="09…"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The number that will approve the payment. Your ticket goes to
                    your account either way.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="mt-1.5"
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone (for payment)</Label>
                  <Input
                    className="mt-1.5"
                    inputMode="tel"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    placeholder="09…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email (optional)</Label>
                  <Input
                    className="mt-1.5"
                    inputMode="email"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            )}

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
              <div className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
                {basket.tickets.map((t) => (
                  <div key={t.seatKey} className="flex justify-between gap-3">
                    <span>
                      Seat {t.seatKey}{" "}
                      <span className="text-muted-foreground">({t.categoryLabel})</span>
                    </span>
                    <span className="tabular-nums">{money(t.price, currency)}</span>
                  </div>
                ))}
                {basket.concessions.map((c) => (
                  <div key={c.cinemaBeverage} className="flex justify-between gap-3">
                    <span>
                      {c.name}{" "}
                      <span className="text-muted-foreground">× {c.quantity}</span>
                    </span>
                    <span className="tabular-nums">{money(c.lineTotal, currency)}</span>
                  </div>
                ))}
                <div className="mt-2.5 flex justify-between gap-3 border-t border-border pt-2.5 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(basket.total, currency)}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Your seats are held for {seatMap.holdMinutes ?? 10} minutes while you
              pay.
            </p>
          </div>
        )}
      </div>

      {/* --- what it costs, and the way on -------------------------------- */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2 text-sm">
            {basket ? (
              <>
                <span className="text-lg font-semibold tabular-nums">
                  {money(basket.total, currency)}
                </span>
                <span className="text-muted-foreground">
                  {basket.tickets.length} seat{basket.tickets.length === 1 ? "" : "s"}
                  {basket.concessions.length
                    ? ` · ${basket.concessions.length} item${basket.concessions.length === 1 ? "" : "s"}`
                    : ""}
                </span>
                {quoting && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Pick your seats to see the price
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={goBack.run}
            >
              {goBack.label}
            </Button>
            {goNext ? (
              <Button
                className={`flex-1 sm:flex-none ${ACCENT}`}
                onClick={goNext.run}
                disabled={goNext.disabled}
              >
                {goNext.label}
              </Button>
            ) : (
              <Button
                className={`flex-1 sm:flex-none ${ACCENT}`}
                disabled={paying || !basket || !details.phone.trim() || !method}
                onClick={pay}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  `Pay ${basket ? money(basket.total, currency) : ""}`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The room, drawn to fit.
 *
 * A hall is as wide as it is; a phone is not. Rather than let the grid run off
 * the edge — which is what it used to do, silently hiding the back columns —
 * the seat size is derived from the space actually available, so the whole
 * plan is on screen at once. Only a genuinely enormous hall falls back to
 * sideways scrolling, and it is told to scroll.
 */
function SeatPlan({
  seatMap,
  selected,
  onToggle,
  priceByCategory,
  currency,
}: {
  seatMap: ShowtimeSeatMap;
  selected: string[];
  onToggle: (seatKey: string, status: string) => void;
  priceByCategory: Map<string, { label: string; price: number; color?: string }>;
  currency: string;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    );
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const rows = seatMap.rows || [];
  const columns = rows.reduce((widest, row) => Math.max(widest, row.seats.length), 0);

  // 20px of row letter, then whatever is left shared between the seats. The
  // floor stops seats shrinking into targets no thumb can hit; the ceiling
  // stops a four-seat screening-room drawing armchairs the size of a hand.
  const GAP = 4;
  const LABEL = 22;
  const fitted = columns
    ? Math.floor((width - LABEL * 2 - GAP * columns) / columns)
    : 28;
  const seat = Math.max(18, Math.min(34, fitted || 28));
  const scrolls = width > 0 && fitted < 18;
  const showNumbers = seat >= 24;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-muted/50 to-transparent p-3 dark:from-[#12161d] dark:to-[#0d1015] sm:p-5">
      {/* The screen, and the light coming off it. Front rows sit in the glow. */}
      <div className="relative mx-auto mb-5 w-[70%] min-w-[180px] max-w-sm">
        <div
          className="h-1.5 bg-gradient-to-r from-transparent via-foreground/40 to-transparent dark:via-yellow-200/70"
          style={{ borderRadius: "50% 50% 6px 6px / 90% 90% 6px 6px" }}
        />
        <div className="absolute left-1/2 top-1.5 h-14 w-[130%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,theme(colors.foreground/12%),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(250,204,21,0.16),transparent_70%)]" />
        <p className="relative mt-2 text-center text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          Screen
        </p>
      </div>

      <div
        ref={viewport}
        className={scrolls ? "overflow-x-auto pb-2" : "overflow-hidden"}
      >
        <div
          className="mx-auto flex flex-col items-center"
          style={{ gap: GAP, width: scrolls ? "max-content" : undefined }}
        >
          {rows.map((row, rowIndex) => (
            // Keyed by position, not row.label: a row with no seats (a blank
            // space between blocks of seating) carries no label at all, and
            // more than one of those would collide on the label alone.
            <div key={rowIndex} className="flex items-center" style={{ gap: GAP }}>
              <span
                className="shrink-0 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                style={{ width: LABEL }}
              >
                {row.label}
              </span>
              <div
                className="flex items-center"
                style={{
                  gap: GAP,
                  transform: `translateY(${row.curve * 0.35}px) translateX(${row.offset * 0.5}px)`,
                }}
              >
                {row.seats.map((s) => {
                  if (s.status === "gap") {
                    return (
                      <span
                        key={s.seatKey}
                        style={{ width: seat, height: seat }}
                        aria-hidden
                      />
                    );
                  }
                  const isSelected = selected.includes(s.seatKey);
                  const category = priceByCategory.get(s.categoryKey);
                  const unavailable =
                    s.status === "sold" ||
                    s.status === "held" ||
                    s.status === "blocked";
                  return (
                    <button
                      key={s.seatKey}
                      type="button"
                      disabled={unavailable}
                      aria-pressed={isSelected}
                      onClick={() => onToggle(s.seatKey, s.status)}
                      title={
                        unavailable
                          ? `${s.seatKey} — taken`
                          : `${s.seatKey} · ${category?.label ?? ""} · ${money(category?.price ?? 0, currency)}`
                      }
                      className={`relative flex items-center justify-center rounded-t-[7px] rounded-b-sm font-semibold leading-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                        unavailable
                          ? "cursor-not-allowed bg-muted-foreground/25 text-transparent"
                          : isSelected
                            ? "text-white ring-2 ring-foreground ring-offset-2 ring-offset-background motion-safe:scale-110"
                            : "text-white/90 motion-safe:hover:-translate-y-0.5"
                      }`}
                      style={{
                        width: seat,
                        height: seat,
                        fontSize: Math.max(8, Math.round(seat * 0.36)),
                        ...(unavailable
                          ? {}
                          : { backgroundColor: category?.color || "#6366f1" }),
                      }}
                    >
                      {showNumbers && !unavailable && <span>{s.number}</span>}
                      <span className="sr-only">
                        Row {row.label} seat {s.number}
                        {unavailable ? " (taken)" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="shrink-0" style={{ width: LABEL }} aria-hidden />
            </div>
          ))}
        </div>
      </div>

      {scrolls && (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          Swipe sideways to see the whole row
        </p>
      )}
    </div>
  );
}
