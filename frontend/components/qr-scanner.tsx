"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Martini,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { useAuthStore } from "@/store/authStore";
import { useOrganizerAuthStore } from "@/store/organizerAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScanTarget = "ticket" | "rsvp";

type ResponseDetail = {
  label: string;
  value: string;
  questionId?: string;
  type?: string;
};

type RsvpScanData = {
  responseId: string;
  entryType: "rsvp";
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  status?: string;
  tag?: string;
  submittedAt?: string;
  eligibleForEntry?: boolean;
  responseDetails?: ResponseDetail[];
};

// A drink this ticket-holder paid for online (the mobile app's "refill"
// checkout) and hasn't collected yet — same shape the door needs to show for
// a cinema order's outstanding snacks, one level up: keyed by ticket/event
// rather than by a single order, since a refill can happen more than once
// over the course of an event.
type OwedBeverage = {
  _id: string;
  referenceNumber?: string;
  beverageName: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
};

type ValidateResult = {
  success?: boolean;
  message?: string;
  alreadyCheckedIn?: boolean;
  outstandingBeverages?: OwedBeverage[];
  data?: RsvpScanData & {
    entryType?: ScanTarget;
    ticketId?: string;
    userName?: string;
    eventTitle?: string;
    checkedIn?: boolean;
    remainingUses?: number;
    purchaseQuantity?: number;
    ticketCount?: number;
  };
};

type OverlayState = {
  tone: "idle" | "processing" | "success" | "error";
  title: string;
  detail: string;
};

const SCAN_DEBOUNCE_MS = 2200;
const OVERLAY_RESET_MS = 1800;

const RSVP_SCANNER_TYPES = new Set(["rsvp_response", "rsvp"]);

const parsePersistedToken = (storageKey: string) => {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || parsed?.token || null;
  } catch {
    return null;
  }
};

const resolveAuthToken = () => {
  if (typeof window === "undefined") return null;

  return (
    useAuthStore.getState().token ||
    useOrganizerAuthStore.getState().token ||
    useAdminAuthStore.getState().token ||
    parsePersistedToken("auth-storage") ||
    parsePersistedToken("organizer-auth") ||
    parsePersistedToken("admin-auth-storage") ||
    window.localStorage.getItem("token") ||
    null
  );
};

const isRsvpQr = (qrData: string) => {
  try {
    const parsed = JSON.parse(qrData);
    return Boolean(
      parsed?.rid ||
        parsed?.responseId ||
        RSVP_SCANNER_TYPES.has(String(parsed?.type || "").toLowerCase())
    );
  } catch {
    return false;
  }
};

const extractQrText = (
  result:
    | string
    | { text?: string; rawValue?: string }
    | { text?: string; rawValue?: string }[]
    | undefined
) => {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (Array.isArray(result)) {
    const first = result.find((item) => item?.rawValue || item?.text);
    return first?.rawValue || first?.text || "";
  }
  return result.rawValue || result.text || "";
};

