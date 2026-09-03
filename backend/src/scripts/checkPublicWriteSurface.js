/**
 * Boots the API in-process and fires unauthenticated requests at the endpoints
 * that must never answer one.
 *
 * This is the gate for PAZIMO_PLAN P0. Each case below was a real hole found on
 * 2026-08-19 by doing exactly this against a local copy: every one answered
 * 200 or 201 to a request carrying no credential at all. The script exists so
 * that stays fixed — a middleware reordered or a route re-registered without
 * its guard shows up here rather than in production.
 *
 * Deliberately makes no database connection. Authentication and rate limiting
 * both run before any controller, so a correctly guarded route rejects without
 * ever reaching Mongo. That is also the assertion: if a case hangs, the request
 * got past the guard and into a query.
 *
 *   node src/scripts/checkPublicWriteSurface.js
 *
 * Exits 0 when every endpoint refused, 1 otherwise.
 */

const http = require("http");

process.env.JWT_SECRET = process.env.JWT_SECRET || "public-write-surface-check";

const app = require("../app");

// A fake but well-formed ObjectId. Nothing should exist behind it — and on a
// properly guarded route nothing should ever look.
const FAKE_ID = "0123456789abcdef01234567";

const CASES = [
  {
    name: "PUT /api/invitation-pricing",
    method: "PUT",
    path: "/api/invitation-pricing",
    body: { public: { emailPrice: 0, smsPrice: 0 }, private: { emailPrice: 0, smsPrice: 0 } },
    was: "200 — set every invitation price on the platform to 0",
  },
  {
    name: "POST /api/categories",
    method: "POST",
    path: "/api/categories",
    body: { name: "public-write-surface-check" },
    was: "201 — created a platform-wide category",
  },
  {
    name: "PATCH /api/categories/:id",
    method: "PATCH",
    path: `/api/categories/${FAKE_ID}`,
    body: { name: "public-write-surface-check" },
    was: "200 — renamed any category",
  },
  {
    name: "PUT /api/categories/:id",
    method: "PUT",
    path: `/api/categories/${FAKE_ID}`,
    body: { name: "public-write-surface-check" },
    was: "200 — renamed any category",
  },
  {
    name: "DELETE /api/categories/:id",
    method: "DELETE",
    path: `/api/categories/${FAKE_ID}`,
    was: "200 — deleted any category on the platform",
  },
  {
    name: "POST /api/qr-tickets/generate",
    method: "POST",
    path: "/api/qr-tickets/generate",
    body: { eventId: FAKE_ID, customerName: "check", contact: "check", guestType: "guest", qrCount: 1 },
    was: "200 — minted admission QR codes for any event",
  },
  {
    name: "POST /api/qr-tickets/verify",
    method: "POST",
    path: "/api/qr-tickets/verify",
    body: { ticketNumber: "ABC-0001" },
    was: "200 — burned any ticket whose sequential number could be guessed",
  },
  {
    name: "GET /api/users/:id",
    method: "GET",
    path: `/api/users/${FAKE_ID}`,
    was: "200 — TEMP-BYPASS-2026-07-10 IDOR: an organizer's email, phone and ban status",
  },
];

// Only an AUTHORIZATION refusal passes. Deliberately not "any 4xx": an
// unguarded route that happens to reject this particular body with a 400 would
// otherwise read as secured, which is exactly the false pass this script exists
// to prevent. 429 counts because the rate limiter also sits in front of the
// controller and never reaches it.
const REFUSED = (status) => status === 401 || status === 403 || status === 429;

const request = (port, { method, path, body }) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
      }
    );
    // A guarded route answers immediately. A hang means the request reached a
    // query against a database this script never connected — which is a
    // failure, not a timeout to be retried.
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("no response in 5s — the request reached the database, so the guard did not stop it"));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });

const main = async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();

  console.log(`\nUnauthenticated write-surface check — ${CASES.length} endpoints\n`);

  const failures = [];
  for (const testCase of CASES) {
    let result;
    try {
      result = await request(port, testCase);
    } catch (error) {
      failures.push({ testCase, reason: error.message });
      console.log(`  FAIL  ${testCase.name}\n        ${error.message}`);
      continue;
    }

    if (REFUSED(result.status)) {
      console.log(`  ok    ${testCase.name} → ${result.status}`);
    } else {
      failures.push({ testCase, reason: `answered ${result.status}` });
      console.log(
        `  FAIL  ${testCase.name} → ${result.status}\n` +
          `        was: ${testCase.was}\n` +
          `        body: ${result.body}`
      );
    }
  }

  server.close();

  if (failures.length) {
    console.log(`\n${failures.length} of ${CASES.length} endpoints still answer an anonymous caller.\n`);
    process.exit(1);
  }
  console.log(`\nAll ${CASES.length} endpoints refused an anonymous caller.\n`);
  process.exit(0);
};

main().catch((error) => {
  console.error("check failed to run:", error);
  process.exit(1);
});
