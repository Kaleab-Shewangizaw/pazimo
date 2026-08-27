import type { CinemaConcessionSale, CinemaTicket } from "@/lib/cinema-api";

export interface OrderConcessionLine {
  name: string;
  quantity: number;
}

/**
 * One buyer's order for a screening — tickets and any snacks bought
 * alongside them, combined.
 *
 * A `CinemaTicket` row is one SEAT on an assigned-seating hall — a customer
 * who picked 3 chairs produced 3 separate rows sharing one
 * `paymentReference` (their checkout's transaction id, or the box office's
 * own per-sale reference). A `CinemaConcessionSale` bought in the same
 * checkout carries that identical reference. Grouping both by it is what
 * turns "3 ticket rows + 2 concession rows" back into the one purchase a
 * reader actually wants to see: one buyer, one order, however many tickets,
 * tiers and snacks it held. A row with no reference at all (very old data,
 * a counter sale with nothing typed) stands alone rather than merging with
 * anything else.
 *
 * Shared between the cinema's own Tickets page and the admin's — both read
 * the same shape of data and must group it identically, or the two screens
 * could disagree about what one buyer bought.
 */
export interface BuyerOrder {
  key: string;
  buyerName: string;
  buyerPhone?: string;
  channel: "online" | "box_office";
  purchaseDate: string;
  totalQuantity: number;
  /** Tickets + concessions, what the buyer paid altogether for this order. */
  totalAmount: number;
  currency: string;
  typeBreakdown: { type: string; quantity: number }[];
  checkedInCount: number;
  // The group's overall state for the badge: refunded/cancelled wins (money
  // actually came back or never counted), otherwise whether every ticket in
  // the order has been admitted yet. "none" is a concessions-only order —
  // there is no admission to report on.
  status: "refunded" | "cancelled" | "admitted" | "partially_admitted" | "active" | "none";
  concessions: OrderConcessionLine[];
  concessionAmount: number;
  /** An online snack still waiting to be handed over at the counter. */
  concessionsOutstanding: boolean;
}

/**
 * The grouping key for one raw row — exported so a caller that wants the
 * individual tickets/concessions BEHIND one `BuyerOrder` (the admin's detail
 * view) can filter the same source arrays by the same key rather than
 * re-deriving it and risking the two falling out of step.
 */
export const keyOf = (paymentReference: string | undefined, id: string | undefined, i: number) =>
  paymentReference || `single:${id || i}`;

/**
 * Every buyer who got something for this screening — a ticket, a snack, or
 * both — one row each. `concessions` defaults to empty so a caller that has
 * not fetched them yet (or a hall that sells no snacks) still gets a valid
 * ticket-only report.
 */
export const groupIntoOrders = (
  tickets: CinemaTicket[],
  concessions: CinemaConcessionSale[] = []
): BuyerOrder[] => {
  const ticketGroups = new Map<string, CinemaTicket[]>();
  tickets.forEach((t, i) => {
    const key = keyOf(t.paymentReference, t._id, i);
    const list = ticketGroups.get(key);
    if (list) list.push(t);
    else ticketGroups.set(key, [t]);
  });

  const concessionGroups = new Map<string, CinemaConcessionSale[]>();
  concessions.forEach((c, i) => {
    const key = keyOf(c.paymentReference, c._id, i);
    const list = concessionGroups.get(key);
    if (list) list.push(c);
    else concessionGroups.set(key, [c]);
  });

  const concessionLines = (group: CinemaConcessionSale[]) => {
    const byProduct = new Map<string, number>();
    for (const c of group) {
      byProduct.set(c.beverageName, (byProduct.get(c.beverageName) || 0) + (c.quantity || 0));
    }
    return Array.from(byProduct.entries()).map(([name, quantity]) => ({ name, quantity }));
  };

  const allKeys = new Set([...ticketGroups.keys(), ...concessionGroups.keys()]);

  return Array.from(allKeys).map((key) => {
    const ticketGroup = ticketGroups.get(key) || [];
    const concessionGroup = concessionGroups.get(key) || [];
    // At least one of the two is non-empty, since `key` came from one of them.
    const first = ticketGroup[0];
    const firstConcession = concessionGroup[0];

    const totalQuantity = ticketGroup.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const ticketAmount = ticketGroup.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const concessionAmount = concessionGroup.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const checkedInCount = ticketGroup.reduce(
      (sum, t) => sum + (t.checkedIn ? t.quantity || 0 : 0),
      0
    );
    const concessionsOutstanding = concessionGroup.some(
      (c) => c.channel === "online" && c.status === "confirmed" && !c.redeemedAt
    );

    const byType = new Map<string, number>();
    for (const t of ticketGroup) {
      byType.set(t.ticketType, (byType.get(t.ticketType) || 0) + (t.quantity || 0));
    }

    let status: BuyerOrder["status"] = "none";
    if (ticketGroup.length > 0) {
      const anyRefunded = ticketGroup.some((t) => t.status === "refunded");
      const anyCancelled = ticketGroup.some((t) => t.status === "cancelled");
      status = anyRefunded
        ? "refunded"
        : anyCancelled
          ? "cancelled"
          : checkedInCount === 0
            ? "active"
            : checkedInCount >= totalQuantity
              ? "admitted"
              : "partially_admitted";
    }

    return {
      key,
      buyerName: (first?.customerName || firstConcession?.customerName)?.trim() || "Guest",
      buyerPhone: first?.customerPhone || firstConcession?.customerPhone,
      channel: first
        ? first.channel
        : firstConcession?.channel === "online"
          ? "online"
          : "box_office",
      purchaseDate: first?.purchaseDate || firstConcession?.soldAt || new Date().toISOString(),
      totalQuantity,
      totalAmount: ticketAmount + concessionAmount,
      currency: first?.currency || firstConcession?.currency || "ETB",
      typeBreakdown: Array.from(byType.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      })),
      checkedInCount,
      status,
      concessions: concessionLines(concessionGroup),
      concessionAmount,
      concessionsOutstanding,
    };
  });
};

export const ORDER_STATUS_BADGE: Record<
  BuyerOrder["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Not yet admitted", variant: "default" },
  partially_admitted: { label: "Partially admitted", variant: "outline" },
  admitted: { label: "Admitted", variant: "outline" },
  refunded: { label: "Refunded", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  none: { label: "Snacks only", variant: "secondary" },
};
