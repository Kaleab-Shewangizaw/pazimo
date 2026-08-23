// Client helpers for the cinema sales channel.
//
// A cinema account never chooses which cinema it is acting as: every
// self-service endpoint lives under /api/cinemas/me/*, and the server resolves
// the cinema from the account. There is deliberately no cinema id in any path
// here, so the UI cannot construct a request aimed at another cinema even by
// accident — the same rule venue-api follows, taken one step further.

import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type CinemaEligibility = "not_eligible" | "eligible";

export interface ScheduleShowtime {
  _id: string;
  movie: { _id: string; title: string; poster?: string | null; durationMinutes?: number; ageRating?: string };
  startsAt: string;
  endsAt?: string | null;
  status: "scheduled" | "cancelled" | "completed";
  isPublished: boolean;
  seatsAllocated: number;
  seatsSold: number;
}

export interface ScheduleHall {
  _id: string;
  name: string;
  capacity: number;
  screenType?: string;
  isActive: boolean;
  /** Already resolved against the cinema default by the server. */
  turnaroundMinutes: number;
  showtimes: ScheduleShowtime[];
}

export interface CinemaSchedule {
  date: string;
  cinema: { _id: string; name: string };
  defaultTurnaroundMinutes: number;
  halls: ScheduleHall[];
  orphanedShowtimes: ScheduleShowtime[];
}

export interface CinemaProfile {
  _id: string;
  name: string;
  description?: string;
  city?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  image?: string | null;
  isActive: boolean;
  beverageEligibility: CinemaEligibility;
  eligibilityNotes?: string | null;
  ticketCommissionRate: number;
  beverageCommissionRate: number;
  coversCinemaVat: boolean;
  turnaroundMinutes: number;
  halls?: CinemaHall[];
}

export interface CinemaHall {
  _id: string;
  cinema: string;
  name: string;
  capacity: number;
  screenType?: string;
  isActive: boolean;
  /** null means "inherit the cinema's default". */
  turnaroundMinutes: number | null;
  hasAssignedSeating: boolean;
  seatCategories?: SeatCategory[];
  seatMap?: { rows: SeatMapRow[] };
}

/** A tier of seat in a room. Its key is what a showtime prices. */
export interface SeatCategory {
  key: string;
  label: string;
  color?: string;
}

export interface SeatMapSeat {
  number: string;
  categoryKey: string;
  /** false is a GAP — an aisle, a pillar — not a deleted seat. */
  exists: boolean;
  /** A chair nobody may buy: a house seat, a sightline block. */
  blocked: boolean;
}

export interface SeatMapRow {
  label: string;
  /** How far the row bows toward the screen. Presentational only. */
  curve: number;
  /** Horizontal nudge, so a short row can sit centred. */
  offset: number;
  seats: SeatMapSeat[];
}

/** One seat as the PUBLIC picker sees it: its own state, not the hall's config. */
export interface PickerSeat {
  number: string;
  seatKey: string;
  categoryKey: string;
  exists: boolean;
  status: "available" | "held" | "sold" | "gap" | "blocked";
}

export interface PickerRow {
  label: string;
  curve: number;
  offset: number;
  seats: PickerSeat[];
}

export interface ShowtimeSeatMap {
  assignedSeating: boolean;
  showtimeId: string;
  currency?: string;
  holdMinutes?: number;
  categories?: (SeatCategory & {
    ticketTypeId?: string;
    name?: string;
    price?: number;
    isAvailable?: boolean;
  })[];
  rows?: PickerRow[];
  /**
   * The hall has a seat map, but this screening's tiers do not price its
   * categories — the state left behind when a seat map is added to a hall that
   * already had screenings booked. Every seat would refuse to be added, so the
   * picker says so instead of rendering a room that cannot be used.
   */
  needsRepricing?: boolean;
}

export interface CinemaBasketTicket {
  seatKey?: string;
  row?: string;
  number?: string;
  categoryKey?: string;
  categoryLabel?: string;
  ticketTypeId: string;
  ticketType: string;
  price: number;
}

