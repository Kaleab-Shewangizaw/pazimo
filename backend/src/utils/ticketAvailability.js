const { endOfEatDay } = require("./eatTime");

// Legacy events (created before waveGroup/waveOrder existed) encoded the wave
// sequence in the ticket name alone. Still honored so those events keep working.
const WAVE_NAME_ORDER = {
  "first wave": 1,
  "second wave": 2,
  "third wave": 3,
  "final wave": 99,
};

const normalizeWaveMode = (modeValue) => {
  const mode = (modeValue || "date").toLowerCase();
  if (mode === "by_time") return "date";
  if (mode === "by_sold_out") return "quantity";
  if (mode === "by_time_or_sold_out") return "date_or_quantity";
  if (["date", "quantity", "date_or_quantity"].includes(mode)) return mode;
  return "date";
};

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * A wave order is only meaningful as a positive integer.
 *
 * `Number(null)` and `Number("")` are both 0 — and 0 is finite — so the old
 * `Number.isFinite(Number(ticket.waveOrder))` check silently promoted ordinary
 * ticket types carrying a null/empty waveOrder into a phantom "wave 0" chain,
 * where every sibling but one was then force-disabled.
 */
const toWaveOrder = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * The real UTC instant a wave is scheduled to take over, or null when the
 * organizer configured no time trigger.
 *
 * Returning null for "no start date" is the crux of the old bug: the previous
 * implementation treated a missing start date as "already started", so in a
 * date-mode chain every undated wave fired immediately and the *last* wave went
 * live the moment the event was created.
 */
const getWaveStartInstant = (ticket) => {
  if (!ticket || !ticket.startDate) return null;
  const instant = new Date(ticket.startDate);
  return Number.isNaN(instant.getTime()) ? null : instant;
};

const hasWaveStartArrived = (ticket, now) => {
  const instant = getWaveStartInstant(ticket);
  return instant !== null && now >= instant;
};

const hasStarted = (ticket, now) => {
  const instant = getWaveStartInstant(ticket);
  if (instant === null) return true;
  return now >= instant;
};

const hasNotEnded = (ticket, now) => {
  if (!ticket.endDate) return true;
  const end = new Date(ticket.endDate);
  if (Number.isNaN(end.getTime())) return true;

  // A bare calendar date is stored as UTC midnight and means "through the end of
  // that day in Addis". The old code called `end.setHours(23, 59, 59, 999)`,
  // which resolves against the *server's* timezone — on a UTC host that closed
  // sales at 3:00 AM EAT the following day.
  const isDateOnly = end.getTime() % 86400000 === 0;
  const closesAt = isDateOnly ? endOfEatDay(end) : end;
  return now <= closesAt;
};

const isWithinDateWindow = (ticket, now) =>
  hasStarted(ticket, now) && hasNotEnded(ticket, now);

const detectWaveOrder = (ticket) => {
  const explicit = toWaveOrder(ticket.waveOrder);
  if (explicit !== null) return explicit;

  const name = (ticket.name || "").toLowerCase();
  for (const [pattern, order] of Object.entries(WAVE_NAME_ORDER)) {
    if (name.includes(pattern)) return order;
  }

  return null;
};

const isWaveTicket = (ticket) => detectWaveOrder(ticket) !== null;

/**
 * A wave is finished once it can no longer be sold: the organizer disabled it,
 * or its allocation is gone. Successful sales are what drive `quantity` down,
 * so this is inherently sale-driven — a failed or abandoned checkout never
 * decrements stock and therefore never advances the chain.
 */
const isWaveFinished = (wave) =>
  wave.manualDisabled === true || toSafeNumber(wave.quantity) <= 0;

/**
 * Walk the chain forward one wave at a time and return the index that should be
 * live right now.
 *
 * Two things end a wave's turn:
 *   - it is finished (sold out, or manually disabled), or
 *   - the *next* wave's scheduled start instant has arrived.
 *
 * Advancing strictly one step per iteration is what keeps transitions
 * sequential: wave 1 -> wave 2 -> wave 3, never 1 -> 3. A later wave whose
 * start time has already passed is only reached after the chain has walked
 * through the waves in front of it, and a disabled wave is stepped over rather
 * than dead-ending the chain behind it.
 */
const resolveActiveWaveIndex = (waves, now) => {
  let index = 0;

  while (index < waves.length - 1) {
    const current = waves[index];
    const next = waves[index + 1];

    // A wave configured to hand off purely on sell-out carries no start
    // instant; only its predecessor running out moves the chain along.
    const nextIsTimeTriggered =
      normalizeWaveMode(next.waveSwitchMode) !== "quantity";
    const nextTimeReached =
      nextIsTimeTriggered && hasWaveStartArrived(next, now);

    if (!isWaveFinished(current) && !nextTimeReached) break;

    index += 1;
  }

  return index;
};

