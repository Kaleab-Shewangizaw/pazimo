const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const { detectWaveOrder } = require("../utils/ticketAvailability");

// One-off migration: collapse the old flat-sibling wave format (each wave a
// separate Event.ticketTypes entry, linked by a shared waveGroup) into the
// new single-entry format (one ticketTypes entry per logical ticket type,
// carrying a nested `waves` array that it mutates through in place).
//
// Not required for correctness — ticketAvailability.js keeps a legacy code
// path that still walks the old flat-sibling chain, so an unmigrated event
// keeps selling and transitioning waves correctly. This is a cleanup pass:
// it gives already-published events the same "one ticket type" identity
// (and, in turn, correct sales history bucketing) that new wave chains get
// automatically. It is also redundant for any event an organizer re-saves
// through the edit form, since that path self-migrates on save.
//
// Defaults to --dry-run (log only). Pass --apply to actually write changes.
// Safe to re-run: an event with no waveGroup siblings left is a no-op.
const DRY_RUN = !process.argv.includes("--apply");

const buildWaveEntry = (ticket, isFirstWave) => ({
  name: ticket.name,
  price: ticket.price,
  priceETB: ticket.priceETB,
  priceUSD: ticket.priceUSD,
  quantity: ticket.quantity,
  description: ticket.description,
  startDate: isFirstWave ? undefined : ticket.startDate,
  endDate: ticket.endDate,
  waveSwitchMode: ticket.waveSwitchMode || "date",
});

const migrateEvent = (event) => {
  const groups = new Map();

  event.ticketTypes.forEach((ticket) => {
    if (Array.isArray(ticket.waves) && ticket.waves.length > 0) return; // already migrated
    const group = String(ticket.waveGroup || "").trim();
    if (!group) return;
    if (detectWaveOrder(ticket) === null) return;

    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(ticket);
  });

  // A "chain" of one is just a mislabeled ordinary ticket type — leave it.
  const chains = [...groups.entries()].filter(([, members]) => members.length > 1);
  if (chains.length === 0) return { changed: false, renamedTicketTypes: [] };

  const renamedTicketTypes = [];

  chains.forEach(([group, members]) => {
    const ordered = [...members].sort(
      (a, b) => (detectWaveOrder(a) || 0) - (detectWaveOrder(b) || 0)
    );

    const activeSibling = ordered.find((t) => t.available === true) || ordered[0];
    const activeIndex = ordered.indexOf(activeSibling);

    const waves = ordered.map((ticket, index) => buildWaveEntry(ticket, index === 0));

    const parent = ordered[0];
    parent.name = activeSibling.name;
    parent.price = activeSibling.price;
    parent.priceETB = activeSibling.priceETB;
    parent.priceUSD = activeSibling.priceUSD;
    parent.quantity = activeSibling.quantity;
    parent.description = activeSibling.description;
    parent.available = activeSibling.available;
    parent.startDate = activeIndex === 0 ? undefined : activeSibling.startDate;
    parent.endDate = activeSibling.endDate;
    parent.waves = waves;
    parent.currentWaveIndex = activeIndex;

    // Every sibling's original name is now folded into `waves` — historical
    // tickets sold under any of them should point their ticketTypeId at the
    // one surviving parent, since that is the only subdocument left that can
    // ever be credited by a future refund.
    ordered.forEach((ticket) => {
      renamedTicketTypes.push({ name: ticket.name, parentId: parent._id });
    });

    const idsToRemove = new Set(
      ordered.slice(1).map((ticket) => String(ticket._id))
    );
    event.ticketTypes = event.ticketTypes.filter(
      (ticket) => !idsToRemove.has(String(ticket._id))
    );

    console.log(
      `  event ${event._id}: collapsed waveGroup "${group}" (${ordered.length} entries) into ticketType ${parent._id} ("${parent.name}")`
    );
  });

  return { changed: true, renamedTicketTypes };
};

const migrateWaveTicketTypes = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn("MONGODB_URI is not defined in .env, please pass it as env var");
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Connected to MongoDB");
    console.log(DRY_RUN ? "Mode: DRY RUN (pass --apply to write changes)" : "Mode: APPLY");

    const events = await Event.find({
      "ticketTypes.waveGroup": { $exists: true, $nin: [null, ""] },
    });

    console.log(`Found ${events.length} event(s) with waveGroup ticket types`);

    let migratedEvents = 0;
    let ticketsBackfilled = 0;

    for (const event of events) {
      const { changed, renamedTicketTypes } = migrateEvent(event);
      if (!changed) continue;

      migratedEvents += 1;

      for (const { name, parentId } of renamedTicketTypes) {
        const filter = { event: event._id, ticketType: name, ticketTypeId: { $exists: false } };
        if (DRY_RUN) {
          const count = await Ticket.countDocuments(filter);
          ticketsBackfilled += count;
        } else {
          const result = await Ticket.updateMany(filter, { $set: { ticketTypeId: parentId } });
          ticketsBackfilled += result.modifiedCount;
        }
      }

      if (!DRY_RUN) {
        await event.save();
      }
    }

    console.log(
      `${DRY_RUN ? "Would migrate" : "Migrated"} ${migratedEvents} event(s), ` +
        `${DRY_RUN ? "would backfill" : "backfilled"} ${ticketsBackfilled} historical ticket(s) with ticketTypeId`
    );

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrateWaveTicketTypes();
