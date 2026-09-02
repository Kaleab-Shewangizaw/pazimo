"use client";

import { useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ScanLine, Popcorn, Armchair } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** A pre-bought item this order has not collected yet. */
type OwedItem = {
  _id: string;
  beverageName: string;
  beverageCategory?: string;
  quantity: number;
  totalAmount: number;
};

/** One CinemaTicket row, as the staff-facing lookup returns it. */
type StaffTicket = {
  ticketId: string;
  movieTitle: string;
  hallName?: string;
  ticketType: string;
  quantity: number;
  seat?: { row?: string; number?: string } | null;
  checkedIn: boolean;
  checkedAt?: string | null;
  status: string;
  paymentStatus: string;
};

/**
 * A scan or typed code, looked up but not yet acted on — the "here's what
 * this is" step, so staff confirm with a tap instead of the door admitting
 * the instant a camera decodes a frame. `tickets` holds one row for a
 * single-seat code, or every seat on the order for a whole-order code.
 */
type Pending = {
  kind: "ticket" | "order";
  code: string;
  tickets: StaffTicket[];
  owed: OwedItem[];
} | null;

type Outcome = {
  kind: "ok" | "error";
  title: string;
  detail: string;
  owed?: OwedItem[];
} | null;

/**
 * Pulls the code — and what KIND of code it is — out of whatever the scanner
 * hands back.
 *
 * Two kinds of cinema QR exist: a whole-ORDER code (`{ctx:"CINEMA_ORDER",
 * ref}`), shown once on the order confirmation page and covering every seat
 * bought in that checkout, and a single-SEAT code (`{ctx:"CINEMA", tid}`),
 * reachable from that one seat's own /ticket/{id} page — kept for a group
 * member arriving separately, and for every ticket issued before order-level
 * codes existed. They are tagged so the scanner never has to guess: treating
 * a forwarded single-seat link as if it admits the whole order would create
 * exactly the false-admission conflict this two-step flow exists to prevent.
 *
 * A bare typed/manual code carries no tag at all — the caller tries it as a
 * ticket id first and falls back to an order reference.
 *
 * An EVENT ticket is rejected here, before any request goes out. Its payload has
 * no `ctx`, and admitting one at a cinema would be meaningless: the check-in
 * endpoint only ever reads the CinemaTicket collection, so it would come back as
 * "not found" and look like a broken ticket rather than the wrong kind.
 */
const extractCode = (
  raw: string
): { kind?: "ticket" | "order"; code?: string; wrongKind?: boolean } => {
  const text = raw.trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      if (parsed.ctx === "CINEMA_ORDER" && parsed.ref) {
        return { kind: "order", code: String(parsed.ref) };
      }
      if (parsed.ctx === "CINEMA" && parsed.tid) return { kind: "ticket", code: String(parsed.tid) };
      // Shaped like a Pazimo ticket, but not a cinema one.
      if (parsed.tid) return { wrongKind: true };
      return {};
    }
  } catch {
    // Not JSON — fall through and treat it as a bare code.
  }

  return { code: text };
};

const readScan = (
  result:
    | string
    | { rawValue?: string; text?: string }
    | { rawValue?: string; text?: string }[]
    | undefined
): string => {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (Array.isArray(result)) return result[0]?.rawValue || result[0]?.text || "";
  return result.rawValue || result.text || "";
};

const seatLabel = (t: StaffTicket) =>
  t.seat?.row ? `Row ${t.seat.row} · Seat ${t.seat.number}` : `${t.ticketType} × ${t.quantity}`;

