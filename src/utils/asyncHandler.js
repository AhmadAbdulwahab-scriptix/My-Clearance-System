/**
 * Wraps an async route handler so any rejected promise/thrown error is
 * forwarded to Express's error-handling middleware via next(), instead of
 * needing a try/catch block in every controller function.
 *
 * Usage:
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
