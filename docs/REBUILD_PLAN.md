# Pazimo Rebuild Plan — The Road to One Million

**Goal:** carry 1,000,000 tickets/year (Ethiopian calendar 2019 E.C. season) plus the
beverages feature, fast and correct.

**Status:** Phase 1 starting · working locally for now, server work deferred
**Last updated:** 2026-08-13

> Working agreement: check items off as they land (`- [x]`). Add a one-line note under
> an item when the reality differed from the plan. Keep this file as the single source
> of truth for the rebuild — any chat should be able to read it and pick up.

---

## ⚠ Commands waiting on you

Nothing here has been run. Each is a data write, so they are yours to trigger.

```bash
# 1.1 — strip stored QR blobs (code already shipped; do this to reclaim the space)
node backend/src/scripts/stripStoredTicketQr.js --dry    # preview: counts + MB
node backend/src/scripts/stripStoredTicketQr.js          # actually strips
# Refuses a non-localhost URI unless you add --i-mean-production. Tested.
# After it runs on a real DB, compact or resync to return space to disk.
```

Also outstanding, unrelated to any phase:
- **Rotate the Atlas password for user `pazimo`** — it was exposed in a chat transcript
- Delete the 4 dead commented-out `MONGODB_URI` lines in `backend/.env`
- `systemctl disable --now mongod` on the server — that local Mongo is unused

---

## Context a new session needs

Established facts, so nothing gets re-derived:

- **Stack:** Express + Mongoose (CommonJS, Node 22), Next.js 15 App Router, MongoDB Atlas.
- **Production DB:** Atlas `cluster0.psywky.mongodb.net`, database name **`test`**
  (the URI has no path, so Mongoose defaults to `test`). The `mongod` running on the
  server is **unused** — safe to disable.
- **Scale today:** 12,033 tickets · 18,760 payments · 6,803 users · 109 events ·
  164 withdrawals · 3 loans. DB size 552.9 MB.
- **Money reconciles exactly.** Gross ETB 22,417,641 · paid out 21,279,125.53 ·
  cash held 1,138,515.47 · owed to organizers 633,865.49 · loan receivable 167,879.25 ·
  **Pazimo equity = 672,529.23 = commission @3%, difference 0.00**.
  Any ledger backfill must reproduce **672,529.23**.
- **Server:** 6 vCPU AMD EPYC, 11 GB RAM, 193 GB disk, ~95% idle. Not the bottleneck.
- **Tests:** none. Zero test files across 17,359 lines of controllers.

### Known-good reference points

- `capitalService.getRevenueByEvent` — the **correct** aggregation shape to copy.
- `financeService.calculateOrganizerBalance` — the balance the rest of the app should agree with.

---

## Phase 0 — Server & infrastructure

**DEFERRED — doing local work first.** Nothing here is code; revisit before the season.

- [ ] PM2 `exec_mode: "cluster"`, `instances: 4` (currently `fork` = 1 core of 6)
- [ ] Raise `ulimit -n` to 65535 (currently 1024 — caps WebSockets at ~1k connections)
- [ ] Add 4 GB swap (currently none — spikes OOM-kill Node)
- [ ] Nginx: `backlog=4096`, `worker_connections 8192`, gzip, WS upgrade headers
- [ ] sysctl: `tcp_max_syn_backlog=8192`, widen `ip_local_port_range`
- [ ] Install Redis (localhost, `maxmemory 2gb`, `allkeys-lru`)
- [ ] Reboot (188 days uptime, pending kernel + security update)
- [ ] `systemctl disable --now mongod` — the local Mongo is unused

### Security — do these regardless of phase

- [ ] **Rotate the Atlas password** for user `pazimo` (credentials were exposed in chat)
- [ ] Delete the 4 dead commented-out `MONGODB_URI` lines from `backend/.env`
- [ ] Restrict Atlas IP allowlist (check whether it is `0.0.0.0/0`)
- [ ] Investigate frontend crash loop — PM2 shows **65 restarts in 15 days** vs 11 on backend

---

## Phase 1 — Kill the slow queries

**1 week · local · no structural refactor · this is where the speed comes from**

### 1.1 Move QR images out of the database ⬅ highest leverage — **CODE DONE, backfill pending**
- [x] Shared renderer `backend/src/utils/qrRenderer.js` — logo read once per process, not per ticket
- [x] `GET /api/tickets/:ticketId/qr.svg` and `.png?w=` (public, matches the existing capability-URL model)
- [x] Pre-save hook no longer writes `qrCode` (old code kept behind `LEGACY_QR_ON_SAVE = false`)
- [x] Frontend reads `ticketQrUrl()` from `frontend/lib/ticketQr.ts` — 6 files updated
- [x] Download path rewritten: fetches the PNG directly instead of a tainted canvas `toDataURL`
- [ ] **Run the backfill:** `node backend/src/scripts/stripStoredTicketQr.js --dry` then without `--dry`
- [ ] After backfill, compact/resync to return the space to disk
- [ ] `.select()` exclusions — moot once the field is gone; skip unless the backfill is delayed

**Measured, not estimated.** The stored `qrCode` averaged **53,895 bytes = 99.2% of the
ticket document**. Cause: the 26 KB `miniLogo.png` was base64'd into the SVG (35 KB), then
the whole SVG base64'd again for the data URI — the same logo stored once per ticket.
At 1M tickets that is **50.2 GB**, on a server with 11 GB RAM and 147 MB/s disk reads.

**Verified safe:** all 101 local tickets were decoded with a real QR decoder. Every
re-rendered code carries the correct `tid` — the only field `validateQRCode` reads
(`ticketData.tid || ticketData.ticketId`, then a fresh DB lookup). 68/101 are byte-identical;
the other 33 differ only in the decorative `nm` field because that test user was renamed
since purchase. Existing printed/saved QR codes still scan.

**Perf:** `qr.svg` 13.7 ms warm (browser-cached 24 h). `qr.png` was 409 ms — the logo
composite ran per request and blocked the event loop — now **67 ms** by caching the
logo-on-white-circle backdrop, which is identical for every ticket. Same lesson as the bug
being fixed: build the shared part once.

**Production numbers (read-only check, 2026-08-13):** 12,073 tickets, **495.5 MB of QR
base64 out of a 500.3 MB collection — 99.0%**. Average 43,039 bytes per ticket.
At 1M tickets that is **40.1 GB**. Re-render verified on production tickets:
**0 mismatches** — every code that could be decoded carries the correct ticket id.

### ⚠ Pre-existing issue found while verifying (not caused by this change)

Stored QR codes come in **two formats**, because three different code paths generated them:

| format | count | payload |
|---|---|---|
| SVG (Ticket pre-save hook) | 9,038 | compact `{tid,nm,tp,tip,qty}` |
| PNG (`QRCode.toDataURL` in on-door + routes/tickets.js) | 3,035 | legacy fat `{_id,ticketId,eventId,userId,ticketType,price,purchaseDate,status,paymentReference,…}` |

**Of a 60-ticket sample of the PNG ones, 22 (37%) could not be decoded by jsQR even after
4× upscaling**, at a normal 256 px. All the SVG ones decoded fine. Cause not established —
it may be decoder tolerance rather than genuinely broken codes, since phone scanners use
more forgiving decoders.

- [ ] **Test a handful of PNG-format tickets with the real scanner app before the next event.**
      If they fail there too, ~3,035 attendees are holding codes that may not scan.

The on-demand renderer produces the compact payload at 400 px+, so it should be strictly
easier to scan than the fat legacy PNGs — this change likely *improves* the situation.

### 1.2 Rewrite the `$lookup`-first aggregations — **DONE**
- [x] New shared `backend/src/utils/ticketRevenueQuery.js` — one definition of "counts as revenue"
- [x] `services/financeService.js` — `calculateOrganizerBalance`
- [x] `services/loanRepaymentService.js` — `getGrossRevenueSince`
- [x] `services/capitalService.js` — dropped its private copy, uses the shared one
- [x] `controllers/userController.js` — `getAllUsers` nested `$lookup`
- [x] `controllers/organizerController.js` — `getTopCustomers` (a 4th one, not in the original list)

**Measured on a 15,000-ticket / 60-organizer local bench (`pazimo_bench`):**

| | before | after | |
|---|---|---|---|
| `calculateOrganizerBalance` | 826 ms | **15.1 ms** | 55× |
| `getGrossRevenueSince` | 1,648 ms | **11 ms** | 150× |
| `getAllUsers` (10/page) | 1,348 ms | **25 ms** | 54× |

**Confirmed against production (read-only, 2026-08-13, 12,073 tickets).**
`explain("executionStats")` on the worst-case organizer (15 events):

| | old | new |
|---|---|---|
| server execution time | 1,221 ms | **21 ms** |
| documents examined | **12,073** (whole collection) | **114** |
| index keys examined | 0 | 126 |
| plan | `COLLSCAN` | `IXSCAN` |

The old query examined **every document in the collection regardless of how small the
organizer was** — its cost grows with total business volume, so at 1M tickets it would
examine 1M documents (~100 s). The new one examines only that organizer's tickets and
does not care how large the collection gets.

Wall-clock over the network was only 2.1× (1,041 ms → 502 ms) because round-trip latency
to Atlas dominates both. The 58× is the real server-side improvement.

**Correctness confirmed on production data:** 2 differences in 40 calls, both ETB, each
exactly equal to that organizer's USD revenue, zero unexplained — including
`717,249 → 717,229`, the organizer whose −19.40 ETB overdraft the live audit traced to
this same currency mixing.

### 🐛 Correctness bug found and fixed in the same pass

`validTicketMatch` existed in three files, all with the same defect:

```js
{ ...(cur === "ETB" ? { $or: [currency…] } : { currency: cur }),
  status: {...},
  $or: [paymentStatus…] }        // a JS object can't hold two $or keys —
                                 // this one silently replaced the first
```

**Every ETB query was including USD tickets.** USD was unaffected (that branch sets
`currency` directly). It hit organizer balances, loan repayment, and borrowing limits.

Proven on the bench: **51/51 organizers**, the ETB revenue drop equals exactly that
organizer's USD revenue — zero unexplained. USD results 51/51 byte-identical.

Production impact is small today (only 230 USD of tickets exist) but it inflated every
ETB balance, and it would have grown.

**Snapshot harness** in the scratchpad (`agg-snapshot.js` / `agg-final.js`) captures
before/after output for every organizer — reusable for Phase 2 and worth promoting into
the real test suite.

### 1.3 Collapse the admin request storm — **DONE**
- [x] New `GET /api/admin/organizers/overview` (`controllers/organizerOverviewController.js`)
- [x] Frontend `fetchOrganizers` reduced to a single request; the three nested loops are gone
- [x] Row counts read from the response instead of measuring a downloaded events array

**Measured on production data (read-only), one load of page 1 (10 organizers):**

| | old | new |
|---|---|---|
| HTTP requests | ~31 | **1** |
| tickets downloaded to the browser | 525 | **0** |
| payload | **27.3 MB** | **~4 KB** |

27 MB to render an event count and a few totals — because tickets were fetched whole,
each dragging its ~43 KB base64 QR blob. Page 1 holds the *newest* organizers, who have
the fewest events; established organizers are far worse.

Server side it is five queries regardless of page size (organizers → their events →
one ticket aggregation → one withdrawal aggregation → one loan aggregation), instead of
per-organizer and per-event round trips.

**Correctness:** the list's `totalRevenue` / `availableBalance` / `pazimoCommission` were
checked against `financeService.calculateOrganizerBalance` for 60 organizer+currency
combinations — **60/60 agree**. The list and the balance screen cannot drift.

- [ ] Follow-up: the organizer detail dialog still enriches its breakdown from
      `organizer.events[].tickets`, which the list no longer loads. It should fetch that
      organizer's tickets lazily when opened.

### 1.4 Index hygiene
- [ ] Audit the 16 `Ticket` indexes, drop duplicates — each one costs write throughput

**Gate:** balance endpoint p95 < 50 ms · admin organizers page < 2 s · load test at 300 req/s

---

## Phase 2 — Build the safety net

**2 weeks · local · nothing ships to users**

- [ ] Pick and wire a test runner (proposed: **Jest** + `mongodb-memory-server`)
- [ ] Characterization tests on money: given fixed ticket/withdrawal/loan data,
      the balance is exactly X (~20–30 tests, not coverage for its own sake)
- [ ] Seeded fixture DB from an anonymised production snapshot
- [ ] CI running the suite on every push
- [ ] **Fix critical auth holes** (tests make this safe):
  - [ ] `POST /api/tickets/on-door` has no `restrictTo` — any logged-in user can mint
        free valid tickets ([routes/ticketRoutes.js:848](../backend/src/routes/ticketRoutes.js#L848))
  - [ ] `joinOrganizerRoom` socket handler is unauthenticated — any browser can join
        any organizer's room ([server.js:24](../backend/src/server.js#L24))

**Why:** zero tests across 17,359 lines, on a system that has moved 22.4M ETB. Phase 3
rewrites how money is stored. This is the price of admission — and the phase teams skip
and regret.

**Gate:** suite green in CI · both auth holes closed · assertions reproduce production to the birr

---

## Phase 3 — The ledger (the actual rebuild)

**2–3 weeks · local**

```js
// append-only. never updated, never deleted.
LedgerEntry {
  organizer, currency,
  kind: "ticket_sale" | "beverage_sale" | "commission" | "vat"
      | "loan_principal" | "loan_repayment" | "withdrawal" | "refund",
  amountMinor,        // integer cents — never a float
  balanceAfterMinor,  // running total, written in the same transaction
  source: { ticket?, withdrawal?, loan?, beverageSale? },
  idempotencyKey,     // unique index — makes replay safe
  createdAt
}

OrganizerBalance {    // one doc per organizer+currency
  organizer, currency,
  availableMinor, pendingMinor, loanOutstandingMinor,
  lastEntryId, version
}
```

- [ ] Build alongside the existing path — dual-write, do not cut over
- [ ] Backfill from tickets + withdrawals + loans; **must reconcile to 672,529.23**
- [ ] Wrap money movements in `session.withTransaction()` (closes the withdrawal
      double-spend race — no lock exists today)
- [ ] Switch reads to `OrganizerBalance` after dual-write agrees for 7 days
- [ ] Delete the old balance formulas
- [ ] **Then** redo the VAT change (reverted from `fbaeb25`, recoverable via
      `git cherry-pick fbaeb25`) — it becomes a rate constant plus a `kind: "vat"` entry

**Why:** almost every serious problem found across three audits is one root cause —
money is recomputed from history instead of stored. That single fact produces the four
divergent balance formulas, the loan that un-repaid itself, the missing repayment
journal, the impossibility of refunds, the withdrawal race, and the slow balance query.

**Gate:** dual-write agrees 7 days · backfill exact · reads cut over · old formulas deleted

---

## Phase 4 — Modules, real-time, server-first

**3 weeks · and ongoing**

- [ ] Vertical slices for the rewritten money modules:
      `model · repo · service · controller · routes · events · jobs · tests`
- [ ] **Global rule: if a feature touches money, it appends to the ledger.**
      It never computes a balance.
- [ ] BullMQ on Redis — SMS, email, QR generation, fee sweep, with retries
- [ ] Socket.IO: auth at handshake, rooms from the verified JWT, Redis adapter for cluster
- [ ] Convert highest-traffic pages to server components
      (151 of 222 frontend files are `"use client"` today; only 5 fetch server-side)
- [ ] Split `ticketController.js` (2,452 lines) and `ticketRoutes.js`
      (860 lines, with payment logic living inside a route file)

**Why:** the module pattern lands here rather than as its own migration, because the
ledger rewrite touches these modules anyway. Everything else converts opportunistically
when next touched — never as a big-bang.

**Gate:** sockets authenticated + clustered · beverage sales appear in balances · 800 req/s

---

## Open questions

- [ ] **Is beverage revenue meant to be invisible to money?** `BeverageSale` is written
      but read by no balance calculation — organizers can't withdraw beverage money and
      Pazimo takes no commission on it. Decide before the next feature copies the pattern.
- [ ] Commission has **never been swept** — all 60 fee-ledger rows are zero, 0 sent,
      because `computeDailyTotal` only counts `provider: "chapa_giftcard"` and there are
      zero of those. 672,529.23 of Pazimo's money sits mixed with organizer funds. Decide
      how to separate it.
- [ ] 73 payments marked PAID with no ticket issued, worth 129,593 ETB — refund or reconcile?
- [ ] One on-door ticket row worth 793,000 ETB with quantity 1 and no payment record
      (event "THE LAB") — created outside the normal endpoint. Investigate.

---

## Reference — audits behind this plan

| Audit | What it covers |
|---|---|
| Money flow (code) | Two payment rails, three ledgers, 10 code-level risks |
| Live reconciliation | Books balance to 0.00; the "missing" 100k is an undrawn advance |
| Architecture | Bottlenecks and the ledger-first design |
