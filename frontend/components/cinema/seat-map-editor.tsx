"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, Ban, Armchair, Minus } from "lucide-react";
import type { SeatCategory, SeatMapRow, SeatMapSeat } from "@/lib/cinema-api";

/**
 * Configure the shape of a room.
 *
 * A grid you then edit, rather than a blank canvas. Rows and seat numbers are
 * what a customer reads off a ticket and what staff call out at the door, so
 * they stay explicit — and everything a real auditorium does that a plain grid
 * cannot is reached by editing seats instead of by moving to a different model:
 *
 *   remove a seat  -> an aisle, a pillar, a wheelchair space
 *   block a seat   -> a house seat or a broken chair: visible, never sellable
 *   category       -> Floor / Standard / VIP, and the category is what a
 *                     showtime prices, so a VIP seat charges the VIP price
 *   curve          -> how far the row bows toward the screen
 *
 * Curve and offset are presentational: they change where a seat is DRAWN, never
 * which seat it is, so restyling a room can never disturb a sold ticket.
 */

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I and O omitted — misread as 1 and 0

const DEFAULT_CATEGORIES: SeatCategory[] = [
  { key: "standard", label: "Standard", color: "#6366f1" },
];

const PALETTE = ["#6366f1", "#f59e0b", "#0ea5e9", "#10b981", "#ec4899", "#8b5cf6"];

type Mode = "toggle" | "block" | "category";

/** A row with no existing seat is a blank space between rows, not a real row. */
const rowHasSeats = (row: SeatMapRow) => row.seats.some((s) => s.exists);

/**
 * Seat numbers, contiguous over only the seats that exist in this row.
 *
 * A gap keeps its stale number rather than losing it — that number is never
 * shown (SeatButton doesn't render one for a gap) and never checked for
 * uniqueness (see CinemaHall's validator), so leaving it alone is harmless and
 * avoids one more field to reconcile. What matters is that every EXISTING
 * seat counts only the existing seats before it: remove seat 6 for an aisle
 * and the next real seat is 6, not 7 — the aisle is not "seat 6 that isn't
 * there", it is nothing at all.
 */
const renumberSeats = (seats: SeatMapSeat[]): SeatMapSeat[] => {
  let n = 0;
  return seats.map((seat) => {
    if (!seat.exists) return seat;
    n += 1;
    const number = String(n);
    return seat.number === number ? seat : { ...seat, number };
  });
};

// Past 24 rows, fall back to AA, AB… rather than refusing to add one; past
// 24*24 that too runs out, so fall back again to a plain "R25".
const labelForIndex = (i: number): string => {
  if (i < LETTERS.length) return LETTERS[i];
  const rest = i - LETTERS.length;
  const first = LETTERS[Math.floor(rest / LETTERS.length)];
  const second = LETTERS[rest % LETTERS.length];
  return first !== undefined ? `${first}${second}` : `R${i + 1}`;
};

/**
 * Row letters, assigned only to rows that still have a seat in them.
 *
 * A row emptied out entirely — every seat removed, to leave a walkway between
 * two blocks of seating — is not a row any more, so it takes no letter of its
 * own and every row after it shifts up to fill the gap: empty out row D and
 * row E becomes the new row D. Always recomputed from scratch rather than
 * patched incrementally, so there is exactly one place that decides what a
 * row is called and it can never drift from "the row's actual seats".
 */
const relabelRows = (rows: SeatMapRow[]): SeatMapRow[] => {
  let letterIndex = 0;
  return rows.map((row) => {
    if (!rowHasSeats(row)) {
      return row.label === "" ? row : { ...row, label: "" };
    }
    const label = labelForIndex(letterIndex);
    letterIndex += 1;
    return row.label === label ? row : { ...row, label };
  });
};

/** The one place both fixes apply, so no mutation can update seats or rows
 * without also keeping numbers and letters honest. */
const normalizeRows = (rows: SeatMapRow[]): SeatMapRow[] =>
  relabelRows(rows.map((row) => ({ ...row, seats: renumberSeats(row.seats) })));

