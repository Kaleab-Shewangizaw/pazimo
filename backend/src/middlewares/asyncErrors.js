/**
 * Routes rejected promises from async route handlers into Express's error
 * middleware. Require once, before any route is registered.
 *
 * WHY THIS EXISTS
 *
 * Express 4 wraps each handler in a plain try/catch (see
 * express/lib/router/layer.js, `Layer.prototype.handle_request`). That catches
 * a synchronous `throw`. It cannot catch an async one: an `async` function does
 * not throw, it returns a promise that rejects, and nothing was looking at it.
 *
 * Nearly every controller in this codebase is `async` and signals failure by
 * throwing a typed error from `errors/` that carries a `statusCode`. Before
 * this shim, none of those reached the error middleware in app.js. What
 * actually happened, confirmed by experiment on 2026-08-20:
 *
 *   1. the controller throws BadRequestError
 *   2. the promise rejects with nobody listening
 *   3. process.on("unhandledRejection") in server.js logs it and — by design,
 *      to avoid crashing on a non-critical error — keeps the process alive
 *   4. no response is ever written, so THE REQUEST HANGS until the client or a
 *      proxy gives up
 *
 * So the failure mode was not a 400 and not a crash. It was a silent hang, on
 * every validation error in the API, holding a socket open each time. The
 * typed errors, their status codes and the error middleware were all
 * unreachable code for async handlers.
 *
 * This is the same patch the `express-async-errors` package applies, kept local
 * so it is one readable file with no new dependency and can be removed by
 * deleting one require.
 *
 * Remove when the API moves to Express 5, which awaits handler promises itself.
 */

const Layer = require("express/lib/router/layer");

const originalHandleRequest = Layer.prototype.handle_request;

Layer.prototype.handle_request = function handleRequestAwaitingRejections(req, res, next) {
  const fn = this.handle;

  // Arity > 3 means an error-handling middleware, which travels a different
  // path (`handle_error`). Left exactly as Express had it.
  if (typeof fn !== "function" || fn.length > 3) {
    return originalHandleRequest.call(this, req, res, next);
  }

  let result;
  try {
    result = fn.call(this, req, res, next);
  } catch (error) {
    return next(error);
  }

  // Only async handlers return a thenable. Sync ones are untouched, so this
  // changes nothing for the handlers that were already working.
  if (result && typeof result.then === "function") {
    // `next` is called with the rejection reason, exactly as a sync throw
    // would. Guarded against a handler that rejects with a falsy value, which
    // would otherwise read as "no error" and fall through to the 404.
    result.then(undefined, (error) =>
      next(error || new Error("Request handler rejected without an error"))
    );
  }

  return result;
};

module.exports = { Layer };
