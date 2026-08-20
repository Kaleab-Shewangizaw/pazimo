# Pazimo — The Plan

**One direction.** This supersedes [REBUILD_PLAN.md](./REBUILD_PLAN.md) and
[BEVERAGE_CINEMA_PLAN.md](./BEVERAGE_CINEMA_PLAN.md); both are kept only as the
record of how we got here. If those disagree with this file, this file wins.

**Goal:** finish Cinema, then make the platform fast, correct and safe enough to
carry 1,000,000 tickets a year.

**Status:** 2026-08-20 · working branch `feat/beverage-revenue-and-withdrawals`
**P0 is done.** Cinema (P1) is next.
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

**DONE 2026-08-20.** Landed in three commits. What follows is the record,
including two things found while doing it that were not on the list.

Four endpoints accepted writes from anyone on the internet. Each was confirmed
by an unauthenticated HTTP request against a local copy on 2026-08-19.

- [x] `PUT /api/invitation-pricing` — was **HTTP 200**, set email/SMS prices to
      0. Now admin-only. Also validates: a partial body previously left one
      event type untouched while reporting success.
- [x] `POST /api/categories`, `PATCH/PUT/DELETE /api/categories/:id` — were
      **HTTP 201/200**. Now admin-only; reads stay public for the browse UI.
- [x] `POST /api/qr-tickets/generate` — minted admission QR codes from a raw
      `eventId` and `qrCount`. Now staff-only **and ownership-checked**: role
      alone would still have let one organizer mint tickets against another's
      event. `qrCount` bounded at 100.
- [x] `POST /api/qr-tickets/verify` — **not on the original list, and worse.**
      It burns a ticket, and ticket numbers are sequential (`ABC-0001`), so
      anyone could invalidate tickets by counting. Now staff-only.
- [x] `GET /api/users/:id` — `TEMP-BYPASS-2026-07-10` removed, reverted to
      `protect` + `restrictTo("admin", "organizer")`.

On the bypass: production logs were never needed. Both options in the original
plan delete the no-token branch, and they differ only on whether `extractToken`
keeps its tolerance for `x-access-token`, `x-auth-token` and `?token=`. Keeping
it is strictly safer — that tolerance is about *where* the credential is, never
*whether* there is one, since every branch still has to survive `jwt.verify`.
So the middle option is correct either way and the question is moot. If the app
truly sends no token, `protect()` logs the rejection with the URL.

- [x] **Fixed the commission sweep.** `computeDailyTotal` filtered
      `provider: "chapa_giftcard"`, of which production has **zero** — a payment
      is only tagged that when gift-card routing is configured, and it never
      was. So it computed 0 every day and all 74 ledger rows are zero, against
      701,493.24 ETB earned.

      **Widening it was not just dropping the filter.** `Payment` is shared by
      ticket sales, invitation email/SMS fees, campaign payments and on-door
      cash. Invitation and campaign fees are already 100% platform income —
      counting them charges ourselves a fee on our own money. `invitationType`
      cannot separate them, because a plain ticket sale sets nothing and
      inherits the default `"guest"`, the same value invitations use. What does
      separate them is `ticketDetails`: `ticketCount` for tickets,
      `qrCodeCount` for invitations, `campaignId` for campaigns.
- [x] Rate-limited that write surface, as a backstop behind the auth.

**Gate met:** `npm run check:write-surface` boots the API and fires an anonymous
request at all eight endpoints; all eight refuse. It passes only on 401/403/429,
deliberately not any 4xx, so an unguarded route that happens to reject one body
with a 400 cannot read as secured. Verified in both directions — removing a
guard makes it fail.

### Found while doing P0

**Every async controller error hung the request.** Found by removing a guard to
check the new test could actually fail: the request did not return 400, it took
the process down. Express 4 wraps handlers in a plain try/catch, which cannot
catch an async throw — an `async` function returns a rejecting promise, and
nothing was looking at it. `server.js` then swallows `unhandledRejection` by
design to avoid crashing, so **no response was ever written and the request hung
until the client gave up**, holding a socket each time. Not a 400, not a crash —
a silent hang, on every validation error in the API. The typed errors in
`errors/`, their status codes, and the error middleware in `app.js` were all
unreachable code for async handlers: roughly 250 throw sites.

Fixed in `middlewares/asyncErrors.js`, one require in `app.js`, reversible by
deleting it.

