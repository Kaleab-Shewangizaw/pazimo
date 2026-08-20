const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const execFileAsync = promisify(execFile);

/**
 * Take a local copy of production to test against.
 *
 * WHY THIS EXISTS AS A SCRIPT
 *
 * Testing against real data is the only way to find the things fixtures never
 * produce — the row written before a field existed, the null nobody expected,
 * the collection that is 99% one field. But a shell full of connection strings
 * is exactly how a "read-only check" becomes a write to production. So the
 * rules are in code, where they hold every time:
 *
 *   1. THE SOURCE IS ONLY EVER READ. mongodump is the only thing pointed at it.
 *      No code path here writes to the source, whatever flags are passed.
 *   2. THE TARGET MUST BE LOCAL. A remote target is refused outright — that is
 *      the mistake that would restore a stale copy over the live database.
 *   3. THE TARGET IS NEVER `test`. Production's database is called `test`, and
 *      so is the local development one. Restoring "the same name" would silently
 *      destroy local work. The copy lands in its own database.
 *   4. DRY RUN BY DEFAULT. The first run reports what it would copy and how big
 *      it is, and writes nothing.
 *
 * The source URI comes from the environment, never an argument, so it does not
 * land in shell history or in `ps` output.
 *
 *   PROD_READONLY_URI='mongodb+srv://…' npm run clone:prod
 *   PROD_READONLY_URI='mongodb+srv://…' npm run clone:prod -- --write
 *
 * Options:
 *   --write            actually dump and restore
 *   --target=NAME      local database to restore into (default pazimo_prod_copy)
 *   --keep-dump        leave the BSON dump on disk instead of deleting it
 *   --collections=a,b  copy only these collections
 */

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const KEEP_DUMP = args.includes("--keep-dump");

