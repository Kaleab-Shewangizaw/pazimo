"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCompactMoney } from "@/lib/utils";
import {
  Beer,
  Plus,
  Pencil,
  Trash2,
  Power,
  AlertTriangle,
  Zap,
  Timer,
  X,
} from "lucide-react";
import { getBeverageColorVars } from "@/lib/beverage-color";

export interface CatalogBeverage {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
}

/**
 * A happy hour's state right now, computed server-side (see
 * backend/src/utils/happyHour.js) — never trust a locally-derived status,
 * only the countdown target it hands back.
 *
 * `startsAt: null` on a "scheduled" row is the signal that this is a MANUAL
 * happy hour still waiting on the "Start now" button, not a scheduled one
 * counting down to a future time — the two need different UI.
 */
export interface HappyHourStatus {
  status: "none" | "scheduled" | "active" | "ended";
  price?: number;
  startsAt?: string | null;
  endsAt?: string;
  endedAt?: string;
}

export interface HappyHourCampaignItem {
  lineup: string;
  price: number;
  beverage?: { _id: string; name: string; color?: string | null } | null;
  regularPrice?: number | null;
}

/** A published happy-hour campaign — see backend/src/models/HappyHour.js. */
export interface HappyHourCampaign {
  _id: string;
  scope: "EVENT" | "VENUE";
  items: HappyHourCampaignItem[];
  durationMinutes: number;
  startMode: "manual" | "scheduled";
  scheduledStartAt?: string | null;
  startedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export interface LineupRow {
  _id: string;
  price: number;
  currency: string;
  isAvailable: boolean;
  stockTotal: number;
  sold: number;
  remaining: number;
  beverage: CatalogBeverage & { isActive: boolean };
  // Set by the API when a drink is no longer sellable — paused centrally,
  // blocked for this organizer, or deleted from the catalogue.
  unavailableReason: "inactive" | "blocked" | "removed" | null;
  happyHourStatus?: HappyHourStatus;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const buildBeverageImageUrl = (image?: string | null) =>
  image ? `${API_URL}${image}` : null;

/**
 * Client-side mirror of backend/src/utils/happyHour.js's getCampaignState —
 * for DISPLAY only (countdowns, badges). The server is still the only thing
 * that ever decides what a customer actually pays; this just avoids a
 * network round trip on every tick to know whether a campaign is still
 * "scheduled" or has flipped to "active" on the clock alone.
 */
const computeCampaignState = (
  campaign: HappyHourCampaign,
  nowMs: number
): { status: "cancelled" | "scheduled" | "active" | "ended"; startsAt?: string | null; endsAt?: string } => {
  if (campaign.cancelledAt) return { status: "cancelled" };
  const effectiveStart = campaign.startMode === "manual" ? campaign.startedAt : campaign.scheduledStartAt;
  if (!effectiveStart) return { status: "scheduled", startsAt: null };
  const startsAtMs = new Date(effectiveStart).getTime();
  if (nowMs < startsAtMs) return { status: "scheduled", startsAt: effectiveStart };
  const endsAtMs = startsAtMs + campaign.durationMinutes * 60 * 1000;
  if (nowMs < endsAtMs) {
    return { status: "active", startsAt: effectiveStart, endsAt: new Date(endsAtMs).toISOString() };
  }
  return { status: "ended" };
};

const UNAVAILABLE_COPY: Record<string, string> = {
  inactive: "Pazimo has paused this drink. It won't be sold until it returns.",
  blocked: "This seller is no longer approved to sell this drink.",
  removed: "This drink was removed from the Pazimo catalogue.",
};

/**
 * Which sales channel this manager is editing.
 *
 * An event line-up and a venue line-up are the same interaction — pick from the
 * catalogue, set a price, set stock, stop selling — against different owners.
 * One component serves both rather than a near-copy per channel, because a copy
 * is where the two would silently drift apart on validation and on the
 * stop-selling-vs-delete rule that protects the ledger.
 *
 * Only the endpoints and the noun differ, and both live in this table.
 */
type ChannelContext =
  | { kind: "event"; eventId: string; scope: "admin" | "organizer" }
  | { kind: "venue"; venueId: string; scope: "admin" | "venue" };

const CHANNEL_COPY = {
  event: { place: "this event", placeCap: "This event", owner: "organizer" },
  venue: { place: "this venue", placeCap: "This venue", owner: "venue" },
} as const;

interface BeverageLineupManagerProps {
  token: string;
  // Which surface is mounting this. Chooses the API prefix, and admins get
  // wording that refers to the owner in the third person.
  context: ChannelContext;
  onForbidden?: () => void;
  onEventLoaded?: (event: { title: string }) => void;
}

export function BeverageLineupManager({
  token,
  context,
  onForbidden,
  onEventLoaded,
}: BeverageLineupManagerProps) {
  const isAdmin = context.scope === "admin";
  const copy = CHANNEL_COPY[context.kind];

  // Admins pick from the drinks this owner is allowed to sell, which is not the
  // same list as the raw catalogue — the deny list is applied server-side.
  const lineupUrl =
    context.kind === "venue"
      ? `${API_URL}/api/venues/${context.venueId}/beverages`
      : `${API_URL}/api/beverages/${context.scope}/events/${context.eventId}/beverages`;
  const catalogUrl =
    context.kind === "venue"
      ? `${API_URL}/api/venues/${context.venueId}/catalog`
      : isAdmin
      ? `${API_URL}/api/beverages/admin/events/${context.eventId}/catalog`
      : `${API_URL}/api/beverages/organizer/catalog`;

  const [rows, setRows] = useState<LineupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<string>("eligible");

  const [catalog, setCatalog] = useState<CatalogBeverage[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addBeverageId, setAddBeverageId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addStock, setAddStock] = useState("");
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState<LineupRow | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [removeTarget, setRemoveTarget] = useState<LineupRow | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // Happy hour — a CAMPAIGN: pick one or more drinks from the line-up above,
  // price each, publish. `campaigns` is the list of published campaigns for
  // this event/venue (any status — the list doubles as history, which is how
  // admin sees what an organizer/venue has run). A local per-second tick
  // moves every countdown without any server traffic; see
  // backend/src/utils/happyHour.js for why the server never has to push a
  // tick itself.
  const [campaigns, setCampaigns] = useState<HappyHourCampaign[]>([]);
  const [hhDialogOpen, setHhDialogOpen] = useState(false);
  const [hhSelectedPrices, setHhSelectedPrices] = useState<Record<string, string>>({});
  const [hhDuration, setHhDuration] = useState("60");
  const [hhStartMode, setHhStartMode] = useState<"manual" | "scheduled">("manual");
  const [hhScheduledAt, setHhScheduledAt] = useState("");
  const [hhSaving, setHhSaving] = useState(false);
  const [busyCampaign, setBusyCampaign] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const contextId = context.kind === "event" ? context.eventId : context.venueId;
  const happyHoursUrl =
    context.kind === "venue"
      ? `${API_URL}/api/venues/${context.venueId}/happy-hours`
      : `${API_URL}/api/beverages/${context.scope}/events/${context.eventId}/happy-hours`;
  const lineupIdField = context.kind === "venue" ? "venueBeverageId" : "eventBeverageId";

  const fetchLineup = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(lineupUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      // 403 is the eligibility gate rather than a failure worth shouting about;
      // the host page decides how to explain it.
      if (res.status === 403) {
        onForbidden?.();
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load beverages");

      setRows(data.data);
      // The two channels name this after their owner; either means the same
      // thing — may this seller list drinks at all?
      setEligibility(data.venueEligibility || data.organizerEligibility || "eligible");
      if (data.event) onEventLoaded?.(data.event);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load beverages");
    } finally {
      setLoading(false);
    }
    // onForbidden/onEventLoaded are host callbacks; re-running on their identity
    // would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupUrl, token]);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(happyHoursUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) setCampaigns(data.data);
    } catch {
      // Non-fatal — the drinks grid above still works without campaign history.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [happyHoursUrl, token]);

  useEffect(() => {
    fetchLineup();
    fetchCampaigns();
  }, [fetchLineup, fetchCampaigns]);

  // Ticks once a second, but only while at least one campaign actually has a
  // countdown running — no point re-rendering every card every second when
  // nothing on the page is timed.
  useEffect(() => {
    const hasLive =
      rows.some((row) => ["scheduled", "active"].includes(row.happyHourStatus?.status || "none")) ||
      campaigns.some((c) => ["scheduled", "active"].includes(computeCampaignState(c, Date.now()).status));
    if (!hasLive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rows, campaigns]);

  // Live push for the transitions the server can't be predicted from data
  // alone — someone else on this event/venue's dashboard hitting "Start now"
  // or cancelling. A refetch is simpler than reconciling the socket payload
  // by hand and this is a low-frequency event, not a per-second stream.
  useEffect(() => {
    if (!token || !contextId) return;
    const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.emit(
      "subscribeBeverages",
      context.kind === "event" ? { eventId: contextId } : { venueId: contextId }
    );
    const refresh = () => {
      fetchLineup();
      fetchCampaigns();
    };
    socket.on("happyHour:started", refresh);
    socket.on("happyHour:cancelled", refresh);
    socket.on("happyHour:scheduled", refresh);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, context.kind, contextId]);

  const request = async (url: string, method: string, body?: Record<string, unknown>) => {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");
    return data;
  };

  const openAdd = async () => {
    setAddBeverageId("");
    setAddPrice("");
    setAddStock("");
    setAddOpen(true);
    try {
      const data = await request(catalogUrl, "GET");
      setCatalog(data.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the catalogue");
    }
  };

  const handleAdd = async () => {
    if (!addBeverageId) {
      toast.error("Pick a drink to add");
      return;
    }
    if (!(Number(addPrice) > 0)) {
      toast.error("Enter a price greater than 0");
      return;
    }
    if (!Number.isInteger(Number(addStock)) || Number(addStock) < 1) {
      toast.error("Enter how many bottles are for sale");
      return;
    }
    try {
      setSaving(true);
      await request(lineupUrl, "POST", {
        beverageId: addBeverageId,
        price: addPrice,
        stockTotal: addStock,
      });
      toast.success(`Drink added to ${copy.place}`);
      setAddOpen(false);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add the drink");
    } finally {
      setSaving(false);
    }
  };

  const handleReprice = async () => {
    if (!editRow) return;
    if (!(Number(editPrice) > 0)) {
      toast.error("Enter a price greater than 0");
      return;
    }
    if (!Number.isInteger(Number(editStock)) || Number(editStock) < 1) {
      toast.error("Enter how many bottles are for sale");
      return;
    }
    // Caught here as well as on the server so the message names the number the
    // organizer is actually up against.
    if (Number(editStock) < editRow.sold) {
      toast.error(`${editRow.sold} already sold — stock can't go below that`);
      return;
    }
    try {
      setSaving(true);
      await request(`${lineupUrl}/${editRow._id}`, "PATCH", {
        price: editPrice,
        stockTotal: editStock,
      });
      toast.success("Drink updated");
      setEditRow(null);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the price");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (row: LineupRow) => {
    try {
      setBusyRow(row._id);
      await request(`${lineupUrl}/${row._id}`, "PATCH", { isAvailable: !row.isAvailable });
      toast.success(row.isAvailable ? "Stopped selling this drink" : "Selling this drink again");
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the drink");
    } finally {
      setBusyRow(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setBusyRow(removeTarget._id);
      await request(`${lineupUrl}/${removeTarget._id}`, "DELETE");
      toast.success(`Drink removed from ${copy.place}`);
      setRemoveTarget(null);
      fetchLineup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove the drink");
    } finally {
      setBusyRow(null);
    }
  };

  const openHappyHourDialog = () => {
    setHhSelectedPrices({});
    setHhDuration("60");
    setHhStartMode("manual");
    setHhScheduledAt("");
    setHhDialogOpen(true);
  };

  const toggleHhSelection = (rowId: string) => {
    setHhSelectedPrices((prev) => {
      const next = { ...prev };
      if (rowId in next) delete next[rowId];
      else next[rowId] = "";
      return next;
    });
  };

  const handlePublishHappyHour = async () => {
    const entries = Object.entries(hhSelectedPrices);
    if (!entries.length) {
      toast.error("Pick at least one drink");
      return;
    }
    for (const [rowId, priceStr] of entries) {
      const row = rows.find((r) => r._id === rowId);
      const price = Number(priceStr);
      if (!row || !(price > 0) || price >= row.price) {
        toast.error(
          `Enter a price lower than ${formatCompactMoney(row?.price ?? 0, row?.currency ?? "ETB")} for ${
            row?.beverage?.name || "that drink"
          }`
        );
        return;
      }
    }
    if (!Number.isInteger(Number(hhDuration)) || Number(hhDuration) < 1) {
      toast.error("Enter how many minutes it should run");
      return;
    }
    if (hhStartMode === "scheduled" && !hhScheduledAt) {
      toast.error("Pick when it should start");
      return;
    }

    try {
      setHhSaving(true);
      await request(happyHoursUrl, "POST", {
        items: entries.map(([rowId, priceStr]) => ({ [lineupIdField]: rowId, price: priceStr })),
        durationMinutes: hhDuration,
        startMode: hhStartMode,
        ...(hhStartMode === "scheduled"
          ? { scheduledStartAt: new Date(hhScheduledAt).toISOString() }
          : {}),
      });
      toast.success(
        hhStartMode === "manual"
          ? "Happy hour published — start it whenever you're ready"
          : "Happy hour scheduled"
      );
      setHhDialogOpen(false);
      fetchLineup();
      fetchCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish the happy hour");
    } finally {
      setHhSaving(false);
    }
  };

  const handleStartCampaign = async (campaign: HappyHourCampaign) => {
    try {
      setBusyCampaign(campaign._id);
      await request(`${happyHoursUrl}/${campaign._id}/start`, "POST");
      toast.success("Happy hour started");
      fetchLineup();
      fetchCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start the happy hour");
    } finally {
      setBusyCampaign(null);
    }
  };

  const handleCancelCampaign = async (campaign: HappyHourCampaign) => {
    try {
      setBusyCampaign(campaign._id);
      await request(`${happyHoursUrl}/${campaign._id}`, "DELETE");
      toast.success("Happy hour cancelled");
      fetchLineup();
      fetchCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel the happy hour");
    } finally {
      setBusyCampaign(null);
    }
  };

  /** mm:ss under an hour, otherwise "Xh Ym" — ticks off `nowTick`. */
  const formatCountdown = (targetIso?: string | null) => {
    if (!targetIso) return null;
    const diffMs = new Date(targetIso).getTime() - nowTick;
    if (diffMs <= 0) return "0:00";
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  // Already-added drinks are filtered out of the picker rather than offered and
  // then rejected on submit.
  const addable = catalog.filter(
    (beverage) => !rows.some((row) => row.beverage?._id === beverage._id)
  );
  const notApproved = eligibility !== "eligible";

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
            <Skeleton className="aspect-square rounded-none" />
            <div className="p-4">
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && notApproved && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This {copy.owner} isn&apos;t approved to sell beverages, so no new drinks can be added.
          You can still edit or remove what&apos;s already here.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={openHappyHourDialog}
          disabled={notApproved || rows.length === 0}
          className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
        >
          <Zap className="mr-2 h-4 w-4" /> Happy hour
        </Button>
        <Button
          type="button"
          onClick={openAdd}
          disabled={notApproved}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Add a drink
        </Button>
      </div>

      {campaigns.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/10">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
            <Zap className="h-4 w-4" /> Happy hours
          </h3>
          <div className="space-y-2">
            {campaigns.map((campaign) => {
              const state = computeCampaignState(campaign, nowTick);
              const names = campaign.items
                .map((item) => item.beverage?.name || "Removed drink")
                .join(", ");
              return (
                <div
                  key={campaign._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">{names}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {state.status === "cancelled" && "Cancelled"}
                      {state.status === "ended" && "Ended"}
                      {state.status === "active" && `Running — ends in ${formatCountdown(state.endsAt)}`}
                      {state.status === "scheduled" &&
                        (state.startsAt
                          ? `Starts in ${formatCountdown(state.startsAt)}`
                          : "Ready — waiting to be started")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {state.status === "scheduled" && !state.startsAt && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyCampaign === campaign._id}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => handleStartCampaign(campaign)}
                      >
                        Start now
                      </Button>
                    )}
                    {(state.status === "scheduled" || state.status === "active") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyCampaign === campaign._id}
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleCancelCampaign(campaign)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-gray-700">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <Beer className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No drinks on {copy.place}
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
            {isAdmin
              ? "Nothing is being sold here yet."
              : context.kind === "venue"
              ? "Add a drink and set your price. This is what customers pay at your bar."
              : "Add a drink and set your price. Guests buy ahead of the event, so price below what they'd pay at the door."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const stoppedCentrally = row.unavailableReason !== null;
            const selling = row.isAvailable && !stoppedCentrally;
            return (
              <div
                key={row._id}
                style={getBeverageColorVars(row.beverage?.color)}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--bev-border)] bg-white shadow-sm dark:border-[var(--bev-border-dark)] dark:bg-gray-900"
              >
                <div className="relative aspect-square shrink-0 overflow-hidden bg-gradient-to-b from-[var(--bev-panel)] to-[var(--bev-panel-2)] dark:from-[var(--bev-panel-dark)] dark:to-[var(--bev-panel-2-dark)]">
                  {buildBeverageImageUrl(row.beverage?.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildBeverageImageUrl(row.beverage.image)!}
                      alt={row.beverage.name}
                      className={`absolute inset-0 h-full w-full object-contain p-6 ${
                        selling ? "" : "opacity-40 grayscale"
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Beer className="h-10 w-10 text-amber-300 dark:text-amber-900" />
                    </div>
                  )}
                  {!selling && (
                    <Badge className="absolute right-3 top-3 bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                      {stoppedCentrally ? "Unavailable" : "Not selling"}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 font-semibold leading-tight text-gray-900 dark:text-gray-100">
                    {row.beverage?.name || "Removed drink"}
                  </h3>
                  <div className="mt-auto space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500">
                        {isAdmin ? `${copy.owner === "venue" ? "Venue" : "Organizer"}'s price` : "Your price"}
                      </span>
                      {row.happyHourStatus?.status === "active" ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-xs text-gray-400 line-through">
                            {formatCompactMoney(row.price, row.currency)}
                          </span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {formatCompactMoney(row.happyHourStatus.price ?? row.price, row.currency)}
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCompactMoney(row.price, row.currency)}
                        </span>
                      )}
                    </div>

                    {row.happyHourStatus?.status === "active" && (
                      <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5" /> Happy hour
                        </span>
                        <span className="tabular-nums">
                          Ends in {formatCountdown(row.happyHourStatus.endsAt)}
                        </span>
                      </div>
                    )}
                    {row.happyHourStatus?.status === "scheduled" && (
                      <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                        <span className="flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" /> Happy hour
                        </span>
                        <span className="tabular-nums">
                          {row.happyHourStatus.startsAt
                            ? `Starts in ${formatCountdown(row.happyHourStatus.startsAt)}`
                            : "Ready to start"}
                        </span>
                      </div>
                    )}

                    {/* Stock as a bar rather than a bare number: how close a
                        drink is to selling out is the thing worth seeing. */}
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="uppercase tracking-wide text-gray-500">Stock</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {row.sold ?? 0}
                          </span>
                          {" of "}
                          {row.stockTotal ?? 0} sold
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                        role="progressbar"
                        aria-valuenow={row.sold ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={row.stockTotal ?? 0}
                        aria-label={`${row.sold ?? 0} of ${row.stockTotal ?? 0} sold`}
                      >
                        <div
                          className="h-full rounded-full bg-[var(--bev-ink)] dark:bg-[var(--bev-ink-dark)]"
                          style={{
                            width: `${
                              row.stockTotal > 0
                                ? Math.min((row.sold / row.stockTotal) * 100, 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      {row.remaining === 0 && row.stockTotal > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]">
                          Sold out
                        </p>
                      )}
                    </div>
                  </div>
                  {stoppedCentrally && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {UNAVAILABLE_COPY[row.unavailableReason as string]}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyRow === row._id || stoppedCentrally}
                    onClick={() => toggleAvailability(row)}
                    className="flex-1"
                  >
                    <Power className="mr-1 h-4 w-4" />
                    {row.isAvailable ? "Stop selling" : "Sell again"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Change the price of ${row.beverage?.name}`}
                    onClick={() => {
                      setEditRow(row);
                      setEditPrice(String(row.price));
                      setEditStock(String(row.stockTotal ?? 0));
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.beverage?.name}`}
                    onClick={() => setRemoveTarget(row)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a drink</DialogTitle>
            <DialogDescription>
              Pick a drink and set what customers pay for it at {copy.place}.
            </DialogDescription>
          </DialogHeader>

          {addable.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">
              {catalog.length === 0
                ? isAdmin
                  ? `No drinks are approved for this ${copy.owner} yet.`
                  : "There are no drinks approved for you yet."
                : `Every approved drink is already on ${copy.place}.`}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
                {addable.map((beverage) => (
                  <button
                    key={beverage._id}
                    type="button"
                    onClick={() => setAddBeverageId(beverage._id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                      addBeverageId === beverage._id
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {buildBeverageImageUrl(beverage.image) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={buildBeverageImageUrl(beverage.image)!}
                        alt={beverage.name}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <div
                        style={getBeverageColorVars(beverage.color)}
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--bev-panel)] dark:bg-[var(--bev-panel-dark)]"
                      >
                        <Beer className="h-4 w-4 text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]" />
                      </div>
                    )}
                    <span className="flex-1 text-sm font-medium">{beverage.name}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-price">Price (ETB)</Label>
                  <Input
                    id="add-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    placeholder="e.g. 90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-stock">Bottles for sale</Label>
                  <Input
                    id="add-stock"
                    type="number"
                    min="1"
                    step="1"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value)}
                    placeholder="e.g. 200"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={saving || addable.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Adding..." : context.kind === "venue" ? "Add to venue" : "Add to event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprice dialog */}
      <Dialog open={editRow !== null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Price and stock</DialogTitle>
            <DialogDescription>{editRow?.beverage?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Price (ETB)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-stock">Bottles for sale</Label>
              <Input
                id="edit-stock"
                type="number"
                min="1"
                step="1"
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
              />
              {(editRow?.sold ?? 0) > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {editRow?.sold} already sold
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReprice}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Happy hour — create a campaign: pick drinks, price each, set timing,
          publish. Managing an existing campaign (start/cancel) happens in the
          "Happy hours" list above, not here. */}
      <Dialog open={hhDialogOpen} onOpenChange={setHhDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> New happy hour
            </DialogTitle>
            <DialogDescription>
              Pick the drinks it covers and what each one costs while it runs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-[35vh] space-y-1.5 overflow-y-auto pr-1">
              {rows
                .filter((row) => (row.happyHourStatus?.status || "none") === "none" || row.happyHourStatus?.status === "ended")
                .map((row) => {
                  const checked = row._id in hhSelectedPrices;
                  return (
                    <div
                      key={row._id}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                        checked
                          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleHhSelection(row._id)}
                        className="h-4 w-4 accent-amber-500"
                        aria-label={`Include ${row.beverage?.name}`}
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {row.beverage?.name || "Removed drink"}
                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                          (regular {formatCompactMoney(row.price, row.currency)})
                        </span>
                      </span>
                      {checked && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={`< ${row.price}`}
                          value={hhSelectedPrices[row._id]}
                          onChange={(e) =>
                            setHhSelectedPrices((prev) => ({ ...prev, [row._id]: e.target.value }))
                          }
                          className="w-24"
                        />
                      )}
                    </div>
                  );
                })}
              {rows.every(
                (row) => !["none", "ended"].includes(row.happyHourStatus?.status || "none")
              ) && (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Every drink here is already in a happy hour.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hh-duration">Duration (minutes)</Label>
              <Input
                id="hh-duration"
                type="number"
                min="1"
                step="1"
                value={hhDuration}
                onChange={(e) => setHhDuration(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Start it</Label>
              <RadioGroup
                value={hhStartMode}
                onValueChange={(v) => setHhStartMode(v as "manual" | "scheduled")}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="hh-manual" />
                  <Label htmlFor="hh-manual" className="cursor-pointer font-normal">
                    Manually — I&apos;ll press Start when I&apos;m ready
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="scheduled" id="hh-scheduled" />
                  <Label htmlFor="hh-scheduled" className="cursor-pointer font-normal">
                    At a scheduled time
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {hhStartMode === "scheduled" && (
              <div className="space-y-1.5">
                <Label htmlFor="hh-scheduled-at">Starts at</Label>
                <Input
                  id="hh-scheduled-at"
                  type="datetime-local"
                  value={hhScheduledAt}
                  onChange={(e) => setHhScheduledAt(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHhDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePublishHappyHour}
              disabled={hhSaving}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {hhSaving ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.beverage?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(removeTarget?.sold ?? 0) > 0
                ? `${removeTarget?.sold} bottles have already sold, so this can't be removed — the record of what people paid has to stay. Use "Stop selling" instead.`
                : `It comes off ${copy.place} entirely. To pause sales without losing the price and stock, use "Stop selling" instead.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={(removeTarget?.sold ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
