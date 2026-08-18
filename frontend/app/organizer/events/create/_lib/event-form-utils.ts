import type {
  EventFormData,
  TicketType,
  VisibleTicketEntry,
  WaveDraft,
  WaveSwitchMode,
} from "./event-form-types";

export const TICKET_TYPES = ["Regular", "VIP", "VVIP", "Group"] as const;

export const WAVE_SWITCH_MODES: { value: WaveSwitchMode; label: string }[] = [
  { value: "date", label: "Starts On Specific Date" },
  { value: "quantity", label: "When Previous Wave Sells Out" },
  { value: "date_or_quantity", label: "Date or Sell Out (whichever comes first)" },
];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const parseDateValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const formatDateValue = (date?: Date | null) => {
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const createEmptyTicketType = (): TicketType => ({
  name: "Regular",
  price: "",
  priceETB: "",
  priceUSD: "",
  quantity: "",
  description: "",
  saleStartDate: "",
  saleEndDate: "",
  isActive: true,
  hasDateRange: false,
});

export const createInitialEventFormData = (): EventFormData => ({
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  location: {
    address: "",
    city: "",
    country: "",
    coordinates: [],
  },
  category: "",
  isPublic: true,
  ageRestriction: {
    minAge: "",
    maxAge: "",
    hasRestriction: false,
  },
  ticketTypes: [createEmptyTicketType()],
  capacity: "",
  tags: "",
  coverImages: [],
});

export const syncLegacyPriceField = (ticket: TicketType): TicketType => ({
  ...ticket,
  price: ticket.priceETB || ticket.priceUSD || ticket.price || "",
});

export const isWaveTicket = (ticket: TicketType) =>
  Boolean(ticket.waveOrder || ticket.waveGroup || /wave/i.test(ticket.name || ""));

export const isWaveChildTicket = (ticket: TicketType) =>
  Boolean(ticket.waveGroup) && Number(ticket.waveOrder || 0) > 1;

export const getWaveGroupId = (ticket: TicketType) =>
  String(ticket.waveGroup || "").trim();

export const getWaveChildren = (
  ticket: TicketType,
  ticketTypes: TicketType[] = [],
) => {
  const waveGroup = getWaveGroupId(ticket);
  if (!waveGroup) {
    return [];
  }

  return ticketTypes
    .filter(
      (candidate) =>
        getWaveGroupId(candidate) === waveGroup &&
        Number(candidate.waveOrder || 0) > 1,
    )
    .sort(
      (a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0),
    );
};

export const getVisibleTicketEntries = (
  ticketTypes: TicketType[],
): VisibleTicketEntry[] =>
  ticketTypes
    .map((ticket, index) => ({ ticket, index }))
    .filter(({ ticket }) => !isWaveChildTicket(ticket));

export const getWaveParentTickets = (ticketTypes: TicketType[]) =>
  ticketTypes
    .filter((ticket) => Number(ticket.waveOrder || 0) === 1)
    .sort((a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0));

export const groupWaveTickets = (ticketTypes: TicketType[]) =>
  ticketTypes.reduce<Record<string, TicketType[]>>((groups, ticket) => {
    const waveGroup = getWaveGroupId(ticket);
    if (!waveGroup) {
      return groups;
    }

    if (!groups[waveGroup]) {
      groups[waveGroup] = [];
    }

    groups[waveGroup].push(ticket);
    return groups;
  }, {});

// Africa/Addis_Ababa is a fixed UTC+3 offset year-round (no DST), matching the
// backend's eatTime helper. Wave start times are entered as Ethiopian wall
// clock, so they must be anchored to EAT rather than to the browser's timezone.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * The instant a wave is scheduled to take over, or null when no time trigger is
 * configured. Mirrors `getWaveStartInstant` on the backend — including the fact
 * that a *missing* date means "no trigger", never "already started".
 */
export const resolveWaveStartInstant = (
  ticket: Pick<TicketType, "saleStartDate" | "saleStartTime">,
): Date | null => {
  const date = (ticket.saleStartDate || "").trim();
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const time = (ticket.saleStartTime || "").trim();
  const [hours = 0, minutes = 0] = time
    ? time.split(":").map(Number)
    : [0, 0];

  const wallClockUtc = Date.UTC(year, month - 1, day, hours || 0, minutes || 0);
  return new Date(wallClockUtc - EAT_OFFSET_MS);
};

export const isTicketActiveByDateRange = (
  startDate: string,
  endDate: string,
): boolean => {
  if (!startDate || !endDate) {
    return true;
  }

  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
};

/**
 * Split a stored UTC instant back into the EAT date and time the organizer
 * originally entered, so an edit form round-trips without drifting.
 *
 * `new Date(value).toISOString()` would render the *UTC* calendar day, which
 * lands on the wrong date for any wave scheduled between midnight and 3 AM
 * Addis time.
 */
const toEatParts = (value?: string | Date | null) => {
  if (!value) return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const shifted = new Date(instant.getTime() + EAT_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
};

export const toEatDateInput = (value?: string | Date | null) =>
  toEatParts(value)?.date ?? "";

export const toEatTimeInput = (value?: string | Date | null) =>
  toEatParts(value)?.time ?? "";

const isWaveFinished = (wave: TicketType) => Number(wave.quantity || 0) <= 0;

/**
 * Which wave in a chain is live right now.
 *
 * This deliberately mirrors `resolveActiveWaveIndex` in
 * backend/src/utils/ticketAvailability.js. The forms used to each carry their
 * own slightly different copy of this rule — the admin form, for instance, never
 * handled `date_or_quantity` — and because the computed flag was posted back and
 * compared against the stored one, any disagreement was recorded as a permanent
 * manual disable. Keeping a single shared implementation is what stops that
 * class of bug from returning.
 */
export const resolveActiveWaveIndex = (
  waves: TicketType[],
  now: Date = new Date(),
) => {
  let index = 0;

  while (index < waves.length - 1) {
    const current = waves[index];
    const next = waves[index + 1];

    const nextIsTimeTriggered = (next.waveSwitchMode || "date") !== "quantity";
    const nextStart = resolveWaveStartInstant(next);
    const nextTimeReached =
      nextIsTimeTriggered && nextStart !== null && now >= nextStart;

    if (!isWaveFinished(current) && !nextTimeReached) break;

    index += 1;
  }

  return index;
};

/**
 * Recompute `isActive` across every ticket type, applying wave chains where they
 * exist and plain date/quantity rules everywhere else.
 */
export const recalculateTicketAvailability = (ticketTypes: TicketType[]) => {
  const nextTicketTypes = ticketTypes.map((ticket) => ({ ...ticket }));
  const waveGroups = groupWaveTickets(nextTicketTypes);
  const chained = new Set<TicketType>();

  Object.values(waveGroups).forEach((group) => {
    const ordered = [...group].sort(
      (a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0),
    );

    ordered.forEach((ticket) => {
      ticket.isActive = false;
      chained.add(ticket);
    });

    const activeIndex = resolveActiveWaveIndex(ordered);
    const active = ordered[activeIndex];
    if (active) {
      active.isActive = Number(active.quantity || 0) > 0;
    }
  });

  nextTicketTypes.forEach((ticket) => {
    if (chained.has(ticket)) return;

    ticket.isActive =
      ticket.hasDateRange && ticket.saleStartDate && ticket.saleEndDate
        ? isTicketActiveByDateRange(ticket.saleStartDate, ticket.saleEndDate)
        : true;
  });

  return nextTicketTypes.map(syncLegacyPriceField);
};

export const getComparableTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD" | "price">,
) => ticket.priceETB || ticket.priceUSD || ticket.price || "";

export const hasAtLeastOneTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD">,
) => Boolean(ticket.priceETB || ticket.priceUSD);