const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const TARGET_DB = argValue("target", "pazimo_prod_copy");
const ONLY = argValue("collections", "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

// The local server the copy lands on. Deliberately not taken from MONGODB_URI:
// that variable is whatever the app is currently pointed at, and if someone had
// pointed it at production this would restore ONTO production.
const LOCAL_HOST = "mongodb://127.0.0.1:27017";

const redact = (uri) => String(uri).replace(/(:\/\/[^:]*:)[^@]*@/, "$1***@");

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const bytes = (n) =>
  n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`;

const main = async () => {
  const sourceUri = process.env.PROD_READONLY_URI;
  if (!sourceUri) {
    fail(
      "PROD_READONLY_URI is not set.\n\n" +
        "Pass the READ-ONLY production connection string in the environment, not as\n" +
        "an argument — an argument is visible in shell history and in `ps`:\n\n" +
        "  PROD_READONLY_URI='mongodb+srv://…' npm run clone:prod"
    );
  }

  // Guard 3, checked before anything connects: production's database is called
  // `test` and so is the local development one.
  if (TARGET_DB === "test") {
    fail(
      "Refusing to restore into the local `test` database.\n\n" +
        "That is this machine's development database, and production's database is\n" +
        "also called `test` — restoring 'the same name' would destroy local work.\n" +
        "Pick another name with --target=NAME."
    );
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(TARGET_DB)) {
    fail(`--target must be a plain database name, got: ${TARGET_DB}`);
  }

  console.log(`\nSource (read-only): ${redact(sourceUri)}`);
  console.log(`Target (local)    : ${LOCAL_HOST}/${TARGET_DB}`);
  console.log(WRITE ? "MODE: WRITE — will dump and restore" : "MODE: dry run — nothing will be written");

  // --- survey the source, reading only -----------------------------------
  //
  // A separate connection with a short timeout, so a wrong or expired credential
  // fails here in seconds with a clear message rather than inside mongodump.
  const source = await mongoose
    .createConnection(sourceUri, { serverSelectionTimeoutMS: 10000 })
    .asPromise()
    .catch((error) =>
      fail(
        `Could not connect to the source: ${error.message}\n\n` +
          "If the credential was rotated, get a fresh READ-ONLY one from Atlas.\n" +
          "Check too that this machine's IP is on the Atlas allowlist."
      )
    );

  const sourceDbName = source.name;
  console.log(`\nConnected. Source database: ${sourceDbName}`);

  let stats;
  try {
    stats = await source.db.command({ dbStats: 1 });
  } catch (error) {
    // dbStats needs a role a strictly read-only user may not have. Not fatal —
    // it is a nicety, and the copy does not depend on it.
    console.log(`(could not read dbStats: ${error.message})`);
    stats = null;
  }

  const collections = (await source.db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !ONLY.length || ONLY.includes(name))
    .sort();

  console.log(`\n${collections.length} collection(s) to copy${ONLY.length ? " (filtered)" : ""}:\n`);
  const counts = {};
  let totalDocs = 0;
  for (const name of collections) {
    // estimatedDocumentCount reads metadata rather than scanning, so surveying a
    // 12,000-ticket collection costs nothing.
    const n = await source.db.collection(name).estimatedDocumentCount();
    counts[name] = n;
    totalDocs += n;
    if (n > 0) console.log(`  ${name.padEnd(28)} ${String(n).padStart(9)}`);
  }
  const empty = collections.filter((c) => counts[c] === 0).length;
  if (empty) console.log(`  (${empty} empty collection${empty === 1 ? "" : "s"})`);

  console.log(`\n  ${totalDocs.toLocaleString()} documents total`);
  if (stats) {
    console.log(`  ${bytes(stats.dataSize)} of data, ${bytes(stats.storageSize)} on disk`);
    console.log(
      "\n  NOTE: most of that is base64 QR images stored on tickets and invitations.\n" +
        "  The dump is gzipped, so the transfer is far smaller than the raw figure."
    );
  }

  await source.close();

  if (!WRITE) {
    console.log(
      "\nDry run — nothing written. Re-run with --write to make the copy:\n" +
        `  PROD_READONLY_URI='…' npm run clone:prod -- --write\n`
    );
    return;
  }

  // --- dump ---------------------------------------------------------------
  const dumpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pazimo-prod-"));
  const archive = path.join(dumpDir, "prod.archive.gz");

  console.log(`\nDumping to ${archive} …`);
  const dumpArgs = [
    `--uri=${sourceUri}`,
    `--archive=${archive}`,
    "--gzip",
    // Belt and braces: mongodump does not write to the source, and this makes
    // the intent explicit to anyone reading the command.
    "--readPreference=secondaryPreferred",
  ];
  for (const name of ONLY) dumpArgs.push(`--collection=${name}`);
  if (ONLY.length) dumpArgs.push(`--db=${sourceDbName}`);

  try {
    const { stderr } = await execFileAsync("mongodump", dumpArgs, {
      maxBuffer: 64 * 1024 * 1024,
    });
    // mongodump reports progress on stderr; only the last lines are useful.
    console.log(
      stderr.trim().split("\n").slice(-4).map((l) => `  ${l}`).join("\n")
    );
  } catch (error) {
    fail(`mongodump failed: ${error.stderr || error.message}`);
  }

  const dumpedBytes = fs.statSync(archive).size;
  console.log(`  archive is ${bytes(dumpedBytes)} gzipped`);

  // --- restore, locally only ---------------------------------------------
  console.log(`\nRestoring into ${LOCAL_HOST}/${TARGET_DB} …`);
  try {
    const { stderr } = await execFileAsync(
      "mongorestore",
      [
        `--uri=${LOCAL_HOST}`,
        `--archive=${archive}`,
        "--gzip",
        // Rename the source database to the local target. This is what keeps
        // production's `test` from landing on the development `test`.
        `--nsFrom=${sourceDbName}.*`,
        `--nsTo=${TARGET_DB}.*`,
        // Replace the previous copy rather than merging into it — a half-old,
        // half-new copy is worse than either.
        "--drop",
        "--numInsertionWorkersPerCollection=4",
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    console.log(
      stderr.trim().split("\n").slice(-4).map((l) => `  ${l}`).join("\n")
    );
  } catch (error) {
    fail(`mongorestore failed: ${error.stderr || error.message}`);
  }

  // --- verify -------------------------------------------------------------
  //
  // Counted rather than trusted: a restore that silently dropped a collection
  // would otherwise be discovered as a wrong test result days later.
  const target = await mongoose
    .createConnection(`${LOCAL_HOST}/${TARGET_DB}`)
    .asPromise();

  console.log("\nVerifying the copy:\n");
  let mismatches = 0;
  for (const name of collections) {
    if (counts[name] === 0) continue;
    const copied = await target.db.collection(name).estimatedDocumentCount();
    const ok = copied === counts[name];
    if (!ok) mismatches += 1;
    console.log(
      `  ${ok ? "ok  " : "DIFF"} ${name.padEnd(28)} source ${String(counts[name]).padStart(8)}  copy ${String(copied).padStart(8)}`
    );
  }
  await target.close();

  if (!KEEP_DUMP) {
    fs.rmSync(dumpDir, { recursive: true, force: true });
  } else {
    console.log(`\nDump kept at ${archive}`);
  }

  if (mismatches) {
    fail(
      `${mismatches} collection(s) do not match. The copy is INCOMPLETE — do not test against it.`
    );
  }

  console.log(
    `\nDone. Point the app at the copy with:\n\n` +
      `  MONGODB_URI='${LOCAL_HOST}/${TARGET_DB}' npm run dev\n\n` +
      `Your development database (local \`test\`) is untouched.\n`
  );
};

main().catch((error) => {
  console.error("\ncloneProductionDb failed:", error);
  process.exit(1);
});
