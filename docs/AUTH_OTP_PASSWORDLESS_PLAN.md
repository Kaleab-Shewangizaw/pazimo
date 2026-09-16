# Auth: passwordless ticket checkout + OTP rollout — working plan

Started 2026-09-16. Read this before touching anything in this area — it
tracks a multi-session piece of work and what's actually been verified vs.
assumed.

## Why this exists

`d3ba065` ("require sign-in for ticket purchase, drop guest checkout")
removed the old flow where a ticket buyer on the web could just fill in
name/email/phone at checkout and get an account created/logged-in inline,
no password. That broke the web checkout UX. Separately, a large chunk of
OTP infrastructure (register-phone verification, login 2FA, organizer 2FA)
had already been built on the backend and in both mobile apps, but is
sitting behind env flags that default off because — as of when they were
added — the mobile builds that know how to handle `requiresOtp` hadn't
shipped to app stores yet.

Two different concerns, tangled together:
1. Restore passwordless checkout **for the web only**, behind a flag, without
   reopening the exact NoSQL-injection hole that hit `unifiedAuth` on
   2026-09-03.
2. Turn the already-built OTP flows fully on **for both mobile apps**, and
   confirm nothing is a half-measure ("bypass") anymore.

## Current status (2026-09-16)

### ✅ Done and verified this session

- **`/tickets/ticket/initiate` and `/tickets/ticket/initiate/chapa`** — unchanged,
  still require `authenticateUser` (a real signed-in account, no guest path).
  This is "the safe route." Confirmed pazimo-mobile's `src/api/payments.ts`
  calls exactly these two paths — no mobile change needed.
- **New: `/tickets/ticket/initiate/web` and `/tickets/ticket/initiate/chapa/web`**
  (backend/src/routes/ticketRoutes.js) — same handlers as above, reused via
  `initiateSantimPayTicket`/`initiateChapaTicket`, but gated by a new
  `webCheckoutAuth` middleware instead of `authenticateUser`:
  - Bearer token present → verified exactly like `authenticateUser` (signed-in
    web users unaffected).
  - No token, `ACTIVATE_PASSWORDLESS_ROUTE=true` → looks up the account by
    phone, then email, creates one if neither matches (mirrors the old,
    pre-`d3ba065` guest-checkout code, restored from `git show d3ba065^`),
    with the `isQueryOperatorInjection` guard applied to `fullName`/`email`/
    `phoneNumber` (the exact thing that was missing when `unifiedAuth` got
    exploited — this route does the same kind of body-driven `find`/`findOne`,
    so it gets the same guard).
  - No token, flag not `"true"` → 401 `{success:false, error:"Please sign in
    to buy tickets."}`. This is the kill switch.
  - On success, the response gets a `token`/`user` field the frontend can use
    to auto-login (same shape the old code returned).
  - **Tested locally** (NODE_ENV=development to avoid hitting live SantimPay):
    injection payload → 400; flag off → 401; flag on + valid guest data →
    creates a User, returns to caller (verified in Mongo, then cleaned up);
    same phone again → finds the existing user, no duplicate.
- **Frontend**: `app/event_detail/EventDetailClient.tsx`'s `handleMobilePayment`
  now posts to `/api/tickets/ticket/initiate/web` (or `.../chapa/web`) instead
  of the plain paths. This is the only call site of the ticket-initiate
  endpoints in the web frontend (checked).
- **Env**: `backend/.env` (git-ignored, local only) now has
  `REGISTER_PHONE_OTP_ENABLED=true` and `ACTIVATE_PASSWORDLESS_ROUTE=true`.
  **Production `.env` on the VPS has NOT been touched** — see the open
  question below before deploying this.
