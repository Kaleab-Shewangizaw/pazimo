"use client";

import { useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ScanLine, Popcorn } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** A pre-bought item this order has not collected yet. */
type OwedItem = {
  _id: string;
  beverageName: string;
  beverageCategory?: string;
  quantity: number;
  totalAmount: number;
};

type Outcome = {
  kind: "ok" | "error";
  title: string;
  detail: string;
  // Anything the customer paid for online and has not picked up. Shown at the
  // door because that is the one moment staff have the order in front of them —
  // sending them to look it up at the counter is how pre-bought popcorn quietly
  // never gets collected.
  owed?: OwedItem[];
} | null;

/**
 * Pulls the ticket code out of whatever the scanner hands back.
 *
 * A cinema QR carries the JSON payload built by cinemaTicketController
 * (`{ctx:"CINEMA", tid, cin, sh, ...}`), but operators also type codes by hand
 * and some readers return the raw string — so a bare code is accepted too.
 *
 * An EVENT ticket is rejected here, before any request goes out. Its payload has
 * no `ctx`, and admitting one at a cinema would be meaningless: the check-in
 * endpoint only ever reads the CinemaTicket collection, so it would come back as
 * "not found" and look like a broken ticket rather than the wrong kind.
 */
const extractCode = (raw: string): { code?: string; wrongKind?: boolean } => {
  const text = raw.trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      if (parsed.ctx === "CINEMA" && parsed.tid) return { code: String(parsed.tid) };
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

export default function CinemaScanner() {
  const { token } = useAuthStore();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [manual, setManual] = useState("");
  const [collecting, setCollecting] = useState<string | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);
  // A ref rather than state: the camera fires many frames per second and state
  // would not have committed before the next one arrived, so the same ticket
  // would be submitted several times.
  const busyRef = useRef(false);

  // Hand one pre-bought item over. Removed from the list on success so the
  // panel always shows what is still owed rather than what was ordered.
  const collect = async (item: OwedItem) => {
    setCollecting(item._id);
    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/me/concession-sales/${item._id}/redeem`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        // The server's message is specific on purpose ("Already collected
        // at 19:42"), which is what settles a dispute at the counter.
        setCollectError(data?.message || "Could not mark that collected.");
        return;
      }
      setCollectError(null);
      setOutcome((prev) =>
        prev ? { ...prev, owed: (prev.owed || []).filter((o) => o._id !== item._id) } : prev
      );
    } catch {
      setCollectError("Could not reach Pazimo.");
    } finally {
      setCollecting(null);
    }
  };

  const admit = async (code: string) => {
    if (!code || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch(
        `${API_URL}/api/cinemas/me/check-in/${encodeURIComponent(code)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        setOutcome({
          kind: "error",
          title: "Not admitted",
          detail: data?.message || "That ticket could not be validated.",
        });
      } else {
        const t = data.data;
        setOutcome({
          kind: "ok",
          title: "Admitted",
          detail: `${t.movieTitle} · ${t.ticketType}${
            t.seat?.row ? ` · Row ${t.seat.row} seat ${t.seat.number}` : ` × ${t.quantity}`
          }${t.hallName ? ` · ${t.hallName}` : ""}`,
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
      // Long enough that a ticket still in front of the lens is not re-submitted.
      setTimeout(() => {
        busyRef.current = false;
      }, 2000);
    }
  };

  const handleScan = (result: Parameters<typeof readScan>[0]) => {
    const raw = readScan(result);
    if (!raw || busyRef.current) return;

    const { code, wrongKind } = extractCode(raw);
    if (wrongKind) {
      busyRef.current = true;
      setOutcome({
        kind: "error",
        title: "Wrong kind of ticket",
        detail:
          "That is an event ticket, not a cinema ticket. Cinemas can only admit their own screenings.",
      });
      setTimeout(() => {
        busyRef.current = false;
      }, 2000);
      return;
    }
    if (code) admit(code);
  };

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
                admit(manual.trim());
                setManual("");
              }
            }}
            className="border-white/10 bg-transparent text-white placeholder:text-white/40"
          />
          <Button
            onClick={() => {
              admit(manual.trim());
              setManual("");
            }}
            disabled={!manual.trim()}
          >
            Admit
          </Button>
        </div>
      </div>
    </div>
  );
}