export interface CinemaBasketConcession {
  cinemaBeverage: string;
  name: string;
  image?: string | null;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CinemaBasket {
  showtimeId: string;
  cinemaId: string;
  movieTitle?: string;
  startsAt: string;
  assignedSeating: boolean;
  currency: string;
  tickets: CinemaBasketTicket[];
  ticketTotal: number;
  concessions: CinemaBasketConcession[];
  concessionTotal: number;
  total: number;
}

export type MovieStatus = "coming_soon" | "now_showing" | "archived";

export interface CinemaMovie {
  _id: string;
  cinema: string;
  title: string;
  description?: string;
  poster?: string | null;
  coverImage?: string | null;
  durationMinutes?: number;
  genre: string[];
  language?: string;
  subtitles?: string;
  ageRating?: string;
  trailerUrl?: string;
  releaseDate?: string | null;
  status: MovieStatus;
  isActive: boolean;
  showtimeCount?: number;
}

export interface CinemaTicketType {
  _id: string;
  name: string;
  price: number;
  description?: string;
  allocation: number;
  sold: number;
  isAvailable: boolean;
  /**
   * Which seat category on the hall this tier prices.
   *
   * Present only on an assigned-seating hall, where the seat a customer picks
   * decides the price and the allocation comes from the map rather than being
   * typed. Absent means the older shape: a tier with its own seat count.
   */
  seatCategoryKey?: string;
}

export interface CinemaShowtime {
  _id: string;
  cinema: string;
  movie: { _id: string; title: string; poster?: string | null; durationMinutes?: number; ageRating?: string };
  hall: { _id: string; name: string; capacity?: number };
  startsAt: string;
  endsAt?: string | null;
  ticketTypes: CinemaTicketType[];
  currency: string;
  status: "scheduled" | "cancelled" | "completed";
  isPublished: boolean;
  seatsAllocated?: number;
  seatsSold?: number;
}

export interface CinemaTicket {
  _id: string;
  ticketId: string;
  salesContext: "CINEMA";
  movieTitle: string;
  hallName?: string;
  showtimeStartsAt: string;
  ticketType: string;
  price: number;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: "active" | "used" | "cancelled" | "refunded" | "expired";
  paymentStatus: "pending" | "completed" | "failed";
  channel: "online" | "box_office";
  checkedIn: boolean;
  checkedAt?: string | null;
  customerName?: string;
  customerPhone?: string;
  purchaseDate: string;
  movie?: { _id: string; title: string; poster?: string | null };
  hall?: { _id: string; name: string };
  cinema?: { _id: string; name: string; city?: string; image?: string | null };
  /**
   * The chair, on an assigned-seating hall. A SNAPSHOT taken at sale time, so
   * it keeps saying "Row K, seat 7, VIP" after the room is re-tiered.
   */
  seat?: {
    row?: string;
    number?: string;
    seatKey?: string;
    categoryKey?: string;
    categoryLabel?: string;
  } | null;
}

export interface CinemaConcession {
  _id: string;
  cinema: string;
  beverage: {
    _id: string;
    name: string;
    image?: string | null;
    color?: string | null;
    category: "drink" | "snack" | "combo";
    isActive: boolean;
  };
  price: number;
  currency: string;
  stockTotal: number;
  sold: number;
  /** Whether this line is counted at all. */
  unlimitedStock?: boolean;
  /** null on an unlimited line — "we do not count this" has no numeric answer. */
  stockRemaining: number | null;
  isAvailable: boolean;
}

export interface CinemaCatalogItem {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
  category: "drink" | "snack" | "combo";
  inLineup: boolean;
}

export interface CinemaConcessionSale {
  _id: string;
  referenceNumber: string;
  salesContext: "CINEMA";
  beverageName: string;
  beverageColor?: string | null;
  beverageCategory: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: "confirmed" | "refunded";
  channel: "online" | "manual";
  customerName?: string;
  soldAt: string;
  showtime?: { _id: string; startsAt: string } | null;
}

/**
 * What a cinema has actually sold at the counter.
 *
 * `revenue` is the whole concession pool; `byProduct` is the same money split
 * per item, so a cinema can see that popcorn carries the bar rather than only
 * that the bar took X.
 */
export interface CinemaConcessionSummary {
  revenue: {
    grossRevenue: number;
    pazimoCommission: number;
    vatOnCommission: number;
    cinemaVat: number;
    cinemaRevenue: number;
    unitsSold: number;
    salesCount: number;
  };
  byProduct: {
    _id: string;
    name: string;
    category: string;
    unitsSold: number;
    grossRevenue: number;
  }[];
}

/** One pool's figures. Both cinema streams share this shape. */
export interface CinemaPool {
  availableBalance: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  grossRevenue: number;
  cinemaRevenue: number;
  pazimoCommission: number;
  vatOnCommission: number;
  cinemaVat: number;
  pazimoCollected: number;
  seatsSold?: number;
  ticketCount?: number;
  unitsSold?: number;
  salesCount?: number;
}

export interface CinemaBalance {
  currency: string;
  cinema: {
    _id: string;
    name: string;
    ticketCommissionRate: number;
    beverageCommissionRate: number;
    coversCinemaVat: boolean;
  };
  availableBalance: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  streams: { tickets: CinemaPool; beverages: CinemaPool };
  combined: {
    grossRevenue: number;
    cinemaRevenue: number;
    pazimoCommission: number;
    vatOnCommission: number;
    cinemaVat: number;
    pazimoCollected: number;
  };
}

export interface CinemaWithdrawal {
  _id: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "completed";
  stream: "cinema_tickets" | "cinema_beverages";
  feeAmount?: number;
  netAmount?: number;
  notes?: string;
  createdAt: string;
}

/** Throws on any non-success response so callers can use one catch. */
export const cinemaRequest = async <T,>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Something went wrong");
  }
  return data as T;
};

