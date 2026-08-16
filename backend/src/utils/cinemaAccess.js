const mongoose = require("mongoose");
const Cinema = require("../models/Cinema");
const { NotFoundError, ForbiddenError } = require("../errors");

// One definition of "which cinema is this caller allowed to act as".
//
// Every cinema route resolves its target through here rather than reading an id
// from the request, because the two callers have opposite rules and mixing them
// up is how one cinema ends up editing another:
//
//   cinema account — may only ever act as the cinema its account owns. The id in
//                    the URL is IGNORED, not merely checked, so no parameter a
//                    client can change selects a different cinema.
//   admin          — may act as any cinema, named by the id in the URL.
//
// Because the cinema branch never reads client input, a route behind it cannot
// be pointed at another cinema even if a future handler forgets to compare ids.

/**
 * The cinema document the caller may act on.
 *
 * `paramCinemaId` is only consulted for admins. Cinema accounts always resolve
 * to their own cinema regardless of what was passed.
 */
const resolveCinema = async (req, paramCinemaId) => {
  if (req.user?.role === "cinema") {
    // requireCinemaAccount has already loaded and verified this from the
    // database on this request; re-reading it here would be a second query for
    // the same answer.
    if (req.cinema) return req.cinema;

    const cinema = await Cinema.findOne({ account: req.user.userId });
    if (!cinema) {
      throw new ForbiddenError("This account is not linked to a cinema.");
    }
    return cinema;
  }

  if (req.user?.role === "admin") {
    if (!paramCinemaId || !mongoose.Types.ObjectId.isValid(paramCinemaId)) {
      throw new NotFoundError("Cinema not found");
    }
    const cinema = await Cinema.findById(paramCinemaId);
    if (!cinema) throw new NotFoundError("Cinema not found");
    return cinema;
  }

  // Any other role has no cinema surface at all. Reported as "not found" rather
  // than "forbidden" so probing does not confirm which cinemas exist.
  throw new NotFoundError("Cinema not found");
};

/** The id alone, for the common case of scoping a query. */
const resolveCinemaId = async (req, paramCinemaId) =>
  (await resolveCinema(req, paramCinemaId))._id;

/**
 * Guard for the concession surface.
 *
 * Selling seats is what a cinema is for, so ticket routes are not gated by
 * eligibility. Selling drinks and snacks is the added privilege an admin grants,
 * exactly as it is for an organizer and a venue — and it is read from the cinema
 * document on every request, never from the JWT, so revoking it takes effect
 * immediately rather than when a token expires.
 *
 * Admins are not subject to it: an admin managing a cinema's line-up is doing
 * so on the cinema's behalf, and the eligibility flag exists to gate the cinema,
 * not the platform.
 */
const assertBeverageEligible = (cinema, req) => {
  if (req?.user?.role === "admin") return;
  if (cinema.beverageEligibility !== "eligible") {
    throw new ForbiddenError(
      "This cinema is not approved to sell concessions yet."
    );
  }
};

module.exports = { resolveCinema, resolveCinemaId, assertBeverageEligible };
