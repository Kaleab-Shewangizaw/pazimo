require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const { calculateOrganizerBalance } = require("../services/financeService");
  const { getOwnerBalance, getPlatformTotals } = require("../services/ledgerReadService");
  const User = require("../models/User");

  const o = await User.findOne({ _id: "69850641cb2fd89bd912c0d1" }).select("_id").lean();
  const owner = { kind: "organizer", id: o._id };
  const N = 25;

  const time = async (label, fn) => {
    await fn(); // warm
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) await fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    console.log(`  ${label.padEnd(38)} ${ms.toFixed(2)} ms/call`);
    return ms;
  };

  console.log("\nBalance read, averaged over " + N + " calls\n");
  const oldMs = await time("existing (aggregate over tickets)", () =>
    calculateOrganizerBalance(o._id, "ETB"));
  const newMs = await time("ledger (projection lookup)", () =>
    getOwnerBalance(owner, "ETB"));
  await time("platform totals (ledger)", () => getPlatformTotals("ETB"));

  console.log(`\n  speedup: ${(oldMs / newMs).toFixed(1)}x faster\n`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