- **Mobile app OTP flows — verified already fully built, no code changes needed:**
  - `pazimo-mobile/src/components/account/auth-sheet.tsx`: real password auth
    throughout (no "password is your phone number" shortcut), handles
    `requiresOtp` from both `/register` (→ `verify-phone` step →
    `verifyRegisterOtp`/`resendRegisterOtp`) and `/login` (→ `otp` step →
    `verifyLoginOtp`). Forgot-password flow present too.
  - `pazimo-mobile/src/app/account/security.tsx` (+ `queries/account.ts`):
    settings-screen phone verification (`sendPhoneVerifyOtp`) and the
    self-serve login-code toggle (`updateOtpPreference` / `otpEnabled`) for
    accounts created before phone verification existed. This is the
    "existing user gets asked to confirm their number" flow.
  - Per-account `otpEnabled` login 2FA (`user.otpEnabled`, in
    `authController.js login()`) needs **no env flag at all** — it already
    fires for any customer who's turned it on in Settings, independent of
    `REGISTER_PHONE_OTP_ENABLED`/`ORGANIZER_LOGIN_OTP_ENABLED`. Nothing to do
    here.
  - `pazimo-organizer-mobile/src/features/auth/LoginForm.tsx` +
    `app/(auth)/verify-otp.tsx`: fully handles `requiresOtp` from `/login`,
    routes to a dedicated verify-otp screen, enforces the expected-role check
    before even sending the OTP. Built in commit `f173467` ("add OTP
    verification screen and integrate with login flow"), several commits
    behind the current tip — not brand new.

### 🚧 Blocked on a decision only the user can make

- **`ORGANIZER_LOGIN_OTP_ENABLED`** (backend) is `false` in prod. The
  2026-09-04 comment in `authController.js` says it was left off because
  pazimo-organizer-mobile "can't be updated for ~1 week (app-store review)"
  and didn't handle `requiresOtp` yet. The code now clearly does handle it
  (see above) — but that only proves the *code in this repo* is ready, not
  that the update has actually been **approved and is live in the App
  Store/Play Store**. Flipping this before that's true locks out every
  organizer still on the old build.
- **`REGISTER_PHONE_OTP_ENABLED`** (backend) — same shape of risk for
  pazimo-mobile's registration OTP. The code is confirmed ready (see above);
  whether the build carrying it has actually reached users in production is
  the open question.
- **Answered 2026-09-16: neither app is submitted yet — both are still being
  built.** Earlier phrasing in this doc said "still in review," which is
  wrong: there's no app-store submission in flight at all right now, just
  active development. Neither `ORGANIZER_LOGIN_OTP_ENABLED` nor
  `REGISTER_PHONE_OTP_ENABLED` has been touched on the live VPS — only the
  local dev machine's `backend/.env` was changed this session, purely for
  testing (confirmed `.env` is git-ignored; never staged, committed, or
  pushed — checked `git check-ignore` before editing it, and re-checked the
  3 pushed commits afterward, neither touches it). The live VPS has its own
  separate `.env` file, not synced by git at all — untouched.
  **Do not flip either flag anywhere but local dev until the user says the
  corresponding app has actually shipped to users** — ask again rather than
  assuming time has passed; don't infer readiness from repo/commit state.

### ✅ Also done this session (frontend account creation)

- **`store/authStore.ts`**: `signup()` now handles `requiresOtp` the same
  shape `login()` already did — new `pendingRegisterOtp` state (kept
  separate from `pendingOtp`: registration completes via
  `/auth/verify-register-otp` / `/auth/resend-register-otp`, not
  `/auth/organizer/verify-otp`). Duplicate-account errors (`EMAIL_TAKEN`/
  `PHONE_TAKEN`) now carry `.code` on the thrown `Error` so callers can offer
  "sign in instead" rather than just showing the message. Also fixed: the
  `email` field in `signup()`'s param type was non-optional even though the
  backend treats it as optional; a stray duplicated `PendingOtp` interface
  removed.
- **New `app/(auth)/create-account/page.tsx`** — same visual shell as
  `/sign-in` (logo card, dark-mode tokens). Full name → split into
  firstName/lastName like mobile does, phone (`+251` prefix, 9 local
  digits), optional email, password, then an OTP step if
  `REGISTER_PHONE_OTP_ENABLED` is on. Duplicate email/phone shows a "Sign in
  instead" link rather than just an error toast.
- **`app/(auth)/sign-in/page.tsx`** footer now has three lines: "Create
  account" → `/create-account` (was missing entirely before — the only
  signup link on this page was "Contact sales" → `/organizer-registration`,
  clearly meant for organizers), "Want to sell tickets? Contact sales" (kept,
  organizer path preserved), "Back to Home".
