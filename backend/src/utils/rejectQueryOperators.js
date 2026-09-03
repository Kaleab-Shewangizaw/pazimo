// Mongoose does not reject a MongoDB query-operator object (e.g. `{ $ne: null }`,
// `{ $regex: "^09" }`) passed as the value of a filter on a String path — it
// passes operator objects through to the driver mostly as-is. Any controller
// that builds a `find`/`findOne` filter directly from `req.body` (or
// `req.query`) is therefore a NoSQL injection point: a JSON body can smuggle
// an operator in place of the plain string the field is supposed to hold,
// turning an equality lookup into "match anything" or "match this regex".
//
// Real fields on this platform (email, phoneNumber, token, etc.) are always
// plain strings, so the fix is narrow: reject anything that isn't a string
// before it ever reaches a query. `undefined`/`null` pass through so optional
// fields keep working — callers that require the field still check for that
// separately.
//
// Found 2026-09-03: an attacker used exactly this on POST /api/auth/unified-auth
// (`{"phoneNumber":{"$ne":null}}`) to log in as an arbitrary existing user with
// no password, confirmed against a real customer account.
const isQueryOperatorInjection = (value) =>
  value !== null && value !== undefined && typeof value !== "string";

module.exports = { isQueryOperatorInjection };
