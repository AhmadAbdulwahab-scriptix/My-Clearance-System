const ApiError = require('../utils/ApiError');

/**
 * A very small rate limiter: each IP address may make `max` requests every
 * `windowMs` milliseconds. The counts are kept in memory, so they reset when
 * the server restarts. That is fine for a single server.
 *
 * Usage: router.get('/path', rateLimit({ windowMs: 60000, max: 10 }), handler);
 */
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip address -> { count, resetAt }

  // Every so often, forget addresses whose time window has ended.
    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of hits) {
            if (now > record.resetAt) {
                hits.delete(ip);
            }
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const now = Date.now();
        const record = hits.get(req.ip);

        // First request, or the previous window has ended: start counting again.
        if (!record || now > record.resetAt) {
        hits.set(req.ip, { count: 1, resetAt: now + windowMs });
        return next();
        }

        record.count += 1;
        if (record.count > max) {
        return next(new ApiError(429, 'Too many attempts. Please try again in a few minutes.'));
        }
        next();
    };
}

module.exports = rateLimit;