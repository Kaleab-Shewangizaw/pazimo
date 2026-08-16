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