const unwrap = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const fetchMyCinema = (token: string) =>
  unwrap(cinemaRequest<{ data: CinemaProfile }>("/api/cinemas/me", token));

export const fetchHalls = (token: string) =>
  unwrap(cinemaRequest<{ data: CinemaHall[] }>("/api/cinemas/me/halls", token));

export const fetchMovies = (token: string) =>
  unwrap(cinemaRequest<{ data: CinemaMovie[] }>("/api/cinemas/me/movies", token));

export const fetchShowtimes = (token: string, query = "") =>
  unwrap(
    cinemaRequest<{ data: CinemaShowtime[] }>(
      `/api/cinemas/me/showtimes${query}`,
      token
    )
  );

export const fetchTicketSales = (token: string, query = "") =>
  cinemaRequest<{ data: CinemaTicket[]; pagination: { total: number; page: number; pages: number } }>(
    `/api/cinemas/me/ticket-sales${query}`,
    token
  );

export const fetchTicketSummary = (token: string) =>
  unwrap(
    cinemaRequest<{
      data: {
        revenue: CinemaPool & { seatsSold: number; ticketCount: number };
        byMovie: Array<{ _id: string; title: string; seatsSold: number; grossRevenue: number }>;
        upcoming: Array<{
          _id: string;
          movie: { title: string; poster?: string | null };
          hall: { name: string };
          startsAt: string;
          seatsAllocated: number;
          seatsSold: number;
        }>;
      };
    }>("/api/cinemas/me/ticket-sales/summary", token)
  );

export const fetchConcessions = (token: string) =>
  unwrap(
    cinemaRequest<{ data: CinemaConcession[]; eligibility: CinemaEligibility }>(
      "/api/cinemas/me/concessions",
      token
    )
  );

