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

const shouldActivateWave = (wave, previousWave, now) => {
  if (!wave || !previousWave) return false;
  if (toSafeNumber(wave.quantity) <= 0) return false;

  const mode = normalizeWaveMode(wave.waveSwitchMode);

  if (mode === "quantity") {
    return toSafeNumber(previousWave.quantity) <= 0;
  }

  return hasStarted(wave, now);
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

  waveTickets.forEach(({ ticket }, index) => {
    if (ticket.manualDisabled === true) {
      if (ticket.available !== false) {
        ticket.available = false;
        changed = true;
      }
      return;
    }

    const hasQuantity = toSafeNumber(ticket.quantity) > 0;
    const shouldBeAvailable =
      index === 0 ? hasQuantity : false;

    if (ticket.available !== shouldBeAvailable) {
      ticket.available = shouldBeAvailable;
      changed = true;
    }
  });

  if (waveTickets.length < 2) {
    return { changed };
  }

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
      ticket.manualDisabled === true ? false : index === activeWaveIndex && hasQuantity;

    if (ticket.available !== shouldBeAvailable) {
      ticket.available = shouldBeAvailable;
      changed = true;
    }
  });

  if (activeWaveIndex > 0) {
    for (let index = 0; index < activeWaveIndex; index += 1) {
      if (waveTickets[index].ticket.available !== false) {
        waveTickets[index].ticket.available = false;
        changed = true;
      }
    }
  }

  return { changed };
};

module.exports = {
  applyTicketAvailabilityRules,
};