**The sweep can compute what is owed but may not be able to send it.**
`sendFee` draws the payout from a gift card, so it can only source the part of a
day that landed in one — and none ever did, which is the same misconfiguration
that caused the original bug. The fix records `giftCardSales` alongside
`totalSales` so this gap is a visible number rather than a payout that fails at
00:05. **Recording what is owed is now correct; actually sweeping it still needs
gift-card routing configured, or a different settlement path.** That decision is
not made yet — see Open questions.

### Still to run on production

Every one of these is dry-run by default. Read the report before `--write`.

- [ ] `npm run backfill:platform-fees` — read the classification table first.
      Only recomputes what is owed; sends nothing.
- [ ] `npm run ledger:backfill` — **required before the admin money cards show
      anything.** Until it runs, the dashboard shows the coverage warning rather
      than figures.
- [ ] `npm run migrate:cinema-publication` — moves every existing film into the
      admin review queue. **This hides every cinema film from customers until an
      admin publishes it**, which is the chosen behaviour;
      `--publish-existing` grandfathers them instead.
- [ ] `npm run backfill:beverage-categories` — gives pre-existing catalogue rows
      the "drink" category the schema default never applied to them.
- [ ] Watch for `protect() rejected GET /api/users/` in the logs for a few days.
      If the mobile app appears there, fix the app — do not reopen the bypass.

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

- [x] **Admin publication gate.** A cinema creates a film; an admin decides
      whether it reaches customers. `CinemaMovie.publicationStatus`
      (pending | published | rejected), admin-only. `PUBLIC_MOVIE_MATCH` is the
      one definition of "a customer may see and buy this" and every public read
      uses it. `issueTicket` gates on it **by default**, so P1.1's online
      checkout is gated the day it lands; the box office opts out explicitly,
      because an admin backlog must not be able to close a real till.
      Editing a customer-facing field returns a film to the queue, and an
      unpublished film cannot hold a banner/featured/trending slot.
- [x] Admin review queue UI on Admin → Cinema, opening on the backlog.
- [x] Cinema concessions report what has been sold — totals plus a per-product
      breakdown. The summary endpoint already existed; nothing called it.
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
- [x] **Committed** 2026-08-20.
- [x] **First read cut over: the admin dashboard's money cards.**
      `GET /api/admin/finance/partitions` returns the five pools — event
      tickets, event beverages, venue beverages, cinema tickets, cinema
      concessions — from ONE aggregation over `LedgerBalance` grouped by
      owner kind × stream, which is already the ledger's natural key. 2.0 ms.

      Moved ahead of the gate deliberately: the figure it replaced was not
      merely slow but **wrong** — a single "available balance" that subtracted
      payouts from every stream from ticket revenue alone, and showed
      **-1,346.87** on the local database. It is also a read-only admin report
      that nobody is paid out on. Owner-facing reads and the withdrawal check
      stay on the old formulas until the reconciler has agreed for the full
      period.

      Carries a coverage guard: an unbackfilled ledger reports itself instead of
      answering a confident 0.00. Verified against a database with 15,000
      tickets and no ledger.
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

## Bugs found and fixed along the way

Kept because each was invisible until something else was being verified, and
the same shape will recur.

- **The admin dashboard showed a negative available balance.** Ticket revenue
  minus withdrawals from *every* stream: `273.13 - 1,500.00 (beverages) -
  120.00 = -1,346.87`. Decision 1 exists precisely to prevent this and the
  dashboard predated it. Fixed twice over — the stream filter added, and the
  single global figure replaced by per-pool cards.
- **Async controller errors hung the request** (see P0). ~250 throw sites.
- **The commission sweep counted nothing** (see P0).
- **Beverage categories were never backfilled.** `default: "drink"` applies at
  document creation, never to existing rows, so every pre-existing beverage sat
  at null and the drink/snack/combo label and filter silently did nothing.
- **`components/header/Header.tsx`** was a two-line placeholder colliding with
  the real `header.tsx` — a build error, and a name clash outright on a
  case-insensitive filesystem.

**The pattern worth remembering:** three of these are the same mistake — *a
schema default or a new field does not change rows that already exist.* Any new
field on an existing collection needs a migration, and the migration needs to
match `null` as well as absent.

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
- [x] ~~Has anything actually hit the `TEMP-BYPASS` fallback?~~ Moot. Both
      options deleted the no-token branch; the safer one works either way and
      is what landed.
- [ ] **How does the platform fee actually get collected?** The sweep now
      computes the right number but pays out of a gift card that the money never
      went into. Either configure gift-card routing so ticket payments land
      somewhere the sweep can draw from, or accept that commission is settled
      by the ledger and retire the gift-card sweep. Until this is answered the
      fee is recorded and not sent.
