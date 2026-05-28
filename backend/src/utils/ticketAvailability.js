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

const endOfDay = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const hasStarted = (ticket, now) => {
  if (!ticket.startDate) return true;
  const start = new Date(ticket.startDate);
  if (Number.isNaN(start.getTime())) return true;
  return now >= start;
};

const hasNotEnded = (ticket, now) => {
  if (!ticket.endDate) return true;
  const end = endOfDay(ticket.endDate);
  if (!end) return true;
  return now <= end;
};

const isWithinDateWindow = (ticket, now) => hasStarted(ticket, now) && hasNotEnded(ticket, now);

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

const shouldSwitchWave = (ticket, now) => {
  const mode = normalizeWaveMode(ticket.waveSwitchMode);
  const soldOut = toSafeNumber(ticket.quantity) <= 0;
  const ended = !!ticket.endDate && !hasNotEnded(ticket, now);

  if (mode === "quantity") return { shouldSwitch: soldOut, reason: soldOut ? "quantity" : null };
  if (mode === "date") return { shouldSwitch: ended, reason: ended ? "date" : null };

  if (soldOut) return { shouldSwitch: true, reason: "quantity" };
  if (ended) return { shouldSwitch: true, reason: "date" };
  return { shouldSwitch: false, reason: null };
};

const canActivateNextWave = (nextWave, now, triggerReason) => {
  if (toSafeNumber(nextWave.quantity) <= 0) return false;

  // Quantity-triggered switches may activate the next wave immediately.
  if (triggerReason === "quantity") {
    return hasNotEnded(nextWave, now);
  }

  return isWithinDateWindow(nextWave, now);
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

  const waveTickets = event.ticketTypes
    .map((ticket) => ({ ticket, order: detectWaveOrder(ticket) }))
    .filter((item) => item.order !== null)
    .sort((a, b) => a.order - b.order);

  // First pass keeps current wave active state coherent with date windows and quantity.
  waveTickets.forEach(({ ticket }) => {
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

  if (waveTickets.length < 2) {
    return { changed };
  }

  // Transition pass: previous wave can unlock next by date or quantity.
  for (let i = 0; i < waveTickets.length - 1; i++) {
    const current = waveTickets[i].ticket;
    const next = waveTickets[i + 1].ticket;

    const { shouldSwitch, reason } = shouldSwitchWave(current, now);
    if (!shouldSwitch) continue;

    if (current.available !== false) {
      current.available = false;
      changed = true;
    }

    const shouldActivateNext =
      next.manualDisabled === true
        ? false
        : canActivateNextWave(next, now, reason);
    if (next.available !== shouldActivateNext) {
      next.available = shouldActivateNext;
      changed = true;
    }
  }

  // Ensure only the latest active wave stays visible.
  let latestActiveIndex = -1;
  for (let i = waveTickets.length - 1; i >= 0; i--) {
    const wave = waveTickets[i].ticket;
    if (wave.manualDisabled === true) {
      continue;
    }
    if (wave.available === true && toSafeNumber(wave.quantity) > 0) {
      latestActiveIndex = i;
      break;
    }
  }

  if (latestActiveIndex > 0) {
    for (let i = 0; i < latestActiveIndex; i++) {
      if (waveTickets[i].ticket.available !== false) {
        waveTickets[i].ticket.available = false;
        changed = true;
      }
    }
  }

  return { changed };
};

module.exports = {
  applyTicketAvailabilityRules,
};