export const fetchConcessionCatalog = (token: string) =>
  unwrap(
    cinemaRequest<{ data: CinemaCatalogItem[] }>(
      "/api/cinemas/me/concessions/catalog",
      token
    )
  );

// Wrapped in unwrap(), like fetchTicketSummary above: cinemaRequest returns the
// WHOLE response body, and this endpoint answers { success, data: { revenue,
// byProduct } }. Calling it without unwrap returned the envelope, so
// `summary.revenue` was undefined and the panel crashed the page reading
// `.grossRevenue` off it.
//
// The type parameter did not catch that, because cinemaRequest ends in
// `return data as T` — a blind cast. Annotating it <CinemaConcessionSummary>
// asserted the envelope WAS the summary and the compiler took it at its word,
// which is why the wrapper shape has to be spelled out here rather than trusted.
export const fetchConcessionSummary = (token: string) =>
  unwrap(
    cinemaRequest<{ data: CinemaConcessionSummary }>(
      "/api/cinemas/me/concession-sales/summary",
      token
    )
  );

export const fetchConcessionSales = (token: string, query = "") =>
  cinemaRequest<{ data: CinemaConcessionSale[]; pagination: { total: number; pages: number } }>(
    `/api/cinemas/me/concession-sales${query}`,
    token
  );

// --- Public booking -------------------------------------------------------
//
// No token: these are the customer-facing calls. They go through plain fetch
// rather than cinemaRequest, which requires one.

const publicGet = async <T,>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { headers: optionalAuthHeader() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || "Something went wrong");
  }
  return body.data as T;
};

/**
 * The signed-in customer's token, when there is one.
 *
 * The public checkout routes run behind `optionalAuth`: they work for a guest,
 * and they attach the account when a token is present. Without this header the
 * server sees every buyer as a guest — so `Payment.userId` is never set, the
 * ticket's `customer` is never set, and the ticket never appears in the account
 * that bought it. That is exactly what was happening.
 *
 * Read from the store rather than passed in by each caller, so no call site can
 * forget it and quietly orphan a ticket. Wrapped because a guest checkout must
 * never break on an auth-store problem.
 */
const optionalAuthHeader = (): Record<string, string> => {
  try {
    const token = useAuthStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const publicPost = async <T,>(path: string, payload: unknown): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...optionalAuthHeader() },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || "Something went wrong");
  }
  return body.data as T;
};

/** The room and what is already taken, for one screening. */
export const fetchShowtimeSeats = (showtimeId: string) =>
  publicGet<ShowtimeSeatMap>(`/api/cinemas/public/showtimes/${showtimeId}/seats`);

/** What this cinema sells at the counter, for the snacks step. */
export const fetchPublicConcessions = (cinemaId: string) =>
  publicGet<CinemaConcession[]>(`/api/cinemas/public/${cinemaId}/concessions`);

/**
 * What a basket would cost. Reserves nothing, so it is safe to call on every
 * change to the selection.
 */
export const quoteCinemaBasket = (payload: {
  showtime: string;
  seats?: string[];
  ticketType?: string;
  quantity?: number;
  concessions?: { cinemaBeverage: string; quantity: number }[];
}) => publicPost<CinemaBasket>("/api/cinemas/public/checkout/quote", payload);

/** Locks the seats and starts a payment. */
export const startCinemaCheckout = (payload: {
  showtime: string;
  seats?: string[];
  ticketType?: string;
  quantity?: number;
  concessions?: { cinemaBeverage: string; quantity: number }[];
  phoneNumber: string;
  customerName?: string;
  customerEmail?: string;
  /**
   * Which method the customer picked — "Telebirr", "CBEBirr", "mpesa", …
   *
   * Required by the server. The PROVIDER is not sent: that is a platform
   * setting the server reads for itself, so a client cannot route a payment
   * through a provider the platform has turned off.
   */
  method: string;
}) =>
  publicPost<{
    transactionId: string;
    checkoutUrl: string | null;
    provider: "santim" | "chapa" | "chapa_giftcard";
    /**
     * What to do next, stated by the server rather than inferred.
     *
     *   "redirect" — send the customer to checkoutUrl (card payments)
     *   "prompt"   — a charge is already on their phone; go to the order page
     *                and poll (mobile money, and every SantimPay payment)
     */
    action: "redirect" | "prompt";
    total: number;
    currency: string;
    expiresAt: string | null;
    seats: string[];
  }>("/api/cinemas/public/checkout", payload);

