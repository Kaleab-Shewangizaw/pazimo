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
- **Answered 2026-09-16: both still in review, not live yet.** Neither
  `ORGANIZER_LOGIN_OTP_ENABLED` nor `REGISTER_PHONE_OTP_ENABLED` has been
  touched in production — only the local `backend/.env` was changed this
  session (git-ignored, doesn't travel with `git push`). **Do not flip either
  flag in the production `.env` until the user confirms the corresponding
  app store release has gone through** — ask again rather than assuming time
  has passed.

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
- [ ] **Blocked, not a code task**: both app-store submissions are still in
      review as of 2026-09-16 (confirmed with the user). Ask again before
      flipping `ORGANIZER_LOGIN_OTP_ENABLED=true` /
      `REGISTER_PHONE_OTP_ENABLED=true` in the **production** `.env` on the
      VPS (see pazimo-deployment memory for paths/PM2 names) — once
      confirmed live, restart the backend, smoke-test one real organizer
      login and one real customer signup.
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