/**
 * Process a single wave chain (array of tickets sorted by waveOrder).
 * Returns true if any availability changed.
 */
const applyWaveGroup = (waveTickets, now) => {
  let changed = false;

  if (waveTickets.length === 0) return changed;

  const waves = waveTickets.map(({ ticket }) => ticket);
  const activeWaveIndex = resolveActiveWaveIndex(waves, now);

  waves.forEach((ticket, index) => {
    const shouldBeAvailable =
      index === activeWaveIndex &&
      ticket.manualDisabled !== true &&
      toSafeNumber(ticket.quantity) > 0;

    if (ticket.available !== shouldBeAvailable) {
      ticket.available = shouldBeAvailable;
      changed = true;
    }
  });

  return changed;
};

/**
 * Order a chain by waveOrder, keeping the stored order stable for ties so a
 * duplicated waveOrder can never reshuffle a chain between evaluations.
 */
const sortWaveChain = (items) =>
  [...items].sort((a, b) => a.order - b.order || a.position - b.position);

const applyTicketAvailabilityRules = (event, now = new Date()) => {
  let changed = false;

  if (!event || !Array.isArray(event.ticketTypes)) {
    return { changed: false };
  }

  // Group wave tickets by waveGroup so each ticket type's chain is evaluated
  // independently — "Regular" waves must never interact with "VIP" waves.
  const namedGroups = new Map();
  const legacyWaves = [];

  event.ticketTypes.forEach((ticket, position) => {
    const order = detectWaveOrder(ticket);
    if (order === null) return;

    const group = String(ticket.waveGroup || "").trim();
    const item = { ticket, order, position };

    if (group) {
      if (!namedGroups.has(group)) namedGroups.set(group, []);
      namedGroups.get(group).push(item);
    } else {
      legacyWaves.push(item);
    }
  });

  const chains = [...namedGroups.values()];

  // Legacy name-detected waves only form a chain when there are at least two of
  // them and the event uses no explicit waveGroups. A lone ticket that merely
  // happens to mention "final wave" in its name is left alone rather than being
  // conscripted into a chain alongside unrelated ticket types.
  if (legacyWaves.length > 1 && namedGroups.size === 0) {
    chains.push(legacyWaves);
  }

  // Anything not actually governed by a chain — including a wave-named ticket
  // that turned out to stand alone — falls back to the ordinary date/quantity
  // rules rather than dropping through both branches and keeping a stale flag.
  const chainManaged = new Set();
  chains.forEach((items) => items.forEach(({ ticket }) => chainManaged.add(ticket)));

  event.ticketTypes.forEach((ticket) => {
    if (chainManaged.has(ticket)) return;

    if (ticket.manualDisabled === true) {
      if (ticket.available !== false) {
        ticket.available = false;
        changed = true;
      }
      return;
    }

    const hasQuantity = toSafeNumber(ticket.quantity) > 0;
    const shouldBeAvailable = hasQuantity && isWithinDateWindow(ticket, now);

    if (ticket.available !== shouldBeAvailable) {
      ticket.available = shouldBeAvailable;
      changed = true;
    }
  });

  chains.forEach((items) => {
    if (applyWaveGroup(sortWaveChain(items), now)) changed = true;
  });

  return { changed };
};

/**
 * The wave a customer should currently see and pay for within a ticket type's
 * chain. Single source of truth for "which wave is live" so pricing, display
 * and checkout can never disagree with the availability flags.
 */
const getActiveWave = (event, waveGroup, now = new Date()) => {
  if (!event || !Array.isArray(event.ticketTypes)) return null;

  const group = String(waveGroup || "").trim();
  if (!group) return null;

  const items = [];
  event.ticketTypes.forEach((ticket, position) => {
    const order = detectWaveOrder(ticket);
    if (order === null) return;
    if (String(ticket.waveGroup || "").trim() !== group) return;
    items.push({ ticket, order, position });
  });

  if (items.length === 0) return null;

  const waves = sortWaveChain(items).map(({ ticket }) => ticket);
  return waves[resolveActiveWaveIndex(waves, now)] || null;
};

module.exports = {
  applyTicketAvailabilityRules,
  getActiveWave,
  getWaveStartInstant,
  detectWaveOrder,
  isWaveTicket,
  normalizeWaveMode,
};
