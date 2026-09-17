"use client";

import { useEffect, useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";
import {
  createVenueSale,
  fetchOutstandingVenueOrder,
  fetchVenueBeverages,
  redeemVenueSale,
  type VenueBeverageLineupRow,
  type VenueOutstandingItem,
  type VenueProfile,
} from "@/lib/venue-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Martini, ScanLine, XCircle } from "lucide-react";

/**
 * The venue counter's scan → confirm → hand-over flow, plus recording a
 * walk-up sale (paid cash at the counter, nothing to scan).
 *
 * The cinema twin of this (components/cinema/cinema-scanner.tsx) also
 * juggles seats and a ticket-vs-order distinction; a venue sells only
 * drinks, so this is deliberately simpler — one kind of code, one kind of
 * item, no picker.
 *
 * A venue's pickup code is a plain CODE128 barcode over the bare payment
 * reference (see backend/src/utils/barcodeRenderer.js) — not a JSON QR
 * payload like the cinema's — so whatever the scanner decodes IS the
 * reference to look up, with no parsing step.
 */

type Pending = { reference: string; items: VenueOutstandingItem[] } | null;
type Outcome = { kind: "ok" | "error" | "empty"; title: string; detail: string } | null;

const readScan = (
  result: { rawValue?: string; text?: string }[] | undefined
): string => {
  if (!result || !result.length) return "";
  return result[0]?.rawValue || result[0]?.text || "";
};

export default function VenueScanner({
  venue,
  token,
}: {
  venue: VenueProfile;
  token: string;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [manual, setManual] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  // A ref rather than state: the camera fires many frames per second and
  // state would not have committed before the next one arrived, so the same
  // code would be looked up several times over — same reasoning as the
  // cinema scanner's busyRef.
  const busyRef = useRef(false);

  const resetSoon = () => {
    setTimeout(() => {
      busyRef.current = false;
    }, 2000);
  };

  const lookup = async (reference: string) => {
    setOutcome(null);
    try {
      const items = await fetchOutstandingVenueOrder(venue._id, reference, token);
      if (items.length === 0) {
        setOutcome({
          kind: "empty",
          title: "Nothing outstanding",
          detail: `No unclaimed drinks on "${reference}".`,
        });
        resetSoon();
        return;
      }
      setPending({ reference, items });
    } catch (e) {
      setOutcome({
        kind: "error",
        title: "Not found",
        detail: (e as Error).message || "That order could not be found.",
      });
      resetSoon();
    }
  };

  const beginLookup = (raw: string) => {
    const reference = raw.trim();
    if (!reference || busyRef.current || pending) return;
    busyRef.current = true;
    lookup(reference);
  };

  const handleScan = (result: { rawValue?: string; text?: string }[]) => {
    beginLookup(readScan(result));
  };

  const dismiss = () => {
    setPending(null);
    busyRef.current = false;
  };

  const collect = async (item: VenueOutstandingItem) => {
    setCollectingId(item._id);
    try {
      await redeemVenueSale(venue._id, item._id, token);
      setPending((prev) => {
        if (!prev) return prev;
        const remaining = prev.items.filter((i) => i._id !== item._id);
        if (remaining.length === 0) {
          setOutcome({
            kind: "ok",
            title: "All handed over",
            detail: `Everything on "${prev.reference}" has been collected.`,
          });
          busyRef.current = false;
          return null;
        }
        return { ...prev, items: remaining };
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not mark that handed over.");
    } finally {
      setCollectingId(null);
    }
  };

  // --- Record a walk-up sale (paid cash at the counter, nothing to scan) ---
  const [lineup, setLineup] = useState<VenueBeverageLineupRow[]>([]);
  const [sellForm, setSellForm] = useState({ venueBeverageId: "", quantity: "1" });
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    fetchVenueBeverages(venue._id, token)
      .then(setLineup)
      .catch(() => setLineup([]));
  }, [token, venue._id]);

  const sellable = lineup.filter(
    (l) => !l.unavailableReason && (l.unlimitedStock || l.remaining > 0)
  );

  const sellDrink = async () => {
    if (!sellForm.venueBeverageId) return;
    setSelling(true);
    try {
      await createVenueSale(venue._id, token, {
        venueBeverageId: sellForm.venueBeverageId,
        quantity: Number(sellForm.quantity) || 1,
      });
      toast.success("Sale recorded");
      setSellForm({ venueBeverageId: "", quantity: "1" });
      fetchVenueBeverages(venue._id, token).then(setLineup).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message || "Could not record that sale.");
    } finally {
      setSelling(false);
    }
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
              detail: "Allow camera access, or type the reference below.",
            })
          }
          formats={["qr_code", "code_128"]}
          allowMultiple
          components={{ finder: true, zoom: true }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-white/85 backdrop-blur">
          <ScanLine className="h-3.5 w-3.5" />
          {venue.name} counter
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-4 pb-6">
        {pending && (
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur">
            <p className="font-semibold">Order {pending.reference}</p>
            <div className="mt-3 space-y-1.5">
              {pending.items.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-white/90">
                    <Martini className="h-3.5 w-3.5 flex-shrink-0 text-white/50" />
                    {item.quantity} × {item.beverageName}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => collect(item)}
                    disabled={collectingId === item._id}
                    className="h-7 shrink-0 bg-amber-500 px-2 text-xs text-black hover:bg-amber-400"
                  >
                    {collectingId === item._id ? "…" : "Handed over"}
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={dismiss}
              className="mt-4 w-full border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              Close
            </Button>
          </div>
        )}

        {outcome && !pending && (
          <div
            className={`w-full max-w-md rounded-2xl border p-4 text-white shadow-2xl backdrop-blur ${
              outcome.kind === "ok"
                ? "border-emerald-400/30 bg-emerald-950/90"
                : outcome.kind === "empty"
                  ? "border-amber-400/30 bg-amber-950/90"
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
              </div>
            </div>
          </div>
        )}

        <div className="flex w-full max-w-md gap-2 rounded-2xl border border-white/15 bg-slate-950/90 p-2 backdrop-blur">
          <Input
            placeholder="Or type the order reference"
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

        {/* A walk-up customer pays cash at the counter — there is no order to
            scan, so this records the sale directly rather than through the
            lookup flow above. */}
        <div className="flex w-full max-w-md flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/90 p-3 backdrop-blur">
          <select
            className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-2 text-sm text-white"
            value={sellForm.venueBeverageId}
            onChange={(e) => setSellForm({ ...sellForm, venueBeverageId: e.target.value })}
          >
            <option value="" className="text-black">Sell a drink…</option>
            {sellable.map((l) => (
              <option key={l._id} value={l._id} className="text-black">
                {l.beverage?.name} — {l.price} ({l.unlimitedStock ? "unlimited" : `${l.remaining} left`})
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            value={sellForm.quantity}
            onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
            className="h-9 w-16 border-white/10 bg-transparent text-white"
          />
          <Button
            size="sm"
            onClick={sellDrink}
            disabled={selling || !sellForm.venueBeverageId}
          >
            {selling ? "…" : "Sell"}
          </Button>
        </div>
      </div>
    </div>
  );
}
