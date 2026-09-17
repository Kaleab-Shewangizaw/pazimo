// Client helpers for the venue sales channel.
//
// Every venue endpoint is scoped by a venue id in the path, but a venue account
// never chooses that id: the server resolves the venue from the account and
// rejects a mismatch. `useVenueProfile` fetches the one venue the signed-in
// account owns, and everything else is built from its _id — so the UI cannot
// construct a request aimed at someone else's venue even by accident.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type VenueEligibility = "not_eligible" | "eligible";

export interface VenueProfile {
  _id: string;
  name: string;
  venueType: string;
  city?: string;
  address?: string;
  phoneNumber?: string;
  image?: string | null;
  isActive: boolean;
  eligibility: VenueEligibility;
  eligibilityNotes?: string | null;
  beverageCommissionRate: number;
  coversVenueVat: boolean;
}

export interface VenueSale {
  _id: string;
  referenceNumber: string;
  salesContext: "VENUE";
  beverageName: string;
  beverageColor?: string | null;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: "confirmed" | "refunded";
  channel: "online" | "manual";
  customerName?: string;
  customerPhone?: string;
  soldAt: string;
  venue?: { _id: string; name: string; venueType?: string; city?: string };
}

// One drink a customer paid for online (the mobile app's "refill" checkout)
// and hasn't collected yet, for one order — looked up by the order/
// transaction reference the customer shows at the counter.
export interface VenueOutstandingItem {
  _id: string;
  referenceNumber?: string;
  beverageName: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
  soldAt?: string;
}

export interface VenueFinance {
  currency: string;
  venue: {
    _id: string;
    name: string;
    venueType: string;
    commissionRate: number;
    commissionPercent: number;
    coversVenueVat: boolean;
    totalCutPercent: number;
  };
  totals: {
    grossRevenue: number;
    venueNet: number;
    pazimoCommission: number;
    vatOnCommission: number;
    venueVat: number;
    pazimoCollected: number;
    unitsSold: number;
    salesCount: number;
  };
  withdrawals: { pending: number; approved: number };
  availableBalance: number;
  beverages: Array<{
    beverageId: string;
    name: string;
    color?: string | null;
    salesCount: number;
    unitsSold: number;
    grossRevenue: number;
    venueNet: number;
    venueVat: number;
    pazimoCollected: number;
  }>;
}

/** Throws on any non-success response so callers can use one catch. */
export const venueRequest = async <T,>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Something went wrong");
  }
  return data as T;
};

export const fetchMyVenue = (token: string) =>
  venueRequest<{ data: VenueProfile }>("/api/venues/me", token).then((r) => r.data);

// A venue's own counter staff. Created and managed by the owning venue or an
// admin — never by a cashier itself, which is why there's no delete/create
// helper gated any differently than list/update here: the backend enforces
// that split (see backend/src/routes/venueRoutes.js), the frontend just
// calls the one set of endpoints.
export interface VenueCashier {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
}

export interface VenueCashierInput {
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export const listVenueCashiers = (venueId: string, token: string) =>
  venueRequest<{ data: VenueCashier[] }>(`/api/venues/${venueId}/cashiers`, token).then(
    (r) => r.data
  );

export const createVenueCashier = (
  venueId: string,
  token: string,
  input: VenueCashierInput
) =>
  venueRequest<{ data: VenueCashier }>(`/api/venues/${venueId}/cashiers`, token, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);

export const updateVenueCashier = (
  venueId: string,
  cashierId: string,
  token: string,
  input: Partial<Pick<VenueCashierInput, "firstName" | "lastName" | "phoneNumber">> & {
    isActive?: boolean;
  }
) =>
  venueRequest<{ data: VenueCashier }>(
    `/api/venues/${venueId}/cashiers/${cashierId}`,
    token,
    { method: "PATCH", body: JSON.stringify(input) }
  ).then((r) => r.data);

export const deleteVenueCashier = (venueId: string, cashierId: string, token: string) =>
  venueRequest<{ message?: string }>(`/api/venues/${venueId}/cashiers/${cashierId}`, token, {
    method: "DELETE",
  });

// A cashier can't reach GET /api/venues/me — that's the owner's own profile,
// including its commission rate and VAT setting, which is exactly the
// "finance" surface a cashier must never see (see the User model's role
// comment). listVenueBeverages is already open to staff and happens to
// return the venue's basic identity alongside the line-up, so a cashier's own
// client resolves "which venue am I" from there instead.
export const fetchVenueIdentityForCashier = (venueId: string, token: string) =>
  venueRequest<{
    venue: { _id: string; name: string; venueType: string; isActive: boolean };
  }>(`/api/venues/${venueId}/beverages`, token).then((r) => r.venue);

// --- Counter selling ------------------------------------------------------
//
// What a venue (or its cashier — see adminOrVenueStaff in venueRoutes.js)
// may pick from at the counter, and the sale it records.

export interface VenueBeverageLineupRow {
  _id: string;
  beverage: { _id: string; name: string; image?: string | null; color?: string | null; isActive: boolean } | null;
  price: number;
  currency?: string;
  remaining: number;
  unlimitedStock?: boolean;
  unavailableReason: "removed" | "inactive" | "blocked" | null;
}

export const fetchVenueBeverages = (venueId: string, token: string) =>
  venueRequest<{ data: VenueBeverageLineupRow[] }>(`/api/venues/${venueId}/beverages`, token).then(
    (r) => r.data
  );

export const createVenueSale = (
  venueId: string,
  token: string,
  body: { venueBeverageId: string; quantity: number; customerName?: string; customerPhone?: string }
) =>
  venueRequest<{ data: VenueSale }>(`/api/venues/${venueId}/sales`, token, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const fetchOutstandingVenueOrder = (venueId: string, paymentReference: string, token: string) =>
  venueRequest<{ data: VenueOutstandingItem[] }>(
    `/api/venues/${venueId}/sales/outstanding/${encodeURIComponent(paymentReference)}`,
    token
  ).then((r) => r.data);

export const redeemVenueSale = (venueId: string, saleId: string, token: string) =>
  venueRequest<{ data: VenueSale }>(`/api/venues/${venueId}/sales/${saleId}/redeem`, token, {
    method: "POST",
  });
