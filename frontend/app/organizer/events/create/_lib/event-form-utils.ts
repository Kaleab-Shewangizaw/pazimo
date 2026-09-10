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

// A wave-enabled ticket type owns its own chain via `waves` — it is never
// spread across sibling ticketTypes entries, so there is no more "child
// ticket" concept to filter out and no waveGroup to scan siblings by.
export const isWaveTicket = (ticket: TicketType) =>
  Boolean(ticket.waves && ticket.waves.length > 0);

export const getVisibleTicketEntries = (
  ticketTypes: TicketType[],
): VisibleTicketEntry[] => ticketTypes.map((ticket, index) => ({ ticket, index }));

export const getWaveParentTickets = (ticketTypes: TicketType[]) =>
  ticketTypes.filter(isWaveTicket);

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

// Same wave-name fallback the backend's legacy path uses (see WAVE_NAME_ORDER
// in backend/src/utils/ticketAvailability.js) — only needed here to recognize
// an old flat-sibling chain while loading an event into the edit form.
const LEGACY_WAVE_NAME_ORDER: Record<string, number> = {
  "first wave": 1,
  "second wave": 2,
  "third wave": 3,
  "final wave": 99,
};

const legacyWaveOrderOf = (ticket: any): number | null => {
  const explicit = Number(ticket.waveOrder);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const name = String(ticket.name || "").toLowerCase();
  for (const [pattern, order] of Object.entries(LEGACY_WAVE_NAME_ORDER)) {
    if (name.includes(pattern)) return order;
  }
  return null;
};

/**
 * Map the raw ticketTypes array an event API response returns into the
 * form's in-memory shape. Handles both the current nested-wave format
 * (`ticket.waves`, mapped straight through) and the older flat-sibling
 * format (waves scattered as separate ticketTypes entries sharing a
 * `waveGroup`, folded back into one chain here so editing and re-saving an
 * old event upgrades it). A legacy chain identified purely by name (no
 * `waveGroup`, e.g. two tickets literally named "First Wave"/"Second Wave")
 * is left as plain, separately-editable ticket types rather than folded —
 * a rare pre-waveGroup case not worth the extra detection logic here.
 */
export const mapApiTicketTypesToFormTickets = (
  apiTicketTypes: any[] | undefined,
): TicketType[] => {
  if (!apiTicketTypes || apiTicketTypes.length === 0) return [];

  const toWaveDraft = (wave: any): WaveDraft => ({
    id: createId(),
    name: wave.name || "",
    priceETB: wave.priceETB?.toString() || "",
    priceUSD: wave.priceUSD?.toString() || "",
    quantity: wave.quantity?.toString() || "0",
    description: wave.description || "",
    waveSwitchMode: wave.waveSwitchMode || "date",
    saleStartDate: toEatDateInput(wave.startDate),
    saleStartTime: toEatTimeInput(wave.startDate),
    saleEndDate: toEatDateInput(wave.endDate),
  });

  const toFormTicket = (ticket: any, waves?: WaveDraft[]): TicketType => ({
    _id: ticket._id,
    name: ticket.name || "Regular",
    price: ticket.price?.toString() || "",
    priceETB: ticket.priceETB?.toString() || "",
    priceUSD: ticket.priceUSD?.toString() || "",
    quantity: ticket.quantity?.toString() || "",
    description: ticket.description || "",
    saleStartDate: toEatDateInput(ticket.startDate),
    saleStartTime: toEatTimeInput(ticket.startDate),
    saleEndDate: toEatDateInput(ticket.endDate),
    isActive: ticket.available !== undefined ? ticket.available : true,
    hasDateRange: !!(ticket.startDate && ticket.endDate),
    ...(waves && waves.length > 0 ? { waves } : {}),
  });

  const legacyGroupOf = new Map<any, string>();
  const legacyGroups = new Map<string, any[]>();

  apiTicketTypes.forEach((ticket) => {
    if (Array.isArray(ticket.waves) && ticket.waves.length > 0) return;
    if (legacyWaveOrderOf(ticket) === null) return;

    const group = String(ticket.waveGroup || "").trim();
    if (!group) return;

    legacyGroupOf.set(ticket, group);
    if (!legacyGroups.has(group)) legacyGroups.set(group, []);
    legacyGroups.get(group)!.push(ticket);
  });

  const emittedGroups = new Set<string>();
  const result: TicketType[] = [];

  apiTicketTypes.forEach((ticket) => {
    if (Array.isArray(ticket.waves) && ticket.waves.length > 0) {
      result.push(toFormTicket(ticket, ticket.waves.map(toWaveDraft)));
      return;
    }

    const group = legacyGroupOf.get(ticket);
    if (group) {
      if (emittedGroups.has(group)) return;
      emittedGroups.add(group);

      const chain = [...legacyGroups.get(group)!].sort(
        (a, b) => (legacyWaveOrderOf(a) || 0) - (legacyWaveOrderOf(b) || 0),
      );
      const waves = chain.map(toWaveDraft);
      result.push(toFormTicket(chain[0], chain.length > 1 ? waves : undefined));
      return;
    }

    result.push(toFormTicket(ticket));
  });

  return result;
};