- Typechecked (`npx tsc --noEmit`) clean for both changed/new files.

### ✅ Also done this session (organizer legacy-app bypass → flag-controlled)

`protectStrictOrTrustParamId` (backend/src/middlewares/auth.js) is the
TEMP-BYPASS-2026-07-10 shim on `GET /api/users/:id`: when no token is sent,
it trusts `req.params.id` directly for admin/organizer accounts (a known,
accepted IDOR for the already-published organizer app — a separate codebase
from pazimo-organizer-mobile — which never sends a token on this call). It
had been toggled by hand three times in six weeks (added 07-10, removed
08-20, restored 09-04 the moment prod picked up the removal and broke every
organizer on the live app) — exactly the "meant to last two days, lasted
six weeks" pattern. Now controlled by `ORGANIZER_LEGACY_APP_BYPASS_ENABLED`:
**defaults to enabled when unset**, so deploying this change alone doesn't
touch production behavior; set it to `"false"` once the old app is actually
retired, no code change needed. Tested locally both ways (flag unset →
bypass still returns organizer data with no token, same as current prod;
flag `"false"` → 401). Comments in `userRoutes.js` and
`checkPublicWriteSurface.js` updated to match.

### ✅ Also done this session (ledger dual-write gaps closed)

Pre-deploy "final recheck" of the ledger, requested 2026-09-16 alongside the
organizer bypass fix. Ran `src/scripts/reconcileLedger.js` (read-only, safe
against production per its own header — only run here against local/dev
data, no production access from this environment) and traced the
disagreement it showed back to real code gaps, not just a stale snapshot:

1. **Event ticket sales — the biggest revenue stream — were never
   live-dual-written to the ledger.** `beverageSalesService.js`,
   `venueBeverageSalesService.js`, `cinemaTicketService.js`, and
   `cinemaBeverageSalesService.js` all call `mirrorSale` on every sale; the
   real ticket-purchase path
   (`ticketController.js`'s `processSuccessfulPayment`, called from both the
   SantimPay and Chapa webhooks) had zero ledger references. The ledger's
   "tickets" stream only ever got populated by manually running
   `backfillLedger.js`, which isn't scheduled anywhere — so it silently fell
   behind every sale made after the last manual run. **Fixed**: added a
   `mirrorSale` call right after `Ticket.create(ticketData)` in
   `processSuccessfulPayment`, using `ticket.commissionRate`/
   `ticket.organizerVatRate` (already snapshotted by `Ticket`'s own
   pre-save hook — same pattern `cinemaTicketService.js` uses).
2. **Organizer withdrawals never mirrored to the ledger at all.**
   `createVenueWithdrawal`/`createCinemaWithdrawal` both call
   `mirrorWithdrawal` right after creating the `Withdrawal` row;
   `createWithdrawal` (the organizer path — the most common one) didn't.
   **Fixed**: added the same `mirrorWithdrawal` call there.
3. **A rejected withdrawal never reversed its ledger entry**, for any owner
   kind. `mirrorWithdrawal` has a `reversal` flag built for exactly this,
   but nothing ever called it — every withdrawal creation mirrors an
   immediate "pending" deduction (before an admin ever looks at it), so a
   later rejection left the ledger permanently short by that amount versus
   the real (old-formula) balance. **Fixed**: `updateWithdrawalStatus` now
   fires `mirrorWithdrawal({ reversal: true })` on an actual
   pending/approved→rejected transition (guarded so it can't double-fire on
   an already-rejected row), resolving the right owner kind/stream from
   whichever of `withdrawal.cinema`/`withdrawal.venue`/`withdrawal.organizer`
   is set.

**Verified, not just written:**
- Reconciler before any fix, on local data: 2 real disagreements
  (organizer tickets -50.30 ETB, organizer beverages -16.08 ETB) — script's
  own verdict: "NOT AGREED — do not cut reads over."
