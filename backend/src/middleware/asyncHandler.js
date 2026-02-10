/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors
 * and pass them to Express error handler middleware
 * 
 * Usage:
 * const asyncHandler = require('../middleware/asyncHandler');
 * 
 * router.get('/events/:id', asyncHandler(async (req, res) => {
 *   const event = await Event.findById(req.params.id);
 *   res.json(event);
 * }));
 */

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