export const buildWaveDraftFromTicket = (
  ticket: TicketType,
  fallbackName: string,
): WaveDraft => ({
  id: createId(),
  name: ticket.name || fallbackName,
  priceETB: ticket.priceETB || "",
  priceUSD: ticket.priceUSD || "",
  quantity: ticket.quantity || "0",
  description: ticket.description || "",
  waveSwitchMode: ticket.waveSwitchMode || "date",
  saleStartDate: ticket.saleStartDate || "",
  saleStartTime: ticket.saleStartTime || "",
  saleEndDate: ticket.saleEndDate || "",
});

export const createDefaultWaveDraft = (seed: Partial<WaveDraft> = {}): WaveDraft => ({
  id: createId(),
  name: "Wave",
  priceETB: "",
  priceUSD: "",
  quantity: "",
  description: "",
  waveSwitchMode: "date",
  saleStartDate: "",
  saleStartTime: "",
  saleEndDate: "",
  ...seed,
});

export const formatTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD">,
) => {
  const labels: string[] = [];

  if (ticket.priceETB) {
    labels.push(`${ticket.priceETB} ETB`);
  }

  if (ticket.priceUSD) {
    labels.push(`$${ticket.priceUSD}`);
  }

  return labels.join(" / ") || "Not set";
};

export const formatDateWindow = (startDate: string, endDate: string) => {
  if (!startDate && !endDate) {
    return "No sales window";
  }

  const formatDate = (value: string) =>
    value ? new Date(value).toLocaleDateString() : "Not set";

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const formatWaveStart = (
  ticket: Pick<TicketType, "saleStartDate" | "saleStartTime">,
) => {
  if (!ticket.saleStartDate) return "";

  const [year, month, day] = ticket.saleStartDate.split("-").map(Number);
  if (!year || !month || !day) return "";

  const label = new Date(year, month - 1, day).toLocaleDateString();
  const time = (ticket.saleStartTime || "").trim();

  return time ? `${label} at ${time}` : label;
};

export const formatWaveActivationSummary = (
  ticket: Pick<
    TicketType,
    "waveOrder" | "waveSwitchMode" | "saleStartDate" | "saleStartTime"
  >,
) => {
  const waveOrder = Number(ticket.waveOrder || 0);

  if (waveOrder <= 1) {
    return "Default active wave";
  }

  if (ticket.waveSwitchMode === "quantity") {
    return "Starts when previous wave sells out";
  }

  const start = formatWaveStart(ticket);

  if (ticket.waveSwitchMode === "date_or_quantity") {
    return start
      ? `Starts ${start} or when previous wave sells out`
      : "Starts on date or when previous wave sells out";
  }

  // A dated wave also takes over early if the wave before it sells out, so the
  // sell-out half of the handoff is always worth stating.
  return start
    ? `Starts ${start}, or earlier if the previous wave sells out`
    : "Start date not set";
};
