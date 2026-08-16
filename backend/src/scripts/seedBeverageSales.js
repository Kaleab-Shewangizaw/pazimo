const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Event = require("../models/Event");
const EventBeverage = require("../models/EventBeverage");
const BeverageSale = require("../models/BeverageSale");
// Registered so populate() can resolve the refs declared on EventBeverage.
require("../models/Beverage");
require("../models/User");

// Development seeder: puts realistic bar sales against the beverage line-ups
// that already exist, so the admin Events tab and the organizer balance card
// have something to show.
//
// Sales go through BeverageSale.create rather than a bulk insert on purpose —
// that fires the pre-validate hook which snapshots the event's commission rate
// onto each sale, exactly as a real sale would.

const LOCAL = /^mongodb:\/\/(localhost|127\.0\.0\.1)/;

// A spread of rates so the UI shows the per-event variation rather than a
// column of identical 3%s.
const RATE_CYCLE = [0.03, 0.04, 0.025, 0.05];

const NAMES = [
  "Abebe Kebede", "Sara Tesfaye", "Dawit Haile", "Marta Girma",
  "Yonas Bekele", "Hanna Solomon", "Bereket Assefa", "Lidya Mekonnen",
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seed = async () => {
  const uri = process.env.MONGODB_URI || "";
  if (!LOCAL.test(uri) && !process.argv.includes("--i-mean-production")) {
    console.error(
      "\n  REFUSING TO SEED.\n" +
      "  MONGODB_URI does not point at localhost. This writes fake sales;\n" +
      "  running it against real data would corrupt revenue figures.\n" +
      "  Pass --i-mean-production only if you truly mean it.\n"
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n`);

  const lineups = await EventBeverage.find({ isAvailable: true })
    .populate("beverage", "name color")
    .populate("event", "title");

  if (lineups.length === 0) {
    console.log("No beverage line-ups found — nothing to seed against.");
    await mongoose.disconnect();
    return;
  }

  // Give each event a distinct bar rate so the admin table shows variation.
  const eventIds = [...new Set(lineups.map((l) => String(l.event?._id || l.event)))];
  for (let i = 0; i < eventIds.length; i++) {
    const rate = RATE_CYCLE[i % RATE_CYCLE.length];
    await Event.updateOne({ _id: eventIds[i] }, { $set: { beverageCommissionRate: rate } });
    console.log(`  event ${eventIds[i]} -> bar rate ${(rate * 100).toFixed(2)}%`);
  }
  console.log("");

  let created = 0;
  let revenue = 0;

  for (const line of lineups) {
    const remaining = Math.max((line.stockTotal || 0) - (line.sold || 0), 0);
    if (remaining === 0) {
      console.log(`  ${line.beverage?.name}: sold out already, skipping`);
      continue;
    }

    // Use at most 60% of what is left, so the line-up still looks live and the
    // seeder can be run more than once without emptying stock.
    let budget = Math.max(1, Math.floor(remaining * 0.6));
    const salesToMake = Math.min(randInt(4, 10), budget);

    for (let i = 0; i < salesToMake && budget > 0; i++) {
      const qty = Math.min(randInt(1, 3), budget);
      budget -= qty;

      // Claim the stock the same way a real sale does, so `sold` stays
      // consistent with the ledger.
      const reserved = await EventBeverage.findOneAndUpdate(
        {
          _id: line._id,
          $expr: { $gte: [{ $subtract: ["$stockTotal", "$sold"] }, qty] },
        },
        { $inc: { sold: qty } },
        { new: true }
      );
      if (!reserved) break;

      const daysAgo = randInt(0, 45);
      const soldAt = new Date(Date.now() - daysAgo * 864e5 - randInt(0, 20) * 36e5);
      const total = Math.round(reserved.price * qty * 100) / 100;

      await BeverageSale.create({
        event: line.event?._id || line.event,
        organizer: line.organizer,
        eventBeverage: line._id,
        beverage: line.beverage?._id || line.beverage,
        beverageName: line.beverage?.name || "Drink",
        beverageColor: line.beverage?.color || null,
        unitPrice: reserved.price,
        quantity: qty,
        totalAmount: total,
        currency: reserved.currency || "ETB",
        customerName: pick(NAMES),
        customerPhone: `09${randInt(10000000, 99999999)}`,
        channel: Math.random() < 0.4 ? "online" : "manual",
        soldAt,
        createdAt: soldAt,
      });

      created += 1;
      revenue += total;
    }
    console.log(`  ${line.beverage?.name} @ ${line.event?.title}: seeded`);
  }

  console.log(`\nCreated ${created} sales worth ${revenue.toLocaleString()} ETB`);

  // Show what the dashboards will report.
  const [summary] = await BeverageSale.aggregate([
    { $match: { status: "confirmed" } },
    {
      $group: {
        _id: null,
        gross: { $sum: "$totalAmount" },
        units: { $sum: "$quantity" },
        commission: {
          $sum: { $multiply: ["$totalAmount", { $ifNull: ["$commissionRate", 0.03] }] },
        },
      },
    },
  ]);
  if (summary) {
    const vat = summary.commission * 0.15;
    console.log(`\nTotals now in the database:`);
    console.log(`  gross            ${summary.gross.toLocaleString()} ETB`);
    console.log(`  units sold       ${summary.units}`);
    console.log(`  commission       ${summary.commission.toFixed(2)} ETB`);
    console.log(`  VAT on it        ${vat.toFixed(2)} ETB`);
    console.log(`  Pazimo collected ${(summary.commission + vat).toFixed(2)} ETB`);
    console.log(`  organizers keep  ${(summary.gross - summary.commission - vat).toFixed(2)} ETB`);
  }

  await mongoose.disconnect();
};

if (require.main === module) {
  seed().catch(async (error) => {
    console.error("Seed failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = seed;
