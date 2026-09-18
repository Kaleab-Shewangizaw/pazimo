# Beverages, Concessions & Cinema — Implementation Plan

> **SUPERSEDED — 2026-08-20.** The single source of truth is now
> [PAZIMO_PLAN.md](./PAZIMO_PLAN.md), which merges this file with the other
> plan and reflects what is actually in the code. This file is kept as the
> record of how the design got here; where the two disagree, PAZIMO_PLAN wins.


Companion to [REBUILD_PLAN.md](./REBUILD_PLAN.md). That file covers making the
existing system fast and correct; this one covers the new revenue streams.

**Status:** B1 done · B2 service layer done, checkout wiring open · V1 (venues) done
**Last updated:** 2026-08-16

> Same working agreement: tick items as they land, note where reality differed.
> Any chat should be able to read this and pick up.

---

## Decisions already made

Settled with Kaleab — do not re-litigate these:

1. **Beverages are a fully separate pool** — own dashboard, own route, own
   balance, own withdrawal request, for both admin and organizer. Revised
   2026-08-13 from "separate reporting only".
2. **Beverages carry their own commission**, also 3% by default, tracked and
   reported separately from ticket commission.
3. **Cinema is a new role**, not a new user type bolted on. A cinema sees its
   ticket sales and its beverage sales.
4. **Beverages can be bought two ways:** at the venue during the event, or
   pre-purchased during ticket checkout.

### The distinction that keeps this safe

**Separate pools, shared mechanism.**

Two balances and two withdrawal buttons — but *one* `Withdrawal` model, one
approval flow, one place money leaves. A parallel `BeverageWithdrawal` would
duplicate the balance check, the audit trail and the admin queue, which is the
shape that made beverage revenue invisible in the first place.

Concretely: `Withdrawal.stream` is a discriminator (`tickets` | `beverages`),
balances are computed per stream, and the withdrawal endpoint validates against
the pool being drawn from. When the ledger lands (REBUILD_PLAN Phase 3),
`stream` becomes `LedgerEntry.kind` and nothing else changes.

**Pazimo Capital sits on the ticket side only.** Advances are underwritten
against event revenue and repaid from a cut of ticket sales, so bar takings
neither fund nor repay a loan — an organizer with an outstanding advance can
still settle bar money.

---

## Where things stand

- `Beverage` (catalogue) → `EventBeverage` (per-event line-up + stock) →
  `BeverageSale` (ledger, prices snapshotted). The shape is already right.
- **`BeverageSale` has no `commissionRate` and no reader outside the beverage
  feature.** No balance, no withdrawal, no commission, no borrowing limit.
  Organizers cannot withdraw drink money; Pazimo takes nothing.
- `BeverageSale.channel` is already `"online" | "manual"` — the hook for
  pre-purchase vs at-venue exists.
- `User.role` is `["customer", "organizer"]`. Admins live in a separate `Admin`
  model. Adding cinema means extending this enum.
- `Ticket.commissionRate` snapshotting and per-event `Event.commissionRate`
  already shipped — beverages should copy that pattern exactly.

---

## B1 — Beverage money, as its own stream

**DONE**

Beverage sales are happening in production right now and none of that money is
reachable. This is not preparation for cinema; it is a defect.

- [x] `Event.beverageCommissionRate` — default 3%, independent of the ticket rate
- [x] `BeverageSale.commissionRate` — snapshotted at sale via a model hook, same
      pattern as `Ticket.commissionRate`
- [x] `utils/beverageRevenueQuery.js` — the beverage twin of
      `ticketRevenueQuery.js`, field names deliberately mirrored so the two
      streams can be added uniformly
- [x] `calculateOrganizerBalance` returns `streams.tickets`, `streams.beverages`
      and `combined` — **drink money is now withdrawable**
- [x] `GET /api/admin/commission/summary` and `/events` carry both streams
- [x] `PATCH /api/admin/commission/events/:id` accepts either rate or both
- [x] Two new indexes on `BeverageSale` for the revenue scans
- [x] Admin `CommissionPanel` UI: the three cards show combined totals with a
      `tickets · drinks` split underneath; the table carries both streams and
      both rates, each inline-editable via a shared `RateCell`
