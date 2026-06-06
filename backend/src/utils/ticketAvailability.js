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

const hasStarted = (ticket, now) => {
  if (!ticket.startDate) return true;
  const start = new Date(ticket.startDate);
  if (Number.isNaN(start.getTime())) return true;
  return now >= start;
};

const hasNotEnded = (ticket, now) => {
  if (!ticket.endDate) return true;
  const end = new Date(ticket.endDate);
  if (Number.isNaN(end.getTime())) return true;
  end.setHours(23, 59, 59, 999);
  return now <= end;
};

const isWithinDateWindow = (ticket, now) =>
  hasStarted(ticket, now) && hasNotEnded(ticket, now);

const detectWaveOrder = (ticket) => {
  if (Number.isFinite(Number(ticket.waveOrder))) {
    return Number(ticket.waveOrder);
  }

  const name = (ticket.name || "").toLowerCase();
  for (const [pattern, order] of Object.entries(WAVE_NAME_ORDER)) {
    if (name.includes(pattern)) return order;
  }

  return null;
};

const isWaveTicket = (ticket) => {
  if (ticket.waveGroup || Number.isFinite(Number(ticket.waveOrder))) return true;
  return detectWaveOrder(ticket) !== null;
};

/**
 * Determine whether a wave should become active given the previous wave's state.
 * Supports triggering modes: "date", "quantity", and "date_or_quantity".
 */
const shouldActivateWave = (wave, previousWave, now) => {
  if (!wave || !previousWave) return false;
  if (toSafeNumber(wave.quantity) <= 0) return false;

  const mode = normalizeWaveMode(wave.waveSwitchMode);

  const soldOut = toSafeNumber(previousWave.quantity) <= 0;
  const dateReached = hasStarted(wave, now);

  if (mode === "quantity") {
    return soldOut;
  }

  if (mode === "date_or_quantity") {
    return dateReached || soldOut;
  }

  // Default: "date"
  return dateReached;
};

/**
 * Process a single wave group (array of tickets sorted by waveOrder).
 * Returns true if any availability changed.
 */
const applyWaveGroup = (waveTickets, now) => {
  let changed = false;

  if (waveTickets.length === 0) return changed;

  // Find the furthest wave whose trigger condition is met
  let activeWaveIndex = 0;

  for (let index = 1; index < waveTickets.length; index += 1) {
    const previousWave = waveTickets[index - 1].ticket;
    const currentWave = waveTickets[index].ticket;

    if (currentWave.manualDisabled === true) {
      continue;
    }

    if (shouldActivateWave(currentWave, previousWave, now)) {
      activeWaveIndex = index;
    }
  }

  waveTickets.forEach(({ ticket }, index) => {
    const hasQuantity = toSafeNumber(ticket.quantity) > 0;
    const shouldBeAvailable =
      ticket.manualDisabled === true
        ? false
        : index === activeWaveIndex && hasQuantity;

    if (ticket.available !== shouldBeAvailable) {
      ticket.available = shouldBeAvailable;
      changed = true;
    }
  });

  return changed;
};

const applyTicketAvailabilityRules = (event, now = new Date()) => {
  let changed = false;

  if (!event || !Array.isArray(event.ticketTypes)) {
    return { changed: false };
  }

  // Baseline availability for non-wave tickets.
  event.ticketTypes.forEach((ticket) => {
    if (isWaveTicket(ticket)) return;

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

  // Group wave tickets by waveGroup so each chain is evaluated independently.
  // Tickets that have a waveGroup are grouped by it; tickets without a waveGroup
  // but detected as wave tickets (by name pattern) form a single legacy group.
  const namedGroups = {};    // keyed by waveGroup string
  const legacyWaves = [];    // tickets with no waveGroup but detected as wave tickets

  event.ticketTypes
    .map((ticket) => ({ ticket, order: detectWaveOrder(ticket) }))
    .filter((item) => item.order !== null)
    .forEach((item) => {
      const group = (item.ticket.waveGroup || "").trim();
      if (group) {
        if (!namedGroups[group]) namedGroups[group] = [];
        namedGroups[group].push(item);
      } else {
        legacyWaves.push(item);
      }
    });

  // Process each named group independently
  for (const groupItems of Object.values(namedGroups)) {
    const sorted = [...groupItems].sort((a, b) => a.order - b.order);
    if (applyWaveGroup(sorted, now)) changed = true;
  }

  // Process legacy (unnamed) wave tickets as a single group
  if (legacyWaves.length > 0) {
    const sorted = [...legacyWaves].sort((a, b) => a.order - b.order);
    if (applyWaveGroup(sorted, now)) changed = true;
  }

  return { changed };
};

module.exports = {
  applyTicketAvailabilityRules,
};
