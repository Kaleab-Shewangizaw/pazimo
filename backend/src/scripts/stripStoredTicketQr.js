const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Strips the stored `qrCode` blob from ticket documents.
//
// These were base64 data URIs averaging ~54 KB — 99% of the document — because
// the 26 KB Pazimo logo was base64'd into an SVG and the whole SVG base64'd
// again, once per ticket. QR images are now rendered on demand by
// utils/qrRenderer.js and served from GET /api/tickets/:ticketId/qr.svg, so the
// stored copy is dead weight.
//
// Safe: it only $unsets one presentational field. It touches no money, no
// status, and no relationship. The image is fully reproducible from fields that
// remain on the document.
//
// Run with --dry to see the numbers without writing.

const DRY = process.argv.includes("--dry");
const BATCH = 500;

// This script rewrites every ticket in the database. Running it against
// production by accident — via a stale MONGODB_URI, which has happened here
// before — is not something to leave to attention. Require an explicit opt-in.
const assertTargetIsIntentional = (uri) => {
  const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(uri);
  if (isLocal) return;

  if (!process.argv.includes("--i-mean-production")) {
    console.error(
      "\n  REFUSING TO RUN.\n" +
        `  MONGODB_URI points at a remote host, not localhost.\n` +
        "  Re-run with --i-mean-production if that is genuinely what you want.\n"
    );
    process.exit(1);
  }
  console.warn("\n  ⚠  Running against a REMOTE database by explicit request.\n");
};

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  assertTargetIsIntentional(uri);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection;
  console.log(`Connected to database "${db.name}"`);

  const tickets = db.collection("tickets");
  const filter = { qrCode: { $exists: true } };

  const [stats] = await tickets
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          bytes: { $sum: { $strLenBytes: { $ifNull: ["$qrCode", ""] } } },
        },
      },
    ])
    .toArray();

  if (!stats || stats.n === 0) {
    console.log("No tickets carry a stored qrCode — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const mb = (stats.bytes / 1048576).toFixed(1);
  console.log(`${stats.n} tickets carry a qrCode, totalling ${mb} MB`);
  console.log(`average ${Math.round(stats.bytes / stats.n)} bytes per ticket`);

  if (DRY) {
    console.log("\n--dry given — nothing written.");
    await mongoose.disconnect();
    return;
  }

  // Batched rather than one giant updateMany so progress is visible and the
  // oplog does not take the whole rewrite in a single hit.
  let cleared = 0;
  for (;;) {
    const batch = await tickets
      .find(filter, { projection: { _id: 1 } })
      .limit(BATCH)
      .toArray();
    if (batch.length === 0) break;

    const result = await tickets.updateMany(
      { _id: { $in: batch.map((d) => d._id) } },
      { $unset: { qrCode: "" } }
    );
    cleared += result.modifiedCount;
    process.stdout.write(`\r  cleared ${cleared}/${stats.n}`);
  }

  console.log(`\n\nDone. Reclaimed ~${mb} MB.`);
  console.log("Run `db.tickets.compact()` or resync to return the space to disk.");
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error("\nFailed:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = run;