- Re-ran `backfillLedger.js --write` to catch the pre-existing local gap
  (this is exactly what production needs too, separately, once these fixes
  are deployed — the live code only prevents the gap from growing further,
  it doesn't retroactively fill what's already missing), then re-ran the
  reconciler: **"AGREED — safe to keep dual-writing," 0 disagreements.**
- Directly exercised `mirrorWithdrawal`'s reversal round-trip against
  `LedgerBalance` (bypassing HTTP/auth, model-level): withdrawn goes
  0 → 10,000 minor units → 0, available goes 0 → -10,000 → 0, exactly as
  designed.
- `node -c` on both changed files, and both controllers `require()`
  successfully with no circular-dependency errors.

**Still true after these fixes, unchanged**: owner-facing reads and the
withdrawal eligibility check still run on the old formulas, not the ledger
— none of this touched real user-facing balances, and none of it blocked
today's deploy. It closes the gap for whenever the "switch reads to
LedgerBalance" step (still on P3's own TODO list in PAZIMO_PLAN.md) is
actually attempted.

**Not done**: `mirrorRefund` is defined in `ledgerDualWrite.js` but still
never called anywhere — no stream's refunds reach the ledger yet. Lower
urgency (refunds are rarer, and none of the reconciler's disagreements
traced to this), but worth the same treatment eventually.

**Production still needs, separately, once this is deployed**: run
`backfillLedger.js --write` on the VPS to catch the real gap that's
accumulated there since 2026-08-20 (this environment has no production DB
access to do it from here), then run `reconcileLedger.js` there to confirm
it agrees on the real numbers — a local "AGREED" proves the code is
correct, not that production's ledger is caught up.

### ✅ Also done this session (production ledger verified against real numbers, 2 more real bugs found and fixed)

The user gave a **read-only** production credential
(`mongodb+srv://read_only:...@cluster0.psywky.mongodb.net`, the cluster
documented in the pazimo-money-facts memory) and asked for a full check that
every ledger number is right, plus confirmation that no organizer/event has
ever had a special commission/VAT deal (answer: no, confirmed — every
Event/Ticket in production has `commissionRate`/`coversOrganizerVat` as
`null`, meaning every figure relies on the code's 3%/15%/0% defaults; both
the old formula and the ledger apply that fallback identically via safe
`$ifNull`/`??` handling, so this is not a source of disagreement, just an
unused admin feature — `PATCH /api/admin/commission/events/:eventId`).

**Ran the reconciler directly against production** (read-only,
`reconcileLedger.js` is explicitly safe for this per its own header): 49
disagreements, every single one a "tickets" stream row reading exactly
**0.00 ETB** in the ledger against real balances up to 107,211.81 ETB —
confirmed the "event tickets never live-mirrored" gap from earlier in this
session is real and currently live in production, not just theoretical.

**Then synced a local mirror** (`mongodb://localhost:27017/pazimo_mirror` —
already existed as a snapshot from the original 2026-08-20 ledger work,
27 days stale) with production's `events`/`tickets`/`payments`/
`withdrawals`/`users`/`loans`/`organizercapitalprofiles`/
`organizerregistrations` collections (upsert by `_id`, read-only from prod,
writes only to the local mirror), then ran the actual remediation
(`backfillLedger.js --write`) there — never against production, which this
environment only has read access to.

That surfaced **two further, genuinely new bugs** (distinct from the "never
mirrored at all" gap already fixed in `ticketController.js`/
`withdrawalController.js`), both now fixed in `backfillLedger.js` and
pushed (commit `0063166`):

1. **Stale ticket_sale entries never retracted.** A ticket can pass the
   revenue filter when first backfilled and later flip to `expired` (a
   `paymentHold.js` sweep discovering it was never actually paid for) —
   the ledger, being append-only and correctly idempotent for rows that
   *stay* valid, had no mechanism to reverse one that stops being valid.
   Affected 3 organizers, 19 stale ticket rows, ~7,300 ETB.
2. **`loan_repayment` froze on the first backfill.** Keyed by
   organizer+currency alone, so a re-run found the key already claimed and
   silently skipped — even as the real repayment total kept growing from
   later ticket sales. One organizer's ledger balance was overstated by
   **103,120 ETB** from this alone.

