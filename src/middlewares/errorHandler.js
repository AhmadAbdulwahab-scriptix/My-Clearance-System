const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

/**
 * Catches requests to routes that don't exist and forwards a 404 ApiError
 * into the standard error pipeline instead of letting Express's default
 * HTML 404 page render.
 */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Normalizes known Mongoose errors into ApiError instances so the client
 * always receives a consistent, predictable error shape.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Validation failed', details);
  }

  // Mongoose invalid ObjectId / bad cast
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for field "${err.path}"`);
  }

  // Mongo duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`Duplicate value for "${field}"`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid authentication token');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Authentication token expired');
  }

  // Fallback: unexpected/programming error
  return ApiError.internal(err.message || 'Something went wrong');
}

/**
 * Single place where every error in the app ends up. Logs appropriately
 * (full stack for unexpected errors, concise line for operational ones)
 * and returns a clean JSON error response.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);
  const { statusCode, message, isOperational, details } = apiError;

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
  };

  if (isOperational) {
    logger.warn(`Handled error: ${message}`, logMeta);
  } else {
    logger.error(`Unexpected error: ${message}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === 'development' && !isOperational
      ? { stack: err.stack }
      : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };