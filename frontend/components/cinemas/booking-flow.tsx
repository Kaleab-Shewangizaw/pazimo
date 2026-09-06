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
import CinemaOrderResult from "@/components/cinemas/cinema-order-result";

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

type Step = "seats" | "snacks" | "pay" | "confirm";

// The film page's own accent, so the sheet reads as part of the page it opened
// from rather than as a generic dialog dropped on top of it.
const ACCENT =
  "bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-300";

export default function BookingFlow({
  showtimeId,
  cinemaId,
  onClose,
  onBareTicket,
}: {
  showtimeId: string;
  cinemaId: string;
  onClose?: () => void;
  /**
   * Fires once the "confirm" step's order actually settles — lets the
   * dialog embedding this whole flow drop its own header/border/background
   * at exactly that point, the way the event checkout swaps into a bare,
   * transparent dialog once its tickets are ready rather than keeping its
   * normal chrome framing them. Forwarded straight from CinemaOrderResult's
   * own onSettledChange; BookingFlow has no reason to hold this itself.
   */
  onBareTicket?: (bare: boolean) => void;
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
  // Set once a direct (mobile money) charge is placed — the "confirm" step
  // polls and shows the result for this transaction right in the sheet,
  // instead of navigating to a separate page the way a hosted checkout must.
  const [confirmingTx, setConfirmingTx] = useState<string | null>(null);

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
      setConfirmingTx(result.transactionId);
      setStep("confirm");
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
        : step === "pay"
          ? {
              label: "Back",
              run: async () => {
                await abandonIfStarted();
                setStep(concessions.length ? "snacks" : "seats");
              },
            }
          : { label: "Back", run: () => {} }; // "confirm" — footer is hidden, never rendered

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
      {step !== "confirm" && (
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
      )}

      {/* --- the step itself ------------------------------------------------
          SeatPlan fills the space itself and fits its seat size to whatever
          height is actually left, so picking a seat isn't usually scrolling
          past the legend to find the last row — but this wrapper still
          allows a scroll (rather than `overflow-hidden`) for whenever the
          screen graphic + legend + summary card's own fixed heights leave
          less room than even a fully-shrunk grid needs: clipping that
          silently would hide real content with no way back to it. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {step === "seats" && (
          <div className="flex h-full min-h-[420px] flex-col">
            <SeatPlan
              seatMap={seatMap}
              selected={selected}
              onToggle={toggleSeat}
              priceByCategory={priceByCategory}
              currency={currency}
            />
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
                  <div key={t.ticketTypeId} className="flex justify-between gap-3">
                    <span>
                      {t.seats.length > 0
                        ? `Seat${t.seats.length > 1 ? "s" : ""} ${t.seats.map((s) => s.seatKey).join(", ")}`
                        : `${t.ticketType} × ${t.quantity}`}{" "}
                      <span className="text-muted-foreground">
                        ({t.seats[0]?.categoryLabel || t.ticketType})
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {money(t.price * t.quantity, currency)}
                    </span>
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

        {step === "confirm" && confirmingTx && (
          <CinemaOrderResult
            transactionId={confirmingTx}
            embedded
            onExit={onClose}
            onSettledChange={onBareTicket}
          />
        )}
      </div>

      {/* --- what it costs, and the way on --------------------------------
          Hidden during "confirm": CinemaOrderResult renders its own actions
          (retry/cancel/Done), and there is no basket total left to quote. */}
      {step !== "confirm" && (
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2 text-sm">
            {basket ? (
              <>
                <span className="text-lg font-semibold tabular-nums">
                  {money(basket.total, currency)}
                </span>
                <span className="text-muted-foreground">
                  {seatCount} seat{seatCount === 1 ? "" : "s"}
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
      )}
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
/**
 * Matches the mobile app's seat picker (pazimo-mobile/src/components/cinema/
 * seat-map.tsx) look exactly: a fixed dark "auditorium" card — Pazimo mobile
 * is dark-only by design, and this is the one piece of the web checkout that
 * borrows that identity wholesale rather than following the site's own
 * light/dark toggle, the same way a video player keeps its own chrome dark
 * regardless of the page around it. Screen up top, category legend right
 * under it (established before anyone starts tapping), the seat grid, then a
 * fixed-footprint "YOUR SEATS" summary at the bottom — same order, same
 * palette (`#08080A` ground, `#4A4A52`/`#6E6E78` for an available seat,
 * white for a selected one) as the reference.
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
  const gridArea = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  // The reference app zooms by pinch gesture; a web pointer has no
  // equivalent, so this is its stand-in — a manual override on top of the
  // auto-fit size below, for a customer who finds the auto-fit seats too
  // small to comfortably tap.
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.75;
  const ZOOM_MAX = 1.75;
  const ZOOM_STEP = 0.15;

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

  // Only ever used to decide whether the grid needs to scroll internally —
  // never to shrink the seats themselves. Sizing seats off available height
  // as well as width (an earlier version of this did) fought the floor below
  // on any hall with more than a handful of rows, shrinking every seat down
  // to the bare minimum just to avoid a scrollbar. A comfortable, width-fit
  // seat that occasionally needs a short scroll to reach the back row beats a
  // seat sized to fit no matter how many rows there are.
  useEffect(() => {
    const node = gridArea.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setGridHeight(entry.contentRect.height)
    );
    observer.observe(node);
    setGridHeight(node.clientHeight);
    return () => observer.disconnect();
  }, []);

  const rows = seatMap.rows || [];
  const columns = rows.reduce((widest, row) => Math.max(widest, row.seats.length), 0);

  // 22px of row letter, then whatever is left shared between the seats. The
  // floor stops seats shrinking into targets no thumb can hit; the ceiling
  // stops a four-seat screening-room drawing armchairs the size of a hand.
  const GAP = 5;
  const LABEL = 22;
  const ROW_GAP = GAP + 3; // matches the rows column's own `gap` below
  const widthFit = columns
    ? Math.floor((width - LABEL * 2 - GAP * columns) / columns)
    : 28;
  const baseSeat = Math.max(24, Math.min(34, widthFit || 28));
  const seat = Math.max(18, Math.min(56, Math.round(baseSeat * zoom)));
  const glyph = Math.round(seat * 0.8);
  // Recomputed off the ACTUAL (possibly zoomed) seat size, rather than off
  // widthFit alone — zooming in is exactly what asks this to go horizontal.
  const neededWidth = LABEL * 2 + columns * seat + GAP * Math.max(0, columns - 1);
  const scrollsX = width > 0 && neededWidth > width;
  const contentHeight = rows.length * seat + Math.max(0, rows.length - 1) * ROW_GAP;
  const scrollsY = gridHeight > 0 && contentHeight > gridHeight;

  const selectedSet = new Set(selected);

  // What's been picked so far, grouped by category — "VIP A6, A7" rather
  // than a bare seat list, so the price attached to each pick is legible at
  // a glance. Same grouping the reference app's own SelectionSummary reads.
  const pickedGroups = (() => {
    const byCategory = new Map<string, { label: string; price: number; seats: string[] }>();
    for (const row of rows) {
      for (const s of row.seats) {
        if (s.status === "gap" || !selectedSet.has(s.seatKey)) continue;
        const category = priceByCategory.get(s.categoryKey);
        if (!category) continue;
        const group =
          byCategory.get(s.categoryKey) ??
          { label: category.label, price: category.price, seats: [] as string[] };
        group.seats.push(`${row.label}${s.number}`);
        byCategory.set(s.categoryKey, group);
      }
    }
    return [...byCategory.values()];
  })();
  const totalCount = pickedGroups.reduce((sum, g) => sum + g.seats.length, 0);
  const totalPrice = pickedGroups.reduce((sum, g) => sum + g.price * g.seats.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[20px] border border-white/10 bg-[#08080A] p-3 sm:p-5">
      <CinemaScreen />

      {/* Established up front, before anyone starts tapping — the seat dots
          alone don't explain themselves. */}
      {(seatMap.categories || []).length > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {(seatMap.categories || []).map((category) => (
            <span key={category.key} className="inline-flex items-center gap-1.5 text-xs text-white/65">
              <span
                className="h-[9px] w-[9px] shrink-0 rounded-full"
                style={{ backgroundColor: category.color || "#6366f1" }}
              />
              {category.label} · {money(category.price ?? 0, currency)}
            </span>
          ))}
        </div>
      )}

      {/* relative z-10: guarantees this paints above CinemaScreen no matter
          what, since the front row's seats curve up toward it (capped below,
          but still real movement) — belt-and-suspenders alongside that cap
          and CinemaScreen's own pointer-events-none.
          pt-4: headroom for that same curve so overflow-y-auto never clips
          the part of a seat that moved above this container's own top edge,
          taking its click target with it. */}
      <div ref={gridArea} className="relative z-10 min-h-0 flex-1 overflow-y-auto pt-4">
      <div ref={viewport} className={scrollsX ? "overflow-x-auto pb-2" : undefined}>
        <div
          className="mx-auto flex flex-col items-center"
          style={{ gap: GAP + 3, width: scrollsX ? "max-content" : undefined }}
        >
          {rows.map((row, rowIndex) => {
            const count = row.seats.length;
            const center = (count - 1) / 2;

            return (
              // Keyed by position, not row.label: a row with no seats (a blank
              // space between blocks of seating) carries no label at all, and
              // more than one of those would collide on the label alone.
              <div
                key={rowIndex}
                className="flex items-center"
                style={{ gap: GAP, marginLeft: row.offset * 0.5 }}
              >
                <span
                  className="shrink-0 text-center text-[10px] font-semibold uppercase text-white/40"
                  style={{ width: LABEL }}
                >
                  {row.label}
                </span>

                <div className="flex items-center" style={{ gap: GAP }}>
                  {row.seats.map((s, i) => {
                    if (s.status === "gap") {
                      // Not s.seatKey: a gap keeps whatever number it had
                      // before a neighboring seat was removed, so it can
                      // collide with a real seat's key. Position is unique.
                      return <span key={i} style={{ width: seat, height: seat }} aria-hidden />;
                    }
                    // Bow the row into a gentle arc, seat by seat, instead of
                    // shifting it as one rigid block — this is what makes the
                    // curve read as a real auditorium and not a tilted strip.
                    //
                    // Capped regardless of what a room configures: the front
                    // row has no row above it to absorb this move, only the
                    // fixed headroom this component itself reserves next to
                    // the screen graphic — an uncapped curve could push a
                    // seat's clickable area past that headroom and behind it.
                    const effectiveCurve = Math.min(row.curve, 8);
                    const t = center === 0 ? 0 : (i - center) / center;
                    const translateY = -effectiveCurve * 0.45 * (1 - t * t);
                    const isSelected = selectedSet.has(s.seatKey);
                    const category = priceByCategory.get(s.categoryKey);
                    const unavailable =
                      s.status === "sold" ||
                      s.status === "held" ||
                      s.status === "blocked";
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={unavailable}
                        aria-pressed={isSelected}
                        onClick={() => onToggle(s.seatKey, s.status)}
                        title={
                          unavailable
                            ? `${s.seatKey} — taken`
                            : `${s.seatKey} · ${category?.label ?? ""} · ${money(category?.price ?? 0, currency)}`
                        }
                        style={{ width: seat, height: seat, transform: `translateY(${translateY}px)` }}
                        className="flex shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#08080A] disabled:cursor-not-allowed"
                      >
                        <span className="flex h-full w-full items-center justify-center transition-transform motion-safe:hover:scale-110 motion-safe:active:scale-90">
                          <SeatGlyph
                            size={glyph}
                            selected={isSelected}
                            disabled={unavailable}
                            categoryColor={category?.color}
                          />
                        </span>
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
            );
          })}
        </div>
      </div>

      {scrollsX && (
        <p className="mt-1 text-center text-[10px] text-white/40">
          Swipe sideways to see the whole row
        </p>
      )}

      {/* Floating over the grid, like the reference app's own reset-zoom
          control — a customer who finds the auto-fit seats too small just
          makes them bigger, at the cost of the horizontal scroll above once
          a row no longer fits the width unzoomed. */}
      <div className="pointer-events-none sticky bottom-2 z-20 flex justify-end pr-1">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.14] p-1 shadow-[0_6px_16px_rgba(0,0,0,0.38)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Smaller seats"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Bigger seats"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      </div>

      {scrollsY && (
        <p className="mt-1 text-center text-[10px] text-white/40">
          Scroll to see the rest of the room
        </p>
      )}

      {/* Always rendered, fixed footprint — its height must never change
          with the selection. Mounting this only once something is picked
          would shrink the grid's own available space at the exact moment a
          customer just tapped a seat, which can clip the row it's in. */}
      <div className="mt-4 shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Your seats
          </span>
          <span className="shrink-0 text-sm font-bold text-white">
            {totalCount > 0
              ? `${totalCount} ${totalCount === 1 ? "seat" : "seats"} · ${money(totalPrice, currency)}`
              : "None yet"}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-white/75">
          {totalCount > 0
            ? pickedGroups.map((g) => `${g.label} ${g.seats.join(", ")}`).join("   ·   ")
            : "Tap a seat above to select it"}
        </p>
      </div>
    </div>
  );
}

/**
 * The curved cinema screen and the reflection it casts, drawn as two nested
 * SVG paths that share one edge — so the glow reads as a single continuous
 * surface rather than a bar sitting above a separate gradient block. A pure
 * white glow rather than the site's own accent, matching the reference app
 * exactly (Pazimo mobile is dark-only, white-on-black, by design — see the
 * note on SeatPlan above). A soft halo bleeds past its edges and its hottest
 * point breathes slowly, the way light off a running projector never sits
 * quite still — the one deliberately alive element on an otherwise static
 * picker.
 *
 * `pointer-events-none`: purely decorative (`aria-hidden` already says so),
 * and the front row's seats curve up toward it — without this, this element
 * sits on top of that curve and swallows the taps meant for those seats.
 */
function CinemaScreen() {
  return (
    <div
      aria-hidden
      className="relative mx-auto mb-7 w-[78%] min-w-[180px] max-w-sm select-none pointer-events-none text-white"
    >
      {/* Halo: the beam bleeding past the screen's own edges into the room */}
      <div
        className="absolute inset-x-6 -top-3 h-14 rounded-[100%] bg-white opacity-[0.10] blur-xl sm:h-16"
        aria-hidden
      />

      <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="relative block h-16 w-full sm:h-20">
        <defs>
          <radialGradient id="cinema-screen-fill" cx="50%" cy="0%" r="85%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" className="cinema-screen-pulse" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.17" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
          </radialGradient>
        </defs>
        <path d="M 0,22 Q 50,0 100,22 L 95,44 Q 50,28 5,44 Z" fill="url(#cinema-screen-fill)" />
      </svg>

      <div className="relative -mt-7 h-11 overflow-hidden sm:-mt-9 sm:h-14">
        <svg viewBox="0 44 100 22" preserveAspectRatio="none" className="block h-full w-full opacity-40">
          <defs>
            <linearGradient id="cinema-screen-reflection" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
              <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.13" />
              <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 5,44 Q 50,28 95,44 L 100,66 Q 50,58 0,66 Z" fill="url(#cinema-screen-reflection)" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#08080A]" />
      </div>

      <p className="relative mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">
        — Screen —
      </p>
    </div>
  );
}

/**
 * The seat itself — an armchair, not a coloured square. A neutral shell reads
 * as furniture at any size; the category shows up as a small dot instead of
 * painting the whole seat, which is what let the grid turn into a wall of
 * saturated colour once a hall had more than two tiers. Palette lifted
 * straight from the reference app's own SeatGlyph.
 */
function SeatGlyph({
  size,
  selected,
  disabled,
  categoryColor,
}: {
  size: number;
  selected: boolean;
  disabled: boolean;
  categoryColor?: string;
}) {
  const fill = selected ? "#FFFFFF" : disabled ? "rgba(255,255,255,0.08)" : "#4A4A52";
  const stroke = selected ? "#FFFFFF" : disabled ? "rgba(255,255,255,0.12)" : "#6E6E78";
  // The cushion's notch cutout has to match whatever's actually behind the
  // seat for the "cutout" illusion to hold — the reference app uses a
  // slightly different near-black per state for exactly that reason.
  const notch = selected ? "#121215" : disabled ? "#08080A" : "#141418";

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        {/* Backrest top bar */}
        <rect x="4.5" y="2" width="15" height="4.5" rx="2" fill={fill} stroke={stroke} strokeWidth={1} />
        {/* Left armrest */}
        <rect x="2" y="5.5" width="4" height="14.5" rx="2" fill={fill} stroke={stroke} strokeWidth={1} />
        {/* Right armrest */}
        <rect x="18" y="5.5" width="4" height="14.5" rx="2" fill={fill} stroke={stroke} strokeWidth={1} />
        {/* Seat cushion */}
        <rect x="4.5" y="9.5" width="15" height="10.5" rx="2.5" fill={fill} stroke={stroke} strokeWidth={1} />
        {/* Cushion notch cutout */}
        <rect x="6.5" y="7" width="11" height="5" rx="1.5" fill={notch} />
      </svg>
      {!disabled && !selected && categoryColor && (
        <span
          className="absolute bottom-0 right-0 h-[5px] w-[5px] rounded-full opacity-85"
          style={{ backgroundColor: categoryColor }}
        />
      )}
    </span>
  );
}
