import type { CinemaTicket } from "@/lib/cinema-api";

/**
 * One buyer's order for a screening.
 *
 * A `CinemaTicket` row is one SEAT on an assigned-seating hall — a customer
 * who picked 3 chairs produced 3 separate rows sharing one
 * `paymentReference` (their checkout's transaction id, or the box office's
 * own per-sale reference). Grouping by that reference is what turns "3
 * rows" back into the one purchase a reader actually wants to see: one
 * buyer, one order, however many tickets and tiers it held. A row with no
 * reference at all (very old data, if any) stands alone rather than
 * merging with anything else.
 *
 * Shared between the cinema's own Tickets page and the admin's — both read
 * the same shape of data and must group it identically, or the two screens
 * could disagree about how many tickets one buyer bought.
 */
export interface BuyerOrder {
  key: string;
  buyerName: string;
  buyerPhone?: string;
  channel: "online" | "box_office";
  purchaseDate: string;
  totalQuantity: number;
  totalAmount: number;
  currency: string;
  typeBreakdown: { type: string; quantity: number }[];
  checkedInCount: number;
  // The group's overall state for the badge: refunded/cancelled wins (money
  // actually came back or never counted), otherwise whether every ticket in
  // the order has been admitted yet.
  status: "refunded" | "cancelled" | "admitted" | "partially_admitted" | "active";
}

export const groupIntoOrders = (tickets: CinemaTicket[]): BuyerOrder[] => {
  const groups = new Map<string, CinemaTicket[]>();
  tickets.forEach((t, i) => {
    const key = t.paymentReference || `single:${t._id || i}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0];
    const totalQuantity = group.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = group.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const checkedInCount = group.reduce(
      (sum, t) => sum + (t.checkedIn ? t.quantity || 0 : 0),
      0
    );

    const byType = new Map<string, number>();
    for (const t of group) {
      byType.set(t.ticketType, (byType.get(t.ticketType) || 0) + (t.quantity || 0));
    }

    const anyRefunded = group.some((t) => t.status === "refunded");
    const anyCancelled = group.some((t) => t.status === "cancelled");
    const status: BuyerOrder["status"] = anyRefunded
      ? "refunded"
      : anyCancelled
        ? "cancelled"
        : checkedInCount === 0
          ? "active"
          : checkedInCount >= totalQuantity
            ? "admitted"
            : "partially_admitted";

    return {
      key,
      buyerName: first.customerName?.trim() || "Guest",
      buyerPhone: first.customerPhone,
      channel: first.channel,
      purchaseDate: first.purchaseDate,
      totalQuantity,
      totalAmount,
      currency: first.currency,
      typeBreakdown: Array.from(byType.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      })),
      checkedInCount,
      status,
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
};