**Also made and fixed a mistake worth recording**: the first version of the
ticket-invalidation correction summed *every* ledger entry sharing a
`source.ticket` reference without filtering by owner — but `recordSale`
writes to two owners per sale (the seller, and a platform-only mirrored
commission entry). This double-counted the platform's commission into the
seller's reversal, overshooting by exactly the commission amount. Caught by
re-running the reconciler (it disagreed again, in the opposite direction,
by a much smaller amount) rather than assuming success. Fixed by grouping
reversals by owner. A related cleanup mistake (passing a JSON-round-tripped
owner with a string `id` to `rebuildBalance`, which matched nothing in the
raw aggregation `$match` — no schema casting there, unlike `.find()` — and
silently zeroed 3 organizers' balance projections) was caught the same way
and fixed by rebuilding with real `ObjectId` instances.

**Final state, verified**: reconciler on the fully-synced, fully-corrected
mirror: **"AGREED — safe to keep dual-writing"**, 0 disagreements, 136 exact
matches, 12 within the documented per-transaction rounding tolerance.

**What production still needs** (this environment cannot do any of this —
read-only there):
- [ ] Deploy this branch (adds the live ticket-sale/withdrawal dual-write,
      and the corrected `backfillLedger.js`).
- [ ] Run `node src/scripts/backfillLedger.js --write` on the VPS with the
      now-fixed script — this both catches up the historical gap AND
      applies the stale-ticket-reversal/loan-repayment-delta corrections in
      one pass.
- [ ] Run `node src/scripts/reconcileLedger.js` on the VPS afterward and
      confirm it says "AGREED" on the real numbers, the same way it now
      does on the mirror.
- [ ] Noticed but out of scope for this pass: `backend/.env`'s
      `MONGODB_URI` was hand-edited to `mongodb://localhost:27017/
      pazmimo_mirror` (transposed letters — the real local mirror db is
      spelled `pazimo_mirror`). Didn't fix it myself since it's a file the
      user was actively editing; flagging in case it was a typo rather than
      deliberate.

### ✅ Also done this session (VAT policy held back, every money display now agrees)

The user pasted real numbers from the live production dashboard alongside
this branch's numbers on the synced mirror — they didn't match, by enough
money (hundreds of thousands of ETB) to be a trust problem if deployed as
was. Traced to three separate causes, all now fixed and pushed (`20d4913`):

1. **The organizer's real deduction has been 3.45% (3% commission + 15% VAT
   on it) in this codebase since Aug 11-13 (`fbaeb25`/`3d0d65f`), but
   production has never deployed it** — confirmed arithmetically against a
   real production pull (it matches flat 97% exactly). Asked the user
   directly whether this was meant to go live: **answer was no, hold it
   back**. `VAT_RATE` is now `0` in `backend/src/config/rates.js` — the
   single source every formula and the ledger derive from, so nothing else
   needed to change. Re-enabling later is a one-line change back to `0.15`.
2. **`ledgerReadService.js`'s "ownerRevenue"** (the ledger card's "Seller
   earned" / "Available, all pools") was sourced from `netMinor`, which also
   carries Pazimo Capital loan movements — correct for `availableBalance`,
   wrong for a field meant to mean "revenue earned." Off by the net loan
   position (~23,000 ETB on the mirror). Fixed to `gross - commission - vat
   - ownerVat`, matching every other revenue reader.
3. **`getDashboardStats`/`getCommissionSummary` counted tickets whose event
   had since been deleted** — the ledger correctly has no owner to mirror
   an orphaned ticket onto and drops it; these two didn't have the
   equivalent check. 146 tickets / ~4,300 ETB. Both now scope to
   currently-existing events.

**Verified, not assumed**: after all three fixes, directly compared (not
through the browser — called the actual controller logic against the
mirror) dashboard stats, the ledger partition card, the ledger totals row,
and the platform commission figure — all agree **to the cent**. Reconciler:
148/148 exact, 0 disagreements, unchanged from before these fixes (they
didn't touch per-organizer balance math, only the platform-wide/display
layer, so re-confirming this was a real regression check, not a formality).

