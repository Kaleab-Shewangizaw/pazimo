"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { useAuthStore } from "@/store/authStore";
import { useOrganizerAuthStore } from "@/store/organizerAuthStore";

type ScanTarget = "ticket" | "rsvp";

type ValidateResult = {
  success?: boolean;
  message?: string;
  alreadyCheckedIn?: boolean;
  data?: {
    entryType?: ScanTarget;
    ticketId?: string;
    responseId?: string;
    userName?: string;
    eventTitle?: string;
    checkedIn?: boolean;
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
      return;
    }

    showOverlay("processing", "Checking pass", "Hold steady...");

    const validateEndpoint =
      scannedType === "rsvp"
        ? "/api/rsvp/responses/validate-qr"
        : "/api/tickets/validate-qr";

    const scopedBody =
      scannedType === "rsvp" && scope.type === "rsvp"
        ? { scopeFormId: scope.id }
        : scannedType === "ticket" && scope.type === "ticket"
          ? { scopeEventId: scope.id }
          : {};

    try {
      const validateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${validateEndpoint}`,
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
        showOverlay("error", "Pass rejected", message);
        toast.error(message);
        return;
      }

      if (validateResult.alreadyCheckedIn || validateResult.data.checkedIn) {
        const message = validateResult.message || "Pass already checked in";
        showOverlay("error", "Already checked in", message);
        toast.error(message);
        return;
      }

      const scanData = validateResult.data;
      const checkInEndpoint =
        scannedType === "rsvp"
          ? `/api/rsvp/responses/${scanData.responseId}/check-in`
          : `/api/tickets/${scanData.ticketId}/check-in`;

      const checkInResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${checkInEndpoint}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(
            scannedType === "rsvp"
              ? scopedBody
              : {
                  count: 1,
                  ...scopedBody,
                }
          ),
        }
      );

      const checkInResult = (await checkInResponse.json().catch(() => ({}))) as ValidateResult & {
        data?: { remainingUses?: number };
      };

      if (!checkInResponse.ok || !checkInResult.success) {
        const message = checkInResult.message || "Check-in failed";
        showOverlay("error", "Check-in failed", message);
        toast.error(message);
        return;
      }

      if (checkInResult.alreadyCheckedIn) {
        const message = checkInResult.message || "Pass already checked in";
        showOverlay("error", "Already checked in", message);
        toast.error(message);
        return;
      }

      const remainingUses =
        scannedType === "ticket" && typeof checkInResult.data?.remainingUses === "number"
          ? `Remaining uses: ${checkInResult.data.remainingUses}`
          : scanData.eventTitle || "";

      showOverlay(
        "success",
        scanData.userName || "Attendee checked in",
        remainingUses
      );
      toast.success(checkInResult.message || "Check-in successful");
    } catch (error) {
      console.error("Scanner error:", error);
      showOverlay("error", "Scanner error", "Please try again.");
      toast.error("Failed to process scan");
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
            audio: false,
            finder: true,
            zoom: true,
          }}
        />
      </div>

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
    </div>
  );
}
