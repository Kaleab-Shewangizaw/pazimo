/**
 * Where a signed-in account belongs.
 *
 * ONE definition, because there were three and they had drifted. The two
 * sign-in pages both routed venue, cinema and organizer accounts to their own
 * dashboards, while the header's "My Account" button special-cased organizer
 * alone and sent everyone else to /my-account — so a cinema owner who signed in
 * landed on their cinema dashboard, then clicking their own account button
 * dropped them into the customer area, which has no cinema anything on it.
 *
 * Adding a role is now one line here rather than three edits that have to be
 * remembered together.
 */

export type AccountRole =
  | "customer"
  | "organizer"
  | "venue"
  | "cinema"
  | "admin";

const HOME_BY_ROLE: Record<AccountRole, string> = {
  admin: "/admin",
  organizer: "/organizer",
  venue: "/venue",
  cinema: "/cinema",
  // A customer's account area. Also the fallback for any role this map does not
  // know, which is the safe direction to fail: the customer area assumes no
  // privileges, so an unrecognised role sees a page that works rather than one
  // that errors on data it cannot load.
  customer: "/my-account",
};

/** The bits of a signed-in user these helpers need — a role, and, for a
 * cashier, which single business it's scoped to. Accepts a bare role string
 * too, for the couple of call sites that never had the full user in hand. */
type AccountHomeInput = { role?: string | null; venue?: string | null; cinema?: string | null } | string | null;

/** The dashboard this account should land on. */
export const accountHomeFor = (input?: AccountHomeInput): string => {
  const user = typeof input === "string" ? { role: input } : input;
  const role = user?.role ?? "";

  // "cashier" isn't a channel of its own — it's counter staff scoped to
  // whichever business created it. Either kind lands on that business's own
  // dashboard, same as the owner; ClientLayout on each side (cinema's
  // CASHIER_ALLOWED_PATHS, venue's nav) then narrows what it can actually see
  // once there. A companion mobile app also covers the cinema side, but that
  // does not stand in for the web dashboard — a cashier who signs in on the
  // web still needs somewhere real to land.
  if (role === "cashier") {
    if (user?.cinema) return HOME_BY_ROLE.cinema;
    if (user?.venue) return HOME_BY_ROLE.venue;
    return HOME_BY_ROLE.customer;
  }

  return HOME_BY_ROLE[role as AccountRole] ?? HOME_BY_ROLE.customer;
};

/**
 * True when the account has a dashboard of its own rather than the customer area.
 *
 * Used to decide whether a post-sign-in `?next=` destination should be honoured:
 * a customer following a link to a ticket should land on that ticket, but a
 * cinema owner should reach their dashboard rather than wherever they happened
 * to click first.
 */
export const hasOwnDashboard = (input?: AccountHomeInput): boolean =>
  accountHomeFor(input) !== HOME_BY_ROLE.customer;
