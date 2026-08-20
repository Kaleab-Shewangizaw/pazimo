# Pazimo — The Plan

**One direction.** This supersedes [REBUILD_PLAN.md](./REBUILD_PLAN.md) and
[BEVERAGE_CINEMA_PLAN.md](./BEVERAGE_CINEMA_PLAN.md); both are kept only as the
record of how we got here. If those disagree with this file, this file wins.

**Goal:** finish Cinema, then make the platform fast, correct and safe enough to
carry 1,000,000 tickets a year.

**Status:** 2026-08-20 · working branch `feat/beverage-revenue-and-withdrawals`
**Working agreement:** tick items as they land. Note where reality differed.
Any chat should be able to read this and pick up.

---

## Where the code actually is

Verified against the running code on 2026-08-20, not from memory.

### Branches

`feat/beverage-revenue-and-withdrawals` is the trunk. It is **10 commits ahead
of `main`** and holds every beverage, venue, cinema and Phase-1 performance
change.

| Branch | State | Action |
|---|---|---|
| `feat/beverage-revenue-and-withdrawals` | the real trunk, 10 ahead / 2 behind main | keep; merge main in |
| `main` | 2 commits we lack | merge into the trunk (see below) |
| `perf/phase-1-qr-and-query-shape` | **fully contained** in the trunk | retire |
| `feat/beverages-admin` | fully contained | retire |
| `feat/beverages-event-lineup` | fully contained | retire |
| `feat/vat-commission-and-capital-dashboard` | fully contained | retire |
| `feature/chapa-finance` | fully contained | retire |
| `pazimo-capital` | fully contained | retire |
| `developer-dashboard` | 1 unique commit | decide: merge or drop |
| `feat/glassmorphism-event-detail` | 4 unique commits | decide: merge or drop |
| `new-ui` | 2 unique commits, last touched 2026-02 | almost certainly drop |

**The two commits on `main` we do not have:**

- `91a6cf7` ticket wave fix
- `8c84278` extends the `TEMP-BYPASS-2026-07-10` deadline to **2026-09-20**

That second one matters and is picked up in P0 below.

### Done and verified

```
User.role            customer, organizer, venue, cinema
Withdrawal.stream    tickets, beverages, venue_beverages,
                     cinema_tickets, cinema_beverages
Beverage.category    drink, snack, combo
cinema API           77 routes      venue API   20 routes
ledger               2 models, 3 services, backfill + reconcile + bench
```

- **Event channel** — tickets, beverages, commission, VAT, Capital, withdrawals
- **Venue channel** — own account, own ledger, own pool
- **Cinema channel** — account, halls, films, showtimes with cleaning-buffer
  conflict detection, box-office ticketing, concessions, QR + scanner, two
  independent money pools, dashboard, admin curation, public pages with
  `/cinema/{slug}-{shortId}` URLs
- **The ledger** (REBUILD_PLAN Phase 3) — built, backfilled, reconciling,
  dual-writing. **Uncommitted as of 2026-08-20.**

### Measured, on production, 2026-08-19

```
balance read              1,605 ms average   (2,304 ms worst)
tickets collection        522.6 MB — 99.0% base64 QR blobs
invitations collection     65.9 MB — same problem, field qrCodeData
database total            605.1 MB, of which ~588 MB is dead weight
Atlas round trip            255 ms from a dev machine
platform fee ledger        74 rows, 0.00 swept, 0 ever sent
commission earned      701,493.24 ETB — none of it collected
```

Ledger reconciliation reproduces the audited figure **exactly**: gross × 0.03 to
the cent, `commission + vat + ownerVat + net === gross` holds.

### Still open

- **B2** — `fulfilBasket` is never called outside its own service. Buying a
  drink during checkout does not work, for any channel.
- **Cinema online checkout** — box office works; there is no way to buy a
  cinema ticket online.
- **Refunds** — no refund path anywhere in the backend for money that has
  actually settled.
- **Seats (C3)** — scaffolding only: `CinemaHall.hasAssignedSeating` and
  `seatLayout` exist and are unread.

---

## The order of work

Cinema first, as agreed. But **P0 comes before everything**, because three of
its items are live holes and one is money we are not collecting. None of them
takes long.

---

## P0 — Stop the bleeding

**~1 day. Do this first.**

Four endpoints accept writes from anyone on the internet. Each was confirmed by
an unauthenticated HTTP request against a local copy on 2026-08-19.

- [ ] `PUT /api/invitation-pricing` — **HTTP 200**, sets email/SMS prices to 0.
      This is what organizers are charged. `req.user` is never referenced.
- [ ] `POST /api/categories`, `PATCH/PUT/DELETE /api/categories/:id` — **HTTP
      201/200**. `categoryController` contains no reference to `req.user`,
      `admin` or `role`. Anyone can delete every category on the platform.
- [ ] `POST /api/qr-tickets/generate` — mints admission QR codes from a raw
      `eventId` and `qrCount`.
- [ ] `GET /api/users/:id` — the `TEMP-BYPASS-2026-07-10` IDOR. Returns an
      organizer's email, phone and ban status with no credentials.

The first three are one line each: `authenticateUser, restrictTo("admin")`.

The fourth has a shortcut its own commit message spells out: **the fallback
path logs on every hit.** Check production logs for
`TEMP-BYPASS-2026-07-10`. If nothing has hit it, the mobile app is already
sending a credential and the whole block can be deleted today rather than
waiting for 2026-09-20. If it has been hit, take the middle option — drop only
the no-token branch, keep `extractToken`'s tolerance for `x-access-token`,
`x-auth-token` and `?token=`.

- [ ] **Fix the commission sweep.** `platformFeeService.computeDailyTotal`
      filters `provider: "chapa_giftcard"`. Production has **zero** of those —
      18,186 `chapa`, 160 `santim`, 1,257 null. So the sweep computes 0 every
      day and all 74 ledger rows are zero. Against 701,493.24 ETB earned.
      Widen the filter, then backfill the missed days.
- [ ] Rate-limit the write endpoints above. Only login and RSVP are limited today.

**Gate:** the four endpoints reject anonymous callers; one day's fee ledger row
is non-zero.

---

## P1 — Finish Cinema

**~1.5 weeks. The stated priority.**

### P1.1 — Cinema online checkout

The one thing standing between Cinema and being sellable. Everything underneath
already exists: `issueTicket` resolves prices server-side and claims seats
atomically, the booking UI reaches the point of payment, and the payment
providers are wired for events.

- [ ] Checkout route accepts `{ showtimeId, ticketTypeId, quantity }` and prices
      it **server-side** — the client says what it wants, never what it costs
- [ ] Payment amount = tickets (+ concessions once B2 lands) as one transaction
- [ ] `processSuccessfulPayment` calls `issueTicket` on settlement
- [ ] Seats held between checkout and settlement, with expiry, so a slow payment
      cannot oversell — reuse the atomic claim, do not invent a second one
- [ ] Ticket delivered: QR page + link. The renderer and scanner already work.

**Watch for:** the seat claim currently happens inside `issueTicket`. Online
checkout needs the claim to happen *earlier* (at basket time) and be released
if payment fails. That is the one genuinely new piece of concurrency here.

### P1.2 — B2, unblocked

Cinema concessions at checkout need the same wiring events have been waiting on.

- [ ] Checkout accepts a concession basket alongside the ticket selection
- [ ] `processSuccessfulPayment` calls `fulfilBasket` after the ticket is created
- [ ] Decide what happens to `failed` lines — a paid drink that sold out between
      checkout and settlement needs a refund path, and there is none yet
- [ ] Redemption at the counter marks a pre-bought item collected

### P1.3 — Cinema finishing work

- [ ] Admin: movies/showtimes/ticket-sales tabs on the Admin → Cinema page.
      The APIs all exist; only the UI is missing.
- [ ] Bulk "schedule screenings" — one film, many showtimes
- [ ] Customer-facing browse polish; the public API is in place
- [ ] Backfill slugs on production (`npm run backfill:cinema-slugs`) so existing
      films get readable URLs instead of falling back to their id

**Gate:** a customer can buy a cinema ticket online, receive it, and be admitted
by the scanner — without an operator touching anything.

---

## P2 — Make it fast

**~3 days for the first two items, and they are the biggest wins available.**

- [ ] **Strip stored QR blobs from `tickets`.** 517 MB of 522 MB.
      `src/scripts/stripStoredTicketQr.js` exists, has a `--dry` flag, and has
      never been run. It `$unset`s one presentational field; images are already
      rendered on demand and fully reproducible.
- [ ] **Strip `qrCodeData` from `invitations`.** 65.9 MB, up to 54.7 KB per row,
      same root cause. **No script exists — this one needs writing**, modelled on
      the ticket one.
- [ ] **Measure the API server's latency to the Atlas region.** A dev machine
      sees 255 ms round trip, and a single indexed document costs 253 ms — the
      database work is ~0, it is all distance. If the production server is
      similarly far, this dwarfs every other optimisation on this list. Measure
      before optimising anything else.
- [ ] Review the 19 indexes on `tickets`; every write pays for all of them.
- [ ] `getAdminCinemaFinance` runs one balance computation per cinema. Replace
      with the ledger's `listBalances` (one query, 1.87 ms) at cutover.

**Gate:** database under 50 MB; a balance read under 100 ms from the app server.

---

## P3 — The ledger cutover

**Built and dual-writing. This is the part that makes money correct, not just fast.**

REBUILD_PLAN Phase 3, delivered as `LedgerEntry` + `LedgerBalance` + services,
generalised past the original design to four owner kinds — organizer, venue,
cinema and **platform**, so the admin's totals are the same O(1) read as
everyone else's rather than a sum over every ticket.

Measured, same data both ways: **23 ms → 1.14 ms, a 20× speedup**, before the
QR strip removes the scan's remaining excuse.

- [x] `LedgerEntry` — append-only, integer minor units, unique idempotency key
- [x] `LedgerBalance` — projection, rebuildable from entries
- [x] Money in integers end to end (`utils/money.js`); split identity verified
      across 100,000 amounts with zero drift
- [x] Dual-write on all five sale paths and both payout paths, and a ledger
      failure can never fail a sale
- [x] Backfill (dry-run default, idempotent) and reconciler
- [x] Reconciler agrees: 12 exact, 1 within per-transaction rounding, 0 real
- [ ] **Commit it.** It is uncommitted as of 2026-08-20.
- [ ] Run the reconciler on a schedule and let it agree for the gate period
- [ ] Wrap money movements in `session.withTransaction()` on Atlas — closes the
      withdrawal double-spend race, which has no lock today
- [ ] Switch reads to `LedgerBalance`
- [ ] Delete the old balance formulas
- [ ] Then redo the VAT change (`git cherry-pick fbaeb25`) as a rate constant
      plus a `kind: "vat"` entry

**Gate:** reconciler agrees for the full period · reads cut over · old formulas
deleted.

---

## P4 — Everything after

- [ ] **Refunds.** Nothing in the backend can reverse settled money. The ledger
      makes this expressible for the first time — a refund is an appended
      reversal, not a deletion. Needed by B2 and by any real support process.
- [ ] **Seats (C3).** `hasAssignedSeating` and `seatLayout` are already on
      `CinemaHall` and unread, so this is additive: seat map, `SeatHold` with a
      TTL index, atomic hold claim, picker UI, `CinemaTicket.seat` snapshot.
- [ ] **Tests.** There is no test framework. Everything verified so far has been
      throwaway bench scripts. The money paths and the authorization matrix
      deserve a real suite that runs on every change.
- [ ] **The audit we have not done.** Frontend XSS and exposed keys, webhook
      signature verification on the Chapa and SantimPay callbacks (they take
      money instructions unauthenticated by design), dependency CVEs, and
      file-upload validation on the multer endpoints. None of this has been
      looked at.

---

## Branch hygiene

Do this once, early — it costs minutes and removes six misleading branches.

- [ ] Merge `main` into the trunk (2 commits: the ticket wave fix and the
      TEMP-BYPASS deadline note)
- [ ] Delete the six fully-contained branches listed above, local and remote
- [ ] Decide on `developer-dashboard` (1 commit), `feat/glassmorphism-event-detail`
      (4), `new-ui` (2, from February)
- [ ] Then merge the trunk into `main` and work from shorter-lived branches

---

## Decisions that stand

Do not re-litigate these.

1. **Three channels, three ledgers, one set of arithmetic.** Event, venue and
   cinema keep separate collections so one channel's money can never be summed
   into another's by an aggregation that forgot a filter. Commission and VAT are
   computed by shared code so they cannot drift.
2. **A cinema is a separate tenant, not an organizer with a flag**, and a
   screening is **not** an Event. Overturned the earlier C1/C2 design on
   2026-08-16. A dummy event per showing would put cinema takings inside every
   "what did my events earn" figure and fill the public listing with thirty
   showings of one film.
3. **Two pools per cinema** — seats and concessions settle independently, so
   selling out a screening does not release popcorn money.
4. **Display slots are admin-only.** Banner, featured and trending are shared
   shelf space; a seller who could promote itself would make them meaningless.
5. **Money is integers.** Minor units everywhere past `utils/money.js`. A
   persisted running total accumulates rounding error that nothing washes out.
6. **Pazimo Capital is ticket-side and organizer-only.** Advances are
   underwritten against event revenue; venues and cinemas have none.
7. **Prices are resolved server-side.** The client says which tier and how many,
   never what it costs.

---

## Open questions

- [ ] Pre-bought drinks: ticket QR, or their own redemption code?
- [ ] Combos: independent price, or summed from components? (`category: "combo"`
      exists and carries no bundling behaviour yet.)
- [ ] Do cinemas get Pazimo Capital? Currently no, by decision 6.
- [ ] Has anything actually hit the `TEMP-BYPASS` fallback? The answer decides
      whether P0's fourth item is a delete or a rewrite.