const isWaveFinished = (wave: WaveDraft) => Number(wave.quantity || 0) <= 0;

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
 *
 * This is a client-side PREVIEW only — the server always recomputes which
 * wave is actually live (and mirrors its fields) on save, so a disagreement
 * here can never corrupt real sale state, only momentarily mislabel the form.
 */
export const resolveActiveWaveIndex = (
  waves: WaveDraft[],
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
 * Recompute each ticket type's preview state: for a wave-enabled ticket type,
 * mirror whichever wave should be live right now onto its own display fields
 * (name/price/quantity), matching what the server will do on save; for a
 * plain ticket type, apply the ordinary date/quantity `isActive` rule.
 */
export const recalculateTicketAvailability = (ticketTypes: TicketType[]) => {
  const nextTicketTypes = ticketTypes.map((ticket) => ({ ...ticket }));

  nextTicketTypes.forEach((ticket) => {
    if (ticket.waves && ticket.waves.length > 0) {
      const activeIndex = resolveActiveWaveIndex(ticket.waves);
      const active = ticket.waves[activeIndex];

      if (active) {
        ticket.name = active.name;
        ticket.priceETB = active.priceETB;
        ticket.priceUSD = active.priceUSD;
        ticket.quantity = active.quantity;
        ticket.description = active.description;
        ticket.isActive = Number(active.quantity || 0) > 0;
      }
      return;
    }

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

/**
 * The wire shape one ticket type is submitted as, shared by the create page
 * and both edit pages so they can never again drift into disagreeing about
 * what a wave chain looks like on the way to the server (the exact class of
 * bug that used to make the admin form silently misread organizer edits).
 * Mirrors `normalizeTicketTypes`/`normalizeWaveEntry` in
 * backend/src/controllers/eventController.js.
 */
export const serializeTicketTypeForSubmit = (ticket: TicketType) => {
  const hasWaves = Boolean(ticket.waves && ticket.waves.length > 0);

  return {
    ...(ticket._id ? { _id: ticket._id } : {}),
    name: ticket.name,
    price: Number.parseFloat(ticket.priceETB || ticket.priceUSD || "0"),
    priceETB: ticket.priceETB ? Number.parseFloat(ticket.priceETB) : undefined,
    priceUSD: ticket.priceUSD ? Number.parseFloat(ticket.priceUSD) : undefined,
    quantity: Number.parseInt(ticket.quantity, 10),
    description: ticket.description,
    available: ticket.isActive,
    ...(hasWaves
      ? {
          waves: ticket.waves!.map((wave, index) => ({
            name: wave.name,
            price: Number.parseFloat(wave.priceETB || wave.priceUSD || "0"),
            priceETB: wave.priceETB ? Number.parseFloat(wave.priceETB) : undefined,
            priceUSD: wave.priceUSD ? Number.parseFloat(wave.priceUSD) : undefined,
            quantity: Number.parseInt(wave.quantity || "0", 10),
            description: wave.description,
            waveSwitchMode: wave.waveSwitchMode || "date",
            // Wave 1 is always immediately live and never has a start
            // trigger; every later wave sends its date split as separate
            // date/time so the server anchors the wall clock to Addis time
            // instead of parsing a bare date as UTC midnight.
            ...(index > 0 && wave.saleStartDate
              ? { startDate: wave.saleStartDate, startTime: wave.saleStartTime || "00:00" }
              : {}),
            ...(wave.saleEndDate ? { endDate: wave.saleEndDate } : {}),
          })),
        }
      : {}),
    ...(!hasWaves && ticket.hasDateRange && ticket.saleStartDate && ticket.saleEndDate
      ? {
          startDate: ticket.saleStartDate,
          endDate: ticket.saleEndDate,
        }
      : {}),
  };
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
  wave: Pick<WaveDraft, "saleStartDate" | "saleStartTime">,
) => {
  if (!wave.saleStartDate) return "";

  const [year, month, day] = wave.saleStartDate.split("-").map(Number);
  if (!year || !month || !day) return "";

  const label = new Date(year, month - 1, day).toLocaleDateString();
  const time = (wave.saleStartTime || "").trim();

  return time ? `${label} at ${time}` : label;
};

// `index` is this wave's position in its own ticket type's `waves` array —
// order is now positional, not a stored `waveOrder` number.
export const formatWaveActivationSummary = (
  wave: Pick<WaveDraft, "waveSwitchMode" | "saleStartDate" | "saleStartTime">,
  index: number,
) => {
  if (index <= 0) {
    return "Default active wave";
  }

  if (wave.waveSwitchMode === "quantity") {
    return "Starts when previous wave sells out";
  }

  const start = formatWaveStart(wave);

  if (wave.waveSwitchMode === "date_or_quantity") {
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
