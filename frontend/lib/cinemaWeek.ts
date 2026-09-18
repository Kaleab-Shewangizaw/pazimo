// Pure date helpers shared by every week-at-a-glance view on the cinema
// dashboard (Schedule, Tickets) — kept in one place so "what week does this
// date fall in" can't drift between them.

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const addDays = (dateKey: string, n: number) => {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** Monday of the week containing `dateKey` (Sunday rolls back 6 days, not 0). */
export const mondayOf = (dateKey: string) => {
  const d = new Date(`${dateKey}T00:00:00`);
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateKey, diff);
};