export default function CinemaScanner() {
  const { token } = useAuthStore();
  const [pending, setPending] = useState<Pending>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [confirming, setConfirming] = useState(false);
  const [manual, setManual] = useState("");
  const [collecting, setCollecting] = useState<string | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);
  // A ref rather than state: the camera fires many frames per second and state
  // would not have committed before the next one arrived, so the same code
  // would be looked up several times over. Stays true for as long as a lookup
  // is in flight AND while its confirm panel is open — only a dismiss, a
  // confirmed admission, or an error resets it.
  const busyRef = useRef(false);

  const fetchJson = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.success !== false, data };
  };

  const resetSoon = () => {
    // Long enough that a code still in front of the lens is not re-submitted.
    setTimeout(() => {
      busyRef.current = false;
    }, 2000);
  };

  // Hand one pre-bought item over. Works whether it is shown on the pending
  // (pre-confirm) panel or the outcome (post-confirm) panel, since a customer
  // may collect a drink while staff are still confirming their identity.
  const collect = async (item: OwedItem) => {
    setCollecting(item._id);
    try {
      const { ok, data } = await fetchJson(
        `/api/cinemas/me/concession-sales/${item._id}/redeem`,
        { method: "POST" }
      );
      if (!ok) {
        // The server's message is specific on purpose ("Already collected
        // at 19:42"), which is what settles a dispute at the counter.
        setCollectError(data?.message || "Could not mark that collected.");
        return;
      }
      setCollectError(null);
      setPending((prev) =>
        prev ? { ...prev, owed: prev.owed.filter((o) => o._id !== item._id) } : prev
      );
      setOutcome((prev) =>
        prev ? { ...prev, owed: (prev.owed || []).filter((o) => o._id !== item._id) } : prev
      );
    } catch {
      setCollectError("Could not reach Pazimo.");
    } finally {
      setCollecting(null);
    }
  };

  /** Read-only: look a code up and show what it is, without admitting anyone. */
  const lookup = async (kindHint: "ticket" | "order" | undefined, code: string) => {
    setOutcome(null);
    setCollectError(null);

    try {
      let kind: "ticket" | "order" = kindHint === "order" ? "order" : "ticket";
      let result = await fetchJson(
        kind === "order"
          ? `/api/cinemas/me/orders/${encodeURIComponent(code)}`
          : `/api/cinemas/me/tickets/${encodeURIComponent(code)}`
      );

      if (!result.ok && kindHint === undefined) {
        // A bare typed code — try it as a ticket first, then as an order.
        const asOrder = await fetchJson(`/api/cinemas/me/orders/${encodeURIComponent(code)}`);
        if (asOrder.ok) {
          result = asOrder;
          kind = "order";
        }
      }

      if (!result.ok) {
        setOutcome({
          kind: "error",
          title: "Not found",
          detail: result.data?.message || "That ticket could not be found.",
        });
        resetSoon();
        return;
      }

      const tickets: StaffTicket[] = kind === "order" ? result.data.data : [result.data.data];
      setPending({ kind, code, tickets, owed: result.data.outstandingConcessions || [] });
    } catch {
      setOutcome({
        kind: "error",
        title: "Network problem",
        detail: "Could not reach Pazimo. Check the connection and try again.",
      });
      resetSoon();
    }
  };

  const dismiss = () => {
    setPending(null);
    setCollectError(null);
    busyRef.current = false;
  };

  /** The mutating step — fired only from an explicit "Mark as used" tap. */
  const confirmAdmit = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      const { ok, data } =
        pending.kind === "order"
          ? await fetchJson(`/api/cinemas/me/orders/${encodeURIComponent(pending.code)}/check-in`, {
              method: "POST",
            })
          : await fetchJson(`/api/cinemas/me/check-in/${encodeURIComponent(pending.code)}`, {
              method: "POST",
            });

      if (!ok) {
        setOutcome({
          kind: "error",
          title: "Not admitted",
          detail: data?.message || "That ticket could not be validated.",
        });
      } else if (pending.kind === "order") {
        const admittedCount = data.data?.admittedCount ?? pending.tickets.length;
        const first = pending.tickets[0];
        setOutcome({
          kind: "ok",
          title: "Admitted",
          detail: `${first.movieTitle} · ${admittedCount} seat${admittedCount === 1 ? "" : "s"}${
            first.hallName ? ` · ${first.hallName}` : ""
          }`,
          owed: data.outstandingConcessions || [],
        });
      } else {
        const t = data.data;
        setOutcome({
          kind: "ok",
          title: "Admitted",
          detail: `${t.movieTitle} · ${seatLabel(t)}${t.hallName ? ` · ${t.hallName}` : ""}`,
          owed: data.outstandingConcessions || [],
        });
      }
    } catch {
      setOutcome({
        kind: "error",
        title: "Network problem",
        detail: "Could not reach Pazimo. Check the connection and try again.",
      });
    } finally {
      setConfirming(false);
      setPending(null);
      resetSoon();
    }
  };

  const beginLookup = (raw: string) => {
    if (!raw || busyRef.current || pending) return;

    const { kind, code, wrongKind } = extractCode(raw);
    if (wrongKind) {
      busyRef.current = true;
      setOutcome({
        kind: "error",
        title: "Wrong kind of ticket",
        detail:
          "That is an event ticket, not a cinema ticket. Cinemas can only admit their own screenings.",
      });
      resetSoon();
      return;
    }
    if (!code) return;

    busyRef.current = true;
    lookup(kind, code);
  };

  const handleScan = (result: Parameters<typeof readScan>[0]) => {
    beginLookup(readScan(result));
  };

  // What the pending panel's action area should say — dynamic to whatever is
  // still eligible, so a re-scan of a partially-admitted order reads
  // correctly rather than repeating "Mark as used" for seats already in.
  const eligibleFor = (t: StaffTicket) =>
    !t.checkedIn && t.paymentStatus === "completed" && !["cancelled", "refunded"].includes(t.status);
  const remaining = pending?.tickets.filter(eligibleFor) ?? [];

  return (
    <div className="relative h-full min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-black">
      <div className="absolute inset-0 [&>div]:h-full [&>div]:w-full">
        <Scanner
          onScan={handleScan}
          onError={() =>
            setOutcome({
              kind: "error",
              title: "Camera unavailable",
              detail: "Allow camera access, or type the code below.",
            })
          }
          allowMultiple
          components={{ finder: true, zoom: true }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-white/85 backdrop-blur">
          <ScanLine className="h-3.5 w-3.5" />
          Cinema admission
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-4 pb-6">
        {pending && (
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur">
            <p className="font-semibold">{pending.tickets[0].movieTitle}</p>
            <p className="mt-0.5 text-sm text-white/70">
              {pending.tickets[0].hallName || "—"}
              {pending.kind === "order" && ` · ${pending.tickets.length} seat${pending.tickets.length === 1 ? "" : "s"}`}
            </p>

            <div className="mt-3 space-y-1.5">
              {pending.tickets.map((t) => (
                <div key={t.ticketId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-white/90">
                    <Armchair className="h-3.5 w-3.5 text-white/50" />
                    {seatLabel(t)}
                  </span>
                  {t.checkedIn ? (
                    <span className="text-xs text-emerald-400">Already admitted</span>
                  ) : ["cancelled", "refunded"].includes(t.status) ? (
                    <span className="text-xs text-red-400 capitalize">{t.status}</span>
                  ) : t.paymentStatus !== "completed" ? (
                    <span className="text-xs text-amber-400">Not paid</span>
                  ) : null}
                </div>
              ))}
            </div>

            {(pending.owed?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-950/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
                  <Popcorn className="h-3.5 w-3.5" />
                  Paid for, not collected
                </p>
                <div className="mt-2 space-y-1.5">
                  {pending.owed.map((item) => (
                    <div key={item._id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-white/90">
                        {item.quantity} × {item.beverageName}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => collect(item)}
                        disabled={collecting === item._id}
                        className="h-7 shrink-0 bg-amber-500 px-2 text-xs text-black hover:bg-amber-400"
                      >
                        {collecting === item._id ? "…" : "Handed over"}
                      </Button>
                    </div>
                  ))}
                </div>
                {collectError && <p className="mt-2 text-xs text-red-300">{collectError}</p>}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={dismiss}
                disabled={confirming}
                className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              {remaining.length > 0 ? (
                <Button
                  onClick={confirmAdmit}
                  disabled={confirming}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                >
                  {confirming
                    ? "Admitting…"
                    : remaining.length === pending.tickets.length
                      ? "Mark as used"
                      : `Mark ${remaining.length} remaining as used`}
                </Button>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-white/60">
                  {pending.tickets.every((t) => t.checkedIn)
                    ? "Already admitted"
                    : "Nothing here can be admitted"}
                </div>
              )}
            </div>
          </div>
        )}

        {outcome && (
          <div
            className={`w-full max-w-md rounded-2xl border p-4 text-white shadow-2xl backdrop-blur ${
              outcome.kind === "ok"
                ? "border-emerald-400/30 bg-emerald-950/90"
                : "border-red-400/30 bg-red-950/90"
            }`}
          >
            <div className="flex items-start gap-3">
              {outcome.kind === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{outcome.title}</p>
                <p className="mt-0.5 text-sm text-white/80">{outcome.detail}</p>

                {/* Pre-bought items on the same order. One tap each, because
                    a customer may collect a drink now and popcorn later. */}
                {outcome.kind === "ok" && (outcome.owed?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-950/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
                      <Popcorn className="h-3.5 w-3.5" />
                      Paid for, not collected
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {outcome.owed!.map((item) => (
                        <div key={item._id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm text-white/90">
                            {item.quantity} × {item.beverageName}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => collect(item)}
                            disabled={collecting === item._id}
                            className="h-7 shrink-0 bg-amber-500 px-2 text-xs text-black hover:bg-amber-400"
                          >
                            {collecting === item._id ? "…" : "Handed over"}
                          </Button>
                        </div>
                      ))}
                    </div>
                    {collectError && (
                      <p className="mt-2 text-xs text-red-300">{collectError}</p>
                    )}
                  </div>
                )}

                {outcome.kind === "ok" && outcome.owed && outcome.owed.length === 0 && (
                  <p className="mt-2 text-xs text-white/50">Nothing to collect.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex w-full max-w-md gap-2 rounded-2xl border border-white/15 bg-slate-950/90 p-2 backdrop-blur">
          <Input
            placeholder="Or type the ticket code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual.trim()) {
                beginLookup(manual.trim());
                setManual("");
              }
            }}
            className="border-white/10 bg-transparent text-white placeholder:text-white/40"
          />
          <Button
            onClick={() => {
              beginLookup(manual.trim());
              setManual("");
            }}
            disabled={!manual.trim()}
          >
            Look up
          </Button>
        </div>
      </div>
    </div>
  );
}