- [x] **Separated into its own dashboard** (revised scope):
  - [x] `Withdrawal.stream` discriminator; legacy rows read as `tickets`
  - [x] `financeService` returns `streams.tickets.availableBalance` and
        `streams.beverages.availableBalance` as independent pools
  - [x] Withdrawal creation validates against the pool named in `stream`
  - [x] `GET /api/beverages/finance/organizer` and `/finance/admin`
  - [x] `components/beverages/BeverageFinancePanel.tsx` — shared by both scopes
  - [x] Admin: a **Finance tab** on `/admin/beverages` (that page is already
        tabbed, so a separate route would have been a second door to the same
        room — the standalone route was removed)
  - [x] Organizer: `/organizer/beverages/finance` as its own route, since the
        organizer beverages page is not tabbed
  - [x] Beverages removed from the tickets-page commission panel

**Pool isolation verified on the bench:**

```
10,000 drink sale @3%   beverage pool +9,655   ticket pool unchanged   PASS
5,000 beverage withdrawal   beverage pool down, ticket pool untouched  PASS
legacy withdrawal with no stream field -> counted against tickets      PASS
legacy `availableBalance` field still means the ticket pool            PASS
```

**Verified on the local bench:**

```
event bar rate 5%  ->  sale snapshot: 0.05        PASS
rate changed 5% -> 12% after the sale
  sale still records 0.05                          PASS  (snapshot held)
commission @5% = 100, VAT = 15, organizer = 1885   PASS
combined gross == tickets + beverages              PASS
balance moved by exactly the organizer share       PASS
```

**Note:** `BeverageSale` is ETB-only (`currency` enum has one value), so the USD
view returns an empty beverage stream rather than running a pointless scan. If
USD beverage sales are ever needed, widen that enum first.

**Design notes**

- VAT applies to beverage commission exactly as it does to ticket commission:
  15% *of the commission*, so 3% costs the organizer 3.45%.
- Refunded sales (`status: "refunded"`) must be excluded from revenue — the
  ticket-side equivalent of `validTicketMatch`.
- Snapshot the rate, never read it live. An admin renegotiating a rate must not
  restate drink revenue already paid out.

---

## B2 — Pre-purchase during ticket checkout

**~4 days · depends on B1**

Today a beverage sale is recorded by hand (`channel: "manual"`). Buyers should be
able to add drinks and snacks while buying a ticket.

- [x] `services/concessionBasketService.js` — `priceBasket()` recomputes every
      amount from `EventBeverage`; the client says *what*, never *what it costs*
- [x] `fulfilBasket()` — atomic stock claim, rolls stock back if the ledger write
      fails, reports sold-out lines in `failed` rather than discarding a paid order
- [x] `BeverageSale.paymentReference` — ties an online sale to its transaction
- [ ] Checkout route accepts the basket alongside the ticket selection
- [ ] Payment amount = tickets + concessions, as one transaction
- [ ] `processSuccessfulPayment` calls `fulfilBasket` after the ticket is created
- [ ] Decide what happens to `failed` lines — a paid drink that sold out between
      checkout and settlement needs a refund path, and there is no refund code
      anywhere in the backend yet (see REBUILD_PLAN finding 07)
- [ ] Redemption at the venue marks the pre-bought item collected — needs a
      redemption code or reuse of the ticket QR

**Verified on the local bench:**

```
priced 3 x 150            -> 450                      PASS
item from another event   -> rejected                 PASS
quantity above cap        -> rejected                 PASS
duplicate lines collapsed -> 8 x 150 = 1200           PASS
more than stock           -> rejected                 PASS
fulfilment: channel online, 4% snapshot, stock 0->3   PASS
oversell of 50 with 7 left -> 0 created, stock intact PASS
```

**Open question:** does a pre-bought drink appear on the ticket QR, or get its
own code? Reusing the ticket QR is simpler for the customer but means the scanner
has to distinguish "admit" from "hand over drinks", and handle partial collection.

---

## V1 — The venue channel

**DONE**