/**
 * Nudge the server to verify a pending payment with the provider.
 *
 * Settlement normally runs from the provider's webhook. This is the fallback
 * for when that webhook is slow, blocked, or never sent — it verifies against
 * Chapa or SantimPay and settles on success. Shared with the event checkout, so
 * a cinema order is verified by exactly the code that has been settling event
 * tickets in production.
 *
 * Deliberately untyped in its response and safe to ignore: the order read that
 * follows it is what decides what the customer is shown.
 */
export const verifyPaymentStatus = async (transactionId: string) => {
  const res = await fetch(
    `${API_URL}/api/payments/status?txn=${encodeURIComponent(transactionId)}`
  );
  return res.json().catch(() => null);
};

/**
 * Give up on an order and release its seats immediately.
 *
 * Without this the chairs stay locked until the ten-minute hold expires, which
 * on a busy screening means the best seats are unbuyable and nothing explains
 * why. Refused for an order that has already been paid for.
 */
export const cancelCinemaCheckout = (transactionId: string) =>
  publicPost<{ transactionId: string; released: number; status: string }>(
    `/api/cinemas/public/checkout/${transactionId}/cancel`,
    {}
  );

/** Every cinema ticket the signed-in customer holds. */
export const fetchMyCinemaTickets = (token: string) =>
  unwrap(cinemaRequest<{ data: CinemaTicket[] }>("/api/cinemas/my-tickets", token));

/** Everything one paid order produced — tickets and snacks. */
export const fetchCinemaOrder = (transactionId: string) =>
  publicGet<{
    transactionId: string;
    status: string;
    total: number;
    currency: string;
    tickets: {
      _id: string;
      ticketId: string;
      movieTitle: string;
      hallName?: string;
      showtimeStartsAt: string;
      ticketType: string;
      totalAmount: number;
      currency: string;
      seat?: { row?: string; number?: string; categoryLabel?: string };
    }[];
    concessions: CinemaBasketConcession[];
  }>(`/api/cinemas/public/orders/${transactionId}`);

/** One day's schedule, grouped by hall. `date` is YYYY-MM-DD. */
export const fetchSchedule = (token: string, date: string) =>
  unwrap(
    cinemaRequest<{ data: CinemaSchedule }>(
      `/api/cinemas/me/schedule?date=${date}`,
      token
    )
  );

export const fetchCinemaBalance = (token: string) =>
  unwrap(cinemaRequest<{ data: CinemaBalance }>("/api/cinemas/me/finance", token));

export const fetchCinemaWithdrawals = (token: string) =>
  unwrap(
    cinemaRequest<{ data: CinemaWithdrawal[] }>(
      "/api/cinemas/me/finance/withdrawals",
      token
    )
  );

/**
 * Request a payout from ONE pool.
 *
 * Goes to the shared withdrawal endpoint, not a cinema-specific one: there is a
 * single Withdrawal collection and a single admin approval queue for the whole
 * platform. The `stream` is what scopes it to the right pool.
 */
export const requestCinemaWithdrawal = (
  token: string,
  body: {
    amount: number;
    stream: "cinema_tickets" | "cinema_beverages";
    notes?: string;
    bankDetails?: Record<string, string>;
  }
) =>
  cinemaRequest<{ data: CinemaWithdrawal }>("/api/withdrawals", token, {
    method: "POST",
    body: JSON.stringify({ ...body, currency: "ETB" }),
  });

export const money = (n: number, currency = "ETB") =>
  `${(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
