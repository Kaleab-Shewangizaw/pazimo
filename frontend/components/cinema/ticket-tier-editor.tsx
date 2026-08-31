"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CinemaHall } from "@/lib/cinema-api";

export interface Tier {
  name: string;
  price: string;
  allocation: string;
  /**
   * Set only on a hall with a seat map. Its presence is what switches this
   * tier from "a count I typed" to "the price of a category", which is also
   * how the submit handler decides what to send.
   */
  seatCategoryKey?: string;
}

export const EMPTY_TIER: Tier = { name: "Regular", price: "", allocation: "" };

/** Tiers matching a seat-mapped hall's categories, one per category, unpriced. */
export const tiersForHall = (hall: CinemaHall | undefined): Tier[] => {
  if (!hall?.hasAssignedSeating || !hall.seatCategories?.length) return [EMPTY_TIER];
  return hall.seatCategories.map((category) => ({
    name: category.label,
    price: "",
    allocation: "",
    seatCategoryKey: category.key,
  }));
};

/**
 * Ticket-tier rows for a screening: capacity-sold halls get free-form
 * name/price/seat-count tiers, seat-mapped halls get exactly one price row
 * per seat category (allocation comes from the map, so it isn't editable
 * here). The caller owns resetting `tiers` when the target hall changes —
 * this component only renders and edits whatever tier list it's given.
 */
export default function TicketTierEditor({
  hall,
  tiers,
  setTiers,
}: {
  hall: CinemaHall | undefined;
  tiers: Tier[];
  setTiers: (tiers: Tier[]) => void;
}) {
  const assignedSeating = !!hall?.hasAssignedSeating;

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        Ticket types — prices are set per screening, so a matinee can differ
        from a premiere
      </Label>
      {assignedSeating && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
          {hall?.name} has a seat map, so you set one price per seat category.
          How many of each there are comes from the map.
        </p>
      )}
      {tiers.map((tier, i) => (
        <div
          key={i}
          className={`grid gap-2 ${
            assignedSeating ? "sm:grid-cols-[1fr_1fr]" : "sm:grid-cols-[1fr_1fr_1fr_auto]"
          }`}
        >
          <Input
            placeholder="Name (Regular, VIP, Student…)"
            value={tier.name}
            // Locked on an assigned-seating hall: the name comes from the
            // seat category it prices, and letting them drift would put one
            // label on the map and another on the ticket.
            readOnly={assignedSeating}
            onChange={(e) => {
              const next = [...tiers];
              next[i] = { ...tier, name: e.target.value };
              setTiers(next);
            }}
          />
          <Input
            type="number"
            placeholder="Price (ETB)"
            value={tier.price}
            onChange={(e) => {
              const next = [...tiers];
              next[i] = { ...tier, price: e.target.value };
              setTiers(next);
            }}
          />
          {!assignedSeating && (
            <>
              <Input
                type="number"
                placeholder="Seats"
                value={tier.allocation}
                onChange={(e) => {
                  const next = [...tiers];
                  next[i] = { ...tier, allocation: e.target.value };
                  setTiers(next);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={tiers.length === 1}
                onClick={() => setTiers(tiers.filter((_, x) => x !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ))}
      {!assignedSeating && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTiers([...tiers, { name: "", price: "", allocation: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
        </Button>
      )}
    </div>
  );
}