A club, bar, restaurant or lounge that sells drinks through Pazimo without
running events. The second distribution channel: same catalogue, its own
line-up, its own ledger, its own pool.

```
Beverage ── EventBeverage ── Event ── Organizer      (event channel)
         └─ VenueBeverage ── Venue ── Venue account  (venue channel)
```

- [x] `User.role` gains `"venue"`; the business lives in a `Venue` model the
      account owns. Auth, JWT, ban handling and `restrictTo` all unchanged.
- [x] `Venue` carries what `Event` carries for the other channel —
      `beverageCommissionRate` and `coversVenueVat` — because the venue IS the
      sales context. Plus eligibility and a `blockedBeverages` deny list, which
      live here rather than in a side table since a Venue exists only to sell.
- [x] `VenueBeverage` — the line-up, unique on `{venue, beverage}`
- [x] `VenueBeverageSale` — its own collection, `PZV-SL-` references
- [x] `Withdrawal.stream` gains `venue_beverages` + a `venue` ref; same model,
      same approval queue, third pool
- [x] `financeService.calculateVenueBalance` — a sibling of
      calculateOrganizerBalance, not a branch inside it
- [x] `concessionBasketService` gains `priceVenueBasket` / `fulfilVenueBasket`;
      every priced basket now states its `salesContext`
- [x] `/api/venues/*` — admin CRUD, `/me`, line-up, sales, dashboard, finance
- [x] Frontend: `/venue` area, admin **Venues** and **Venue sales** tabs
- [x] `npm run migrate:venues` — stamps `salesContext:"EVENT"` on the existing
      ledger and builds the new indexes. Idempotent.

### Why a separate ledger, not a discriminator

`BeverageSale` is read by aggregations that carry no ownership filter at all —
`getAdminBeverageFinance` matches nothing but `validBeverageSaleMatch("ETB")`.
Behind one collection, every one of those call sites *and every future one* would
have to remember to exclude venue rows, or venue money lands in an organizer's
balance and gets paid out. A separate collection makes that unwritable rather
than merely forbidden.

What is **not** duplicated is the arithmetic: both channels compute commission,
VAT and the owner's share through `buildBeverageRevenueExpressions()` in
`utils/beverageRevenueQuery.js`. Separate ledgers, shared machinery — the same
rule `Withdrawal.stream` follows on the payout side.

**Verified on the local bench (45 checks, all passing):**

```
event 10 x 100 -> PZB-SL-, salesContext EVENT     PASS
venue  5 x 120 -> PZV-SL-, salesContext VENUE     PASS
same drink, 100 at the event and 120 at the venue PASS
organizer gross 1000 (excludes the venue sale)    PASS
venue gross      600 (excludes the event sale)    PASS
venue net 579.30 = 600 less 3.45%                 PASS
covered venue: 100 -> 81.55, 15.00 VAT withheld   PASS
venue withdrawal moves only the venue pool        PASS
organizer beverage withdrawal leaves venue alone  PASS
basket rejects a line from another venue          PASS
fulfil refuses lines from another venue           PASS
refund returns stock, leaves the row as history   PASS
no venue field in the event ledger, or the reverse PASS
```

---

## B3 — Generalize to concessions

**~2 days · do before cinema**

Popcorn and snacks are beverages with a different label. Add the category rather
than a parallel model.

- [ ] `category: "drink" | "snack" | "combo"` on the catalogue
- [ ] Combos: one price, decrements each component's stock on redemption
- [ ] Optional rename `Beverage*` → `Concession*` — cheapest now, while the
      feature is days old and carries almost no data

**Open question:** are combos priced independently, or summed from components?

---

## C1/C2 — The cinema channel

**DONE** (2026-08-16) — except the online checkout, which waits on B2.

> **The design note that used to sit here has been overturned.** It read: *"a
> cinema is an organizer with extra capability, not a separate tenant… screenings
> are `Event.kind: 'screening'`."* Kaleab decided the opposite on 2026-08-16:
> **a cinema is a separate tenant and a screening is NOT an Event.** Recorded
> here so no future chat re-derives the old shape from a stale note.
>
> Rationale for the change: a dummy/`kind`-tagged Event puts cinema takings
> inside every "what did my events earn?" figure on the platform, and fills the
> public events listing with thirty showings of one film. The separation is the
> feature.