export default function SeatMapEditor({
  initialCategories,
  initialRows,
  onSave,
  saving = false,
}: {
  initialCategories?: SeatCategory[];
  initialRows?: SeatMapRow[];
  onSave: (payload: { seatCategories: SeatCategory[]; seatMap: { rows: SeatMapRow[] } }) => Promise<void> | void;
  saving?: boolean;
}) {
  const [categories, setCategories] = useState<SeatCategory[]>(
    initialCategories?.length ? initialCategories : DEFAULT_CATEGORIES
  );
  const [rows, setRawRows] = useState<SeatMapRow[]>(() => normalizeRows(initialRows ?? []));
  // Every update to the grid goes through this, never setRawRows directly, so
  // a row can never end up with a stale letter or a seat with a stale number.
  const setRows = (updater: SeatMapRow[] | ((current: SeatMapRow[]) => SeatMapRow[])) =>
    setRawRows((current) =>
      normalizeRows(typeof updater === "function" ? updater(current) : updater)
    );
  const [mode, setMode] = useState<Mode>("toggle");
  const [brush, setBrush] = useState<string>(
    initialCategories?.[0]?.key ?? DEFAULT_CATEGORIES[0].key
  );

  // Builder for a fresh grid, which is how most rooms start before editing.
  const [build, setBuild] = useState({ rows: "8", seatsPerRow: "12" });

  const colorFor = useCallback(
    (key: string) => categories.find((c) => c.key === key)?.color || "#94a3b8",
    [categories]
  );

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>();
    let sellable = 0;
    let blocked = 0;
    let gaps = 0;
    for (const row of rows) {
      for (const seat of row.seats) {
        if (!seat.exists) { gaps++; continue; }
        if (seat.blocked) { blocked++; continue; }
        sellable++;
        byCategory.set(seat.categoryKey, (byCategory.get(seat.categoryKey) || 0) + 1);
      }
    }
    return { byCategory, sellable, blocked, gaps };
  }, [rows]);

  const generateGrid = () => {
    const rowCount = Number(build.rows);
    const perRow = Number(build.seatsPerRow);
    if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 60) {
      toast.error("Rows must be a whole number between 1 and 60");
      return;
    }
    if (!Number.isInteger(perRow) || perRow < 1 || perRow > 80) {
      toast.error("Seats per row must be a whole number between 1 and 80");
      return;
    }
    const generated: SeatMapRow[] = Array.from({ length: rowCount }, (_, r) => ({
      label: LETTERS[r] ?? `R${r + 1}`,
      // A gentle default arc, strongest at the front where a real room curves
      // most, so a new map already looks like an auditorium.
      curve: Math.max(0, Math.round((rowCount - r) * (30 / rowCount))),
      offset: 0,
      seats: Array.from({ length: perRow }, (_, sIdx) => ({
        number: String(sIdx + 1),
        categoryKey: categories[0]?.key ?? "standard",
        exists: true,
        blocked: false,
      })),
    }));
    setRows(generated);
  };

  const mutateSeat = (rowIndex: number, seatIndex: number) => {
    setRows((current) =>
      current.map((row, r) => {
        if (r !== rowIndex) return row;
        return {
          ...row,
          seats: row.seats.map((seat, sIdx) => {
            if (sIdx !== seatIndex) return seat;
            if (mode === "toggle") {
              // Removing a seat also clears `blocked`: a gap that is
              // simultaneously "blocked" is a contradiction the map should not
              // be able to hold.
              return { ...seat, exists: !seat.exists, blocked: false };
            }
            if (mode === "block") {
              if (!seat.exists) return seat;
              return { ...seat, blocked: !seat.blocked };
            }
            if (!seat.exists) return seat;
            return { ...seat, categoryKey: brush };
          }),
        };
      })
    );
  };

  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        // Overwritten immediately by setRows' own normalize pass.
        label: "",
        curve: 0,
        offset: 0,
        seats: Array.from({ length: current[0]?.seats.length || 10 }, (_, i) => ({
          number: String(i + 1),
          categoryKey: categories[0]?.key ?? "standard",
          exists: true,
          blocked: false,
        })),
      },
    ]);

  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index));

  // "label" is not settable here — it is derived from which rows still have a
  // seat in them (see relabelRows) rather than freely typed.
  const setRowField = (index: number, field: "curve" | "offset", value: string) =>
    setRows((current) =>
      current.map((row, i) => (i !== index ? row : { ...row, [field]: Number(value) }))
    );

  const addSeatToRow = (index: number, delta: number) =>
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        if (delta > 0) {
          return {
            ...row,
            seats: [
              ...row.seats,
              {
                number: String(row.seats.length + 1),
                categoryKey: categories[0]?.key ?? "standard",
                exists: true,
                blocked: false,
              },
            ],
          };
        }
        return { ...row, seats: row.seats.slice(0, -1) };
      })
    );

  const addCategory = () => {
    const index = categories.length;
    const key = `tier${index + 1}`;
    if (categories.some((c) => c.key === key)) return;
    setCategories([
      ...categories,
      { key, label: `Tier ${index + 1}`, color: PALETTE[index % PALETTE.length] },
    ]);
  };

  const updateCategory = (index: number, field: keyof SeatCategory, value: string) =>
    setCategories((current) =>
      current.map((c, i) => {
        if (i !== index) return c;
        if (field === "key") {
          // The key is referenced by every seat and by the showtime's prices, so
          // renaming it here rewrites the seats too rather than orphaning them.
          const next = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
          const previous = c.key;
          setRows((rs) =>
            rs.map((row) => ({
              ...row,
              seats: row.seats.map((s) =>
                s.categoryKey === previous ? { ...s, categoryKey: next } : s
              ),
            }))
          );
          if (brush === previous) setBrush(next);
          return { ...c, key: next };
        }
        return { ...c, [field]: value };
      })
    );

  const removeCategory = (index: number) => {
    if (categories.length === 1) {
      toast.error("A room needs at least one seat category");
      return;
    }
    const removed = categories[index];
    const fallback = categories.find((_, i) => i !== index)!;
    // Seats in the removed category are reassigned rather than left pointing at
    // something that no longer exists, which the server would reject on save.
    setRows((current) =>
      current.map((row) => ({
        ...row,
        seats: row.seats.map((s) =>
          s.categoryKey === removed.key ? { ...s, categoryKey: fallback.key } : s
        ),
      }))
    );
    setCategories(categories.filter((_, i) => i !== index));
    if (brush === removed.key) setBrush(fallback.key);
  };

  const handleSave = async () => {
    if (!rows.length) {
      toast.error("Add at least one row before saving");
      return;
    }
    if (counts.sellable === 0) {
      toast.error("This map has no sellable seats");
      return;
    }
    // A row with no seats is a blank space and carries no label — see
    // relabelRows — so only rows that actually seat someone need to be
    // checked here. This should never actually fire (relabelRows guarantees
    // it), but it is cheap insurance against the very-large-hall fallback.
    const labels = rows.filter(rowHasSeats).map((r) => r.label.trim());
    if (labels.some((l) => !l)) {
      toast.error("Every row with seats needs a label");
      return;
    }
    if (new Set(labels).size !== labels.length) {
      toast.error("Two rows share a label — each must be unique");
      return;
    }
    await onSave({ seatCategories: categories, seatMap: { rows } });
  };

  return (
    <div className="space-y-6">
      {/* --- categories ---------------------------------------------------- */}
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Seat categories
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A showtime sets a price per category, so picking a VIP seat charges the VIP price.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addCategory}>
              <Plus className="mr-1 h-3 w-3" /> Category
            </Button>
          </div>

          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={category.color || "#6366f1"}
                  onChange={(e) => updateCategory(index, "color", e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-700"
                  aria-label={`Colour for ${category.label}`}
                />
                <Input
                  className="h-8 w-36"
                  value={category.label}
                  placeholder="VIP"
                  onChange={(e) => updateCategory(index, "label", e.target.value)}
                />
                <Input
                  className="h-8 w-32 font-mono text-xs"
                  value={category.key}
                  placeholder="vip"
                  onChange={(e) => updateCategory(index, "key", e.target.value)}
                  title="The stable id a showtime's prices reference. Renaming it here updates every seat."
                />
                <Badge variant="secondary" className="text-[10px]">
                  {counts.byCategory.get(category.key) || 0} seats
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeCategory(index)}
                  className="h-8 px-2 text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* --- grid builder -------------------------------------------------- */}
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label className="text-xs">Rows</Label>
            <Input
              className="h-8 w-20"
              value={build.rows}
              onChange={(e) => setBuild({ ...build, rows: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Seats per row</Label>
            <Input
              className="h-8 w-24"
              value={build.seatsPerRow}
              onChange={(e) => setBuild({ ...build, seatsPerRow: e.target.value })}
            />
          </div>
          <Button size="sm" variant="outline" onClick={generateGrid}>
            <RotateCcw className="mr-1 h-3 w-3" />
            {rows.length ? "Rebuild grid" : "Build grid"}
          </Button>
          {rows.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Rebuilding replaces every row and loses your edits.
            </p>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          {/* --- tools ----------------------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Clicking a seat:
            </span>
            {(
              [
                ["toggle", "Add / remove", Armchair],
                ["block", "Block", Ban],
                ["category", "Set category", Plus],
              ] as [Mode, string, typeof Armchair][]
            ).map(([value, label, Icon]) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "default" : "outline"}
                onClick={() => setMode(value)}
                className="h-8"
              >
                <Icon className="mr-1 h-3 w-3" />
                {label}
              </Button>
            ))}

            {mode === "category" && (
              <select
                value={brush}
                onChange={(e) => setBrush(e.target.value)}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}

            <div className="ml-auto flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {counts.sellable} sellable
              </span>
              <span>{counts.blocked} blocked</span>
              <span>{counts.gaps} gaps</span>
            </div>
          </div>

          {/* --- the room -------------------------------------------------- */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 dark:border-gray-800 dark:from-gray-950 dark:to-gray-900">
            <div className="mx-auto mb-6 w-2/3 min-w-[240px]">
              <div className="h-2 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
              <p className="mt-1 text-center text-[10px] uppercase tracking-[0.3em] text-gray-400">
                Screen
              </p>
            </div>

            <div className="space-y-2">
              {rows.map((row, rowIndex) => {
                const hasSeats = rowHasSeats(row);
                return (
                <div key={rowIndex} className={`flex items-center gap-2 ${hasSeats ? "" : "opacity-60"}`}>
                  {hasSeats ? (
                    <span
                      className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 text-center text-xs font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100"
                      title="Assigned automatically — rows with no seats take no letter"
                    >
                      {row.label}
                    </span>
                  ) : (
                    <span
                      className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-center text-[9px] uppercase tracking-wide text-gray-400 dark:border-gray-700"
                      title="No seats — a blank space, not a row. Add a seat to turn it back into one."
                    >
                      space
                    </span>
                  )}

                  <div
                    className="flex flex-1 items-center justify-center gap-1"
                    // The curve, drawn. Each row is nudged down by its own curve
                    // value so the block of rows bows toward the screen the way a
                    // real auditorium does.
                    style={{ transform: `translateY(${row.curve * 0.35}px) translateX(${row.offset * 0.5}px)` }}
                  >
                    {row.seats.map((seat, seatIndex) => (
                      <SeatButton
                        key={seatIndex}
                        seat={seat}
                        color={colorFor(seat.categoryKey)}
                        onClick={() => mutateSeat(rowIndex, seatIndex)}
                      />
                    ))}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => addSeatToRow(rowIndex, -1)} title="One fewer seat">
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => addSeatToRow(rowIndex, 1)} title="One more seat">
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Input
                      className="h-7 w-14 text-center text-xs"
                      value={String(row.curve)}
                      onChange={(e) => setRowField(rowIndex, "curve", e.target.value)}
                      title="Curve: how far this row bows toward the screen"
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600"
                      onClick={() => removeRow(rowIndex)} title="Remove this row">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>

            <p className="mt-3 text-center text-[11px] text-gray-400 dark:text-gray-500">
              Remove every seat in a row to turn it into a blank space instead of a row —
              the rows below it relabel automatically.
            </p>

            <div className="mt-3 flex justify-center">
              <Button size="sm" variant="outline" onClick={addRow}>
                <Plus className="mr-1 h-3 w-3" /> Add a row
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save seat map"}
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Capacity becomes {counts.sellable} — the sellable seats on this map.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SeatButton({
  seat,
  color,
  onClick,
}: {
  seat: SeatMapSeat;
  color: string;
  onClick: () => void;
}) {
  if (!seat.exists) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Empty space — click to put a seat back"
        className="h-6 w-6 rounded border border-dashed border-gray-300 opacity-50 transition hover:opacity-100 dark:border-gray-700"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={seat.blocked ? `${seat.number} — blocked` : `Seat ${seat.number}`}
      className={`h-6 w-6 rounded-t-md text-[9px] font-semibold text-white transition hover:scale-110 ${
        seat.blocked ? "opacity-40 line-through" : ""
      }`}
      style={{ backgroundColor: seat.blocked ? "#64748b" : color }}
    >
      {seat.number}
    </button>
  );
}