export default function QRScanner() {
  const searchParams = useSearchParams();
  const lastScanRef = useRef<{ text: string; timestamp: number }>({
    text: "",
    timestamp: 0,
  });
  const busyRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({
    tone: "idle",
    title: "",
    detail: "",
  });
  const [rsvpScan, setRsvpScan] = useState<RsvpScanData | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ticketCheckInOpen, setTicketCheckInOpen] = useState(false);
  const [ticketData, setTicketData] = useState<ValidateResult['data'] | null>(null);
  const [checkInCount, setCheckInCount] = useState(1);
  // Drinks bought online for this ticket-holder, still owed. Shown in the
  // same dialog as check-in — sometimes instead of it, when the ticket was
  // already checked in earlier and this scan is purely a refill collection.
  const [outstandingBeverages, setOutstandingBeverages] = useState<OwedBeverage[]>([]);
  const [ticketAlreadyCheckedIn, setTicketAlreadyCheckedIn] = useState(false);
  const [collectingBeverageId, setCollectingBeverageId] = useState<string | null>(null);

  const scope = useMemo(() => {
    const mode = searchParams.get("mode");
    const eventId = (searchParams.get("eventId") || "").trim();
    const formId = (searchParams.get("formId") || "").trim();

    if (mode === "ticket" && eventId) {
      return { type: "ticket" as const, id: eventId };
    }
    if (mode === "rsvp" && formId) {
      return { type: "rsvp" as const, id: formId };
    }
    return { type: null, id: "" };
  }, [searchParams]);

  const scannerLabel = scope.type === "rsvp" ? "RSVP pass scanner" : scope.type === "ticket" ? "Ticket scanner" : "QR scanner";

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const queueReset = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      setOverlay({ tone: "idle", title: "", detail: "" });
    }, OVERLAY_RESET_MS);
  };

  const showOverlay = (
    tone: OverlayState["tone"],
    title: string,
    detail = ""
  ) => {
    setOverlay({ tone, title, detail });

    if (tone === "idle") {
      busyRef.current = false;
      return;
    }

    if (tone === "processing") {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      return;
    }

    queueReset();
  };

  const scopedBody =
    scope.type === "rsvp"
      ? { scopeFormId: scope.id }
      : scope.type === "ticket"
        ? { scopeEventId: scope.id }
        : {};

  const validateRsvp = async (qrData: string, authToken: string) => {
    showOverlay("processing", "Reading RSVP pass", "Hold steady...");

    const validateResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/rsvp/responses/validate-qr`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          qrData,
          ...scopedBody,
        }),
      }
    );

    const validateResult = (await validateResponse.json().catch(() => ({}))) as ValidateResult;
    const scanData = validateResult.data;

    if (!scanData?.responseId) {
      const message = validateResult.message || "Failed to validate RSVP pass";
      showOverlay("error", "Pass rejected", message);
      toast.error(message);
      setRsvpScan(null);
      return;
    }

    const normalized: RsvpScanData = {
      responseId: scanData.responseId,
      entryType: "rsvp",
      eventTitle: scanData.eventTitle || "RSVP event",
      eventDate: scanData.eventDate,
      eventTime: scanData.eventTime,
      eventLocation: scanData.eventLocation,
      userName: scanData.userName || "Attendee",
      userEmail: scanData.userEmail,
      userPhone: scanData.userPhone,
      status: scanData.status,
      tag: scanData.tag,
      submittedAt: scanData.submittedAt,
      eligibleForEntry: scanData.eligibleForEntry,
      responseDetails: scanData.responseDetails || [],
    };

    setRsvpScan(normalized);

    if (!validateResponse.ok || !validateResult.success) {
      showOverlay("error", "RSVP not valid", validateResult.message || "This RSVP is not approved yet");
      toast.error(validateResult.message || "RSVP is not approved yet");
      busyRef.current = false;
      return;
    }

    showOverlay("success", normalized.userName, normalized.eventTitle);
    busyRef.current = false;
  };

  const validateAndCheckInTicket = async (qrData: string, authToken: string) => {
    showOverlay("processing", "Checking ticket", "Hold steady...");

    const validateResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/validate-qr`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          qrData,
          ...scopedBody,
        }),
      }
    );

    const validateResult = (await validateResponse.json().catch(() => ({}))) as ValidateResult;

    if (!validateResponse.ok || !validateResult.success || !validateResult.data) {
      const message = validateResult.message || "Failed to validate QR code";
      showOverlay("error", "Ticket rejected", message);
      toast.error(message);
      return;
    }

    const scanData = validateResult.data;
    const owed = validateResult.outstandingBeverages || [];

    if (validateResult.alreadyCheckedIn || scanData.checkedIn) {
      // Already admitted — normally nothing left to do here. But a refill
      // purchase can happen any time over the course of an event, so a
      // re-scan of the same ticket is also how the door finds out there are
      // drinks to hand over. Only bail with the plain error when there is
      // nothing else to show.
      if (owed.length) {
        setTicketData(scanData);
        setOutstandingBeverages(owed);
        setTicketAlreadyCheckedIn(true);
        setTicketCheckInOpen(true);
        busyRef.current = false;
        setOverlay({ tone: "idle", title: "", detail: "" });
        return;
      }
      const message = validateResult.message || "Ticket already checked in";
      showOverlay("error", "Already checked in", message);
      toast.error(message);
      return;
    }

    // Show confirmation dialog instead of auto-checking in
    setTicketData(scanData);
    setOutstandingBeverages(owed);
    setTicketAlreadyCheckedIn(false);
    setCheckInCount(scanData.purchaseQuantity || scanData.ticketCount || 1);
    setTicketCheckInOpen(true);
    busyRef.current = false;
    setOverlay({ tone: "idle", title: "", detail: "" });
  };

  const performCheckIn = async () => {
    if (!ticketData?.ticketId) return;

    const authToken = resolveAuthToken();
    if (!authToken) {
      toast.error("Authentication required");
      return;
    }

    showOverlay("processing", "Checking in...", "Processing...");

    const checkInResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticketData.ticketId}/check-in`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          count: checkInCount,
          ...scopedBody,
        }),
      }
    );

    const checkInResult = (await checkInResponse.json().catch(() => ({}))) as ValidateResult & {
      data?: { remainingUses?: number };
    };

    setTicketCheckInOpen(false);
    setTicketData(null);
    setOutstandingBeverages([]);
    setTicketAlreadyCheckedIn(false);

    if (!checkInResponse.ok || !checkInResult.success) {
      const message = checkInResult.message || "Check-in failed";
      showOverlay("error", "Check-in failed", message);
      toast.error(message);
      return;
    }

    const remainingUses =
      typeof checkInResult.data?.remainingUses === "number"
        ? `Remaining uses: ${checkInResult.data.remainingUses}`
        : ticketData.eventTitle || "";

    showOverlay("success", ticketData.userName || "Guest checked in", remainingUses);
    toast.success(checkInResult.message || "Check-in successful");
  };

  const validateAndCheckIn = async (qrData: string) => {
    const authToken = resolveAuthToken();
    if (!authToken) {
      showOverlay("error", "Authentication required", "Sign in again to scan.");
      toast.error("Authentication required");
      return;
    }

    const scannedType: ScanTarget = isRsvpQr(qrData) ? "rsvp" : "ticket";
    if (scope.type && scannedType !== scope.type) {
      showOverlay("error", "Wrong QR code", "This scanner is scoped to another pass type.");
      toast.error("Wrong QR code for this scanner");
      busyRef.current = false;
      return;
    }

    setRsvpScan(null);

    try {
      if (scannedType === "rsvp") {
        await validateRsvp(qrData, authToken);
        return;
      }

      await validateAndCheckInTicket(qrData, authToken);
    } catch (error) {
      console.error("Scanner error:", error);
      showOverlay("error", "Scanner error", "Please try again.");
      toast.error("Failed to process scan");
      busyRef.current = false;
    }
  };

  const handleScan = (
    result:
      | string
      | { text?: string; rawValue?: string }
      | { text?: string; rawValue?: string }[]
      | undefined
  ) => {
    const qrText = extractQrText(result).trim();
    if (!qrText || busyRef.current) return;

    const now = Date.now();
    if (
      lastScanRef.current.text === qrText &&
      now - lastScanRef.current.timestamp < SCAN_DEBOUNCE_MS
    ) {
      return;
    }

    lastScanRef.current = { text: qrText, timestamp: now };
    busyRef.current = true;
    void validateAndCheckIn(qrText);
  };

  const handleError = (error: unknown) => {
    const name =
      typeof error === "object" && error && "name" in error
        ? String(error.name)
        : "";

    if (name === "NotAllowedError") {
      showOverlay("error", "Camera blocked", "Allow camera access to continue.");
      toast.error("Camera access denied");
      return;
    }

    showOverlay("error", "Camera error", "Unable to access the scanner.");
    toast.error("Scanner camera failed");
  };

  const dismissRsvpCard = () => {
    setRsvpScan(null);
    setDetailsOpen(false);
    busyRef.current = false;
    setOverlay({ tone: "idle", title: "", detail: "" });
  };

  const dismissTicketCheckIn = () => {
    setTicketCheckInOpen(false);
    setTicketData(null);
    setCheckInCount(1);
    setOutstandingBeverages([]);
    setTicketAlreadyCheckedIn(false);
    busyRef.current = false;
  };

  const collectBeverage = async (item: OwedBeverage) => {
    const authToken = resolveAuthToken();
    if (!authToken) {
      toast.error("Authentication required");
      return;
    }

    setCollectingBeverageId(item._id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/beverages/sales/${item._id}/redeem`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        toast.error(result.message || "Could not mark this as handed over");
        return;
      }
      setOutstandingBeverages((items) => items.filter((i) => i._id !== item._id));
      toast.success(`${item.beverageName} handed over`);
    } catch {
      toast.error("Could not mark this as handed over");
    } finally {
      setCollectingBeverageId(null);
    }
  };

  const overlayClasses =
    overlay.tone === "success"
      ? "border-emerald-400/60 bg-emerald-500/15 text-white"
      : overlay.tone === "error"
        ? "border-red-400/60 bg-red-500/15 text-white"
        : "border-white/25 bg-black/50 text-white";

  return (
    <div className="relative h-full min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-black">
      <div className="absolute inset-0 [&>div]:h-full [&>div]:w-full">
        <Scanner
          onScan={handleScan}
          onError={handleError}
          allowMultiple={false}
          components={{
            finder: true,
            zoom: true,
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-white/85 backdrop-blur">
          {scannerLabel}
        </div>
      </div>

      {rsvpScan ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-6">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300">
                  RSVP response
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold">{rsvpScan.userName}</h2>
                <p className="truncate text-sm text-white/75">{rsvpScan.eventTitle}</p>
              </div>
              <Badge
                variant="outline"
                className={`rounded-full border capitalize ${
                  rsvpScan.eligibleForEntry
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : "border-amber-400/50 bg-amber-500/15 text-amber-200"
                }`}
              >
                {rsvpScan.status || "pending"}
              </Badge>
            </div>

            {(rsvpScan.userEmail || rsvpScan.userPhone) && (
              <div className="mt-4 space-y-1 text-sm text-white/70">
                {rsvpScan.userEmail ? <p>{rsvpScan.userEmail}</p> : null}
                {rsvpScan.userPhone ? <p>{rsvpScan.userPhone}</p> : null}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full"
                onClick={() => setDetailsOpen(true)}
              >
                <Info className="mr-2 h-4 w-4" />
                Details
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 rounded-full text-white/80 hover:text-white"
                onClick={dismissRsvpCard}
              >
                Scan next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
          {overlay.tone !== "idle" ? (
            <div
              className={`flex min-w-[18rem] max-w-md items-center gap-3 rounded-3xl border px-4 py-3 shadow-2xl backdrop-blur ${overlayClasses}`}
            >
              {overlay.tone === "processing" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : overlay.tone === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{overlay.title}</p>
                {overlay.detail ? (
                  <p className="truncate text-xs text-white/80">{overlay.detail}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Response details</DialogTitle>
            <DialogDescription>
              {rsvpScan
                ? `${rsvpScan.userName} · ${rsvpScan.eventTitle}`
                : "RSVP response"}
            </DialogDescription>
          </DialogHeader>

          {rsvpScan ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="font-medium text-slate-900 dark:text-white">{rsvpScan.eventTitle}</p>
                {rsvpScan.eventDate ? (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{rsvpScan.eventDate}</p>
                ) : null}
                {rsvpScan.eventTime ? (
                  <p className="text-slate-600 dark:text-slate-400">{rsvpScan.eventTime}</p>
                ) : null}
                {rsvpScan.eventLocation ? (
                  <p className="text-slate-600 dark:text-slate-400">{rsvpScan.eventLocation}</p>
                ) : null}
              </div>

              {(rsvpScan.responseDetails || []).length > 0 ? (
                rsvpScan.responseDetails?.map((item) => (
                  <div
                    key={`${item.questionId || item.label}-${item.label}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-900 dark:text-white">{item.value}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No response details available.
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ticketCheckInOpen} onOpenChange={setTicketCheckInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ticketAlreadyCheckedIn ? "Drinks to collect" : "Confirm Check-in"}</DialogTitle>
            <DialogDescription>
              {ticketData ? `${ticketData.userName} · ${ticketData.eventTitle}` : "Ticket details"}
            </DialogDescription>
          </DialogHeader>

          {ticketData && (
            <div className="space-y-4">
              {!ticketAlreadyCheckedIn && (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-medium text-slate-900 dark:text-white">{ticketData.eventTitle}</p>

                    <p className="text-slate-600 dark:text-slate-400">
                      Total tickets: {ticketData.purchaseQuantity || ticketData.ticketCount || 1}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="checkInCount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Number of tickets to check in
                    </label>
                    <Input
                      id="checkInCount"
                      type="number"
                      min="1"
                      max={ticketData.purchaseQuantity || ticketData.ticketCount || 1}
                      value={checkInCount}
                      onChange={(e) => setCheckInCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, ticketData.purchaseQuantity || ticketData.ticketCount || 1)))}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {outstandingBeverages.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                  <p className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-300">
                    <Martini className="h-4 w-4" /> Paid for, not collected
                  </p>
                  <div className="space-y-2">
                    {outstandingBeverages.map((item) => (
                      <div key={item._id} className="flex items-center justify-between gap-3">
                        <span className="text-amber-900 dark:text-amber-200">
                          {item.quantity} × {item.beverageName}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-200"
                          disabled={collectingBeverageId === item._id}
                          onClick={() => collectBeverage(item)}
                        >
                          {collectingBeverageId === item._id ? "Handing over…" : "Handed over"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={dismissTicketCheckIn}
            >
              {ticketAlreadyCheckedIn ? "Close" : "Cancel"}
            </Button>
            {!ticketAlreadyCheckedIn && (
              <Button
                type="button"
                className="rounded-full bg-[#1a2d5a] hover:bg-[#2a4d7a]"
                onClick={performCheckIn}
              >
                Check in
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