```
Beverage ─┬─ EventBeverage  ── Event  ── Organizer      (event channel)
          ├─ VenueBeverage  ── Venue  ── Venue account  (venue channel)
          └─ CinemaBeverage ── Cinema ── Cinema account (cinema channel)

Ticket       ── Event                                   (event channel)
CinemaTicket ── CinemaShowtime ── CinemaMovie ── Cinema (cinema channel)
```

- [x] `User.role` gains `"cinema"`; the business lives in a `Cinema` model the
      account owns. Auth, JWT, ban handling and `restrictTo` unchanged.
- [x] `restrictTo` audit done — `"cinema"` was added to exactly three shared
      routes (`POST /api/withdrawals`, the payout-history read, and the existing
      beverage finance read). **Not blanket-added.**
- [x] `Cinema` carries TWO rates — `ticketCommissionRate` and
      `beverageCommissionRate` — because unlike a venue it sells two things, and
      the cut on a seat is a different negotiation from the cut on popcorn.
      Plus `coversCinemaVat`, eligibility, and a `blockedBeverages` deny list.
- [x] `CinemaHall`, `CinemaMovie`, `CinemaShowtime` (tiers priced per screening,
      not per film), `CinemaTicket`, `CinemaBeverage`, `CinemaBeverageSale`
- [x] Own ledgers (`PZC-SL-` references), own revenue readers, rates snapshotted
      per sale exactly as the other channels do
- [x] **Two pools, not one**: `Withdrawal.stream` gains `cinema_tickets` and
      `cinema_beverages`, plus a `cinema` ref. Seat money cannot fund a
      concession payout. Same model, same admin queue.
- [x] Cinema dashboard at `/cinema` — overview, programme, tickets,
      concessions, money
- [x] Admin → Cinema page
- [x] Atomic seat claim on the tier's `sold` counter — verified with 8
      concurrent buyers against 5 seats: exactly 5 sold, no oversell
- [x] Cinema QR reuses `qrRenderer`, with a `ctx:"CINEMA"` payload so an event
      scanner rejects a cinema ticket as the wrong kind rather than "not found"
- [ ] **Online ticket checkout** — box-office selling works end to end; buying a
      cinema ticket online needs the same payment wiring B2 is waiting on
- [ ] Bulk "schedule screenings" tool — one film, many showtimes
- [ ] Customer-facing browse/buy pages (the public API is in place)

**Pazimo Capital does not reach cinema money.** Advances are underwritten
against event ticket revenue; a cinema has none. Same rule as venues.

**Built before the ledger, deliberately.** The old note sequenced this after
REBUILD_PLAN Phase 3 so commission/VAT/balance would apply automatically. With
separate tenancy that argument inverts: the cinema ledgers are their own
collections, so they cannot pollute the aggregations the ledger was meant to
protect. The arithmetic is still shared — `config/rates.js` and
`beverageRevenueQuery.buildBeverageRevenueExpressions` are used by all three
channels, so a change to how VAT is charged still has one home.

---

## C3 — Seats

**After C2 · required, not optional**

**Seats are confirmed as required** — Kaleab, 2026-08-13. Screenings are built on
tier/capacity first (done); the seat layer goes on top. `CinemaShowtime`'s tiers
already carry an atomic `sold` counter, so the hold discipline below is that same
rule applied per seat rather than per tier.

- [ ] `CinemaHall.seatMap` — rows, numbers, and per-seat tier
- [ ] `SeatHold` with a TTL index so abandoned checkouts release automatically
- [ ] Atomic hold claim, same discipline as the seat-tier decrement: re-verify
      availability inside the write, never read-then-write
- [ ] Seat picker UI
- [ ] `CinemaTicket.seat` snapshot

---

## Still unanswered

- [ ] Pre-bought drinks: ticket QR, or separate redemption code?
- [ ] Combos: independent price, or summed from components?
- [ ] Do cinemas get Pazimo Capital advances?
- [x] Seat selection — **required**, sequenced as its own phase C3 after C2
