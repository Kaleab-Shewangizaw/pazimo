"use client";

import { useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import type { StaffPickerSeat, StaffSeatMap as StaffSeatMapData } from "@/lib/cinema-api";

const SEAT = 22;
const GAP = 5;
const LABEL = 20;

const LEGEND: { status: StaffPickerSeat["status"]; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "held", label: "Held (mid-checkout)" },
  { status: "sold", label: "Sold" },
  { status: "admitted", label: "Admitted" },
  { status: "blocked", label: "Blocked" },
];

/** One seat, colored by status. Kept in the light card theme the dashboard
 * uses everywhere else — a dense audit view reads better as a clean grid than
 * as the dark, immersive booking-flow theatre. */
function StaffSeatGlyph({
  seat,
  categoryColor,
  onClick,
}: {
  seat: StaffPickerSeat;
  categoryColor?: string;
  onClick?: () => void;
}) {
  if (seat.status === "gap") {
    return <span style={{ width: SEAT, height: SEAT }} aria-hidden />;
  }

  const color = categoryColor || "#6366F1";
  const clickable = seat.status === "sold" || seat.status === "admitted";

  let style: CSSProperties = { width: SEAT, height: SEAT };
  let className =
    "flex shrink-0 items-center justify-center rounded-[6px] border-2 text-[9px] font-semibold transition-transform";

  if (seat.status === "blocked") {
    className +=
      " border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600";
  } else if (seat.status === "held") {
    className +=
      " border-dashed border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
  } else if (seat.status === "admitted") {
    style = { ...style, backgroundColor: color, borderColor: color };
    className += " text-white shadow-sm";
  } else if (seat.status === "sold") {
    style = { ...style, backgroundColor: `${color}55`, borderColor: color };
    className += " text-gray-700 dark:text-gray-200";
  } else {
    // available
    style = { ...style, borderColor: `${color}80` };
    className += " bg-white text-gray-400 dark:bg-gray-950 dark:text-gray-600";
  }

  if (clickable) className += " cursor-pointer hover:scale-110";

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      title={`${seat.seatKey}${seat.customerName ? ` · ${seat.customerName}` : ""}`}
      style={style}
      className={className}
    >
      {seat.status === "admitted" ? <Check className="h-3 w-3" /> : null}
    </button>
  );
}

function SeatDetail({ seat }: { seat: StaffPickerSeat }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-900/50">
      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
        Seat {seat.seatKey}
      </span>
      {seat.ticketId && (
        <span className="text-gray-500 dark:text-gray-400">
          Ticket <span className="font-mono text-gray-700 dark:text-gray-300">{seat.ticketId}</span>
        </span>
      )}
      {seat.customerName && (
        <span className="text-gray-500 dark:text-gray-400">{seat.customerName}</span>
      )}
      <span className="text-gray-500 dark:text-gray-400">
        {seat.admittedAt
          ? `Admitted ${new Date(seat.admittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Not yet admitted"}
      </span>
    </div>
  );
}

function TierBar({
  tier,
}: {
  tier: { ticketTypeId: string; name: string; allocation: number; sold: number; admitted: number };
}) {
  const available = Math.max(tier.allocation - tier.sold, 0);
  const notYetAdmitted = Math.max(tier.sold - tier.admitted, 0);
  const total = Math.max(tier.allocation, tier.sold, 1);
  const pct = (n: number) => `${Math.min((n / total) * 100, 100)}%`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950/50">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tier.name}</span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {tier.admitted} admitted · {notYetAdmitted} not yet in · {available} open of {tier.allocation}
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full bg-emerald-500" style={{ width: pct(tier.admitted) }} />
        <div className="h-full bg-indigo-400" style={{ width: pct(notYetAdmitted) }} />
      </div>
    </div>
  );
}

/**
 * The Seats tab: a read-only, staff-facing view of one screening's seats —
 * who's bought what and who has actually walked in. A general-admission hall
 * has no seat-by-seat identity, so it renders per-tier occupancy bars
 * instead of a grid.
 */
export default function StaffSeatMap({ data }: { data: StaffSeatMapData }) {
  const [selected, setSelected] = useState<StaffPickerSeat | null>(null);

  if (!data.assignedSeating) {
    if (!data.tiers?.length) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No ticket types priced for this screening yet.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {data.tiers.map((tier) => (
          <TierBar key={tier.ticketTypeId} tier={tier} />
        ))}
      </div>
    );
  }

  if (data.needsRepricing) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        This hall&apos;s seat categories aren&apos;t priced for this screening yet, so seats can&apos;t
        be shown.
      </p>
    );
  }

  const categoryColor = new Map((data.categories || []).map((c) => [c.key, c.color]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5">
            <StaffSeatGlyph seat={{ ...emptySeat, status: l.status }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
        <div className="flex min-w-max flex-col items-center gap-[5px]">
          {(data.rows || []).map((row, rowIndex) => {
            const count = row.seats.length;
            const center = (count - 1) / 2;
            return (
              <div key={rowIndex} className="flex items-center" style={{ gap: GAP, marginLeft: row.offset * 0.5 }}>
                <span
                  className="shrink-0 text-center text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-600"
                  style={{ width: LABEL }}
                >
                  {row.label}
                </span>
                <div className="flex items-center" style={{ gap: GAP }}>
                  {row.seats.map((seat, i) => {
                    const effectiveCurve = Math.min(row.curve, 8);
                    const t = center === 0 ? 0 : (i - center) / center;
                    const translateY = -effectiveCurve * 0.45 * (1 - t * t);
                    return (
                      <span key={i} style={{ transform: `translateY(${translateY}px)` }}>
                        <StaffSeatGlyph
                          seat={seat}
                          categoryColor={categoryColor.get(seat.categoryKey)}
                          onClick={() => setSelected(seat)}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && <SeatDetail seat={selected} />}
    </div>
  );
}

const emptySeat: StaffPickerSeat = {
  number: "",
  seatKey: "",
  categoryKey: "",
  exists: true,
  status: "available",
};
