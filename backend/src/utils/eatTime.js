// Africa/Addis_Ababa is a fixed UTC+3 offset year-round (no DST) — safe to
// hardcode rather than pull in a timezone library, matching the assumption
// platformFeeService.js already makes for the daily fee rollup.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse an "HH:MM" (or "HH:MM:SS") wall-clock string into milliseconds past
 * midnight. Returns null for anything unparseable so callers can fall back to
 * midnight rather than silently producing an Invalid Date.
 */
const parseTimeOfDayMs = (value) => {
  if (typeof value !== "string") return null;

  const match = value.trim().match(TIME_OF_DAY_PATTERN);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
};

/**
 * Combine an organizer-entered date and time-of-day into the real UTC instant
 * they meant.
 *
 * Organizers type wall-clock Ethiopian time ("August 19 at 8:00 PM"), but the
 * API server may run in any timezone, so the wall clock has to be anchored to
 * EAT explicitly. A bare "YYYY-MM-DD" would otherwise be parsed by `new Date()`
 * as UTC midnight — 3:00 AM EAT — which is why date-only wave transitions used
 * to fire three hours late.
 *
 * Values that already carry an explicit time (a full ISO string, or a Date) are
 * treated as real instants and returned unchanged; only bare calendar dates get
 * the EAT interpretation.
 */
const resolveEatInstant = (dateValue, timeValue) => {
  if (dateValue === undefined || dateValue === null || dateValue === "") {
    return undefined;
  }

  const timeOfDayMs = parseTimeOfDayMs(timeValue);

  if (typeof dateValue === "string" && DATE_ONLY_PATTERN.test(dateValue.trim())) {
    const [year, month, day] = dateValue.trim().split("-").map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day);
    return new Date(utcMidnight + (timeOfDayMs || 0) - EAT_OFFSET_MS);
  }

  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return undefined;

  // An explicit time-of-day was supplied alongside a full timestamp (e.g. an
  // edit form round-tripping a stored instant plus a changed time field): keep
  // the EAT calendar day of the stored instant and re-apply the new wall clock.
  if (timeOfDayMs !== null) {
    const eatShifted = new Date(parsed.getTime() + EAT_OFFSET_MS);
    const dayStartUtc = Date.UTC(
      eatShifted.getUTCFullYear(),
      eatShifted.getUTCMonth(),
      eatShifted.getUTCDate()
    );
    return new Date(dayStartUtc + timeOfDayMs - EAT_OFFSET_MS);
  }

  return parsed;
};

/** "YYYY-MM-DD" for the EAT calendar day containing `instant`. */
const toEatDateKey = (instant) => {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
};

/** "HH:MM" wall-clock EAT time for `instant`. */
const toEatTimeOfDay = (instant) => {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + EAT_OFFSET_MS).toISOString().slice(11, 16);
};

/** Last millisecond of the EAT calendar day containing `instant`. */
const endOfEatDay = (instant) => {
  const dateKey = toEatDateKey(instant);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - EAT_OFFSET_MS + 86400000 - 1);
};

module.exports = {
  EAT_OFFSET_MS,
  parseTimeOfDayMs,
  resolveEatInstant,
  toEatDateKey,
  toEatTimeOfDay,
  endOfEatDay,
};