Also fixed in the same pass: the local dev backend needed a restart to pick
up `rates.js` (nodemon doesn't restart on `.env` changes, and the `.env`
`pazmimo_mirror` → `pazimo_mirror` typo from earlier had already been
corrected by the user by the time this was checked). And: the commission-
by-event admin table had a hardcoded `limit=20` with no page param and no
controls, despite the backend already supporting real pagination — wired up
in `CommissionPanel.tsx` using the existing `PaginationControls` component.

**Still true**: none of this has touched production. Every verification in
this session used either the read-only production credential (never
writes) or the local `pazimo_mirror` (fully synced, safe to write).
Deploying this branch is still a separate, deliberate step — see the
production checklist below.

### 📋 Still to do

- [ ] **Ticket-purchase dialog fallback when `ACTIVATE_PASSWORDLESS_ROUTE` is
      `false`.** Right now that case just surfaces the 401
      "Please sign in to buy tickets." as a toast — no way to actually buy.
      Needs: inline password-based login/create-account form in the same
      payment modal in `EventDetailClient.tsx`, plus a "forgot password" path
      for someone who already has an account under that phone number, all
      without leaving the dialog. Should reuse the same `/auth/login`,
      `/auth/register` + `requiresOtp` handling, `/auth/forgot-password` flow
      the sign-in/create-account pages now use — not a third parallel
      implementation. The create-account page's OTP-step JSX is a reasonable
      template to lift from.
- [ ] **Blocked, not a code task**: as of 2026-09-16, neither mobile app has
      even been submitted to an app store yet — both still under active
      development (confirmed with the user; earlier note in this doc saying
      "in review" was wrong). Ask again before flipping
      `ORGANIZER_LOGIN_OTP_ENABLED=true` / `REGISTER_PHONE_OTP_ENABLED=true`
      on the live VPS's own `.env` (see pazimo-deployment memory for
      paths/PM2 names — it's a separate file from this repo's, not touched
      by git at all) — once confirmed live, restart the backend, smoke-test
      one real organizer login and one real customer signup.
- [ ] Decide whether `ACTIVATE_PASSWORDLESS_ROUTE=true` actually ships to
      production, or stays a local-only convenience — the user asked for the
      flag to exist and default the web to old behavior, but hasn't said
      whether prod should run with it on indefinitely or only temporarily
      while the dialog fallback (above) doesn't exist yet.
- [ ] Push the branch (`feat/beverage-revenue-and-withdrawals`) once the
      current chunk of work is in a committable state — nothing has been
      pushed yet this session.

## Key files

- `backend/src/routes/ticketRoutes.js` — `webCheckoutAuth`,
  `initiateSantimPayTicket`/`initiateChapaTicket`, the four routes.
- `backend/src/controllers/authController.js` — `register`, `login`,
  `verifyRegisterOtp`, `resendRegisterOtp`, `sendPhoneVerifyOtp`,
  `verifyPhoneNumber`, `updateOtpPreference`, `verifyOrganizerOtp`,
  `unifiedAuth`.
- `backend/src/utils/rejectQueryOperators.js` — the injection guard; read its
  header comment before touching any route that builds a Mongo filter from
  `req.body`.
- `backend/.env` — `REGISTER_PHONE_OTP_ENABLED`, `ORGANIZER_LOGIN_OTP_ENABLED`,
  `ACTIVATE_PASSWORDLESS_ROUTE` (git-ignored — production has its own copy on
  the VPS, not synced by git push).
- `frontend/app/event_detail/EventDetailClient.tsx` — `handleMobilePayment`,
  the payment modal state (`showPaymentModal`, `paymentForm`).
- `frontend/app/(auth)/sign-in/page.tsx` — pattern to follow for the new
  create-account page; also where the "Create account" link goes.
- `frontend/store/authStore.ts` — `login`/`signup`/`pendingOtp`.
- `pazimo-mobile/src/components/account/auth-sheet.tsx`,
  `pazimo-mobile/src/api/auth.ts` — reference implementation for how the web
  should handle `requiresOtp` on register.
- `pazimo-organizer-mobile/src/features/auth/LoginForm.tsx`,
  `.../app/(auth)/verify-otp.tsx` — reference for the organizer OTP UX,
  already shipped in-repo.
