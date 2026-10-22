/**
 * Custom error class for all "expected"/operational errors thrown deliberately
 * from controllers or services (e.g. validation failures, not-found records,
 * unauthorized access). Distinguishing these from unexpected programming
 * errors lets the global error handler decide how much detail is safe to
 * return to the client.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code to send
   * @param {string} message - human-readable error message
   * @param {boolean} isOperational - true for expected/handled errors
   * @param {object|null} details - optional extra context (e.g. field errors)
   */
  constructor(statusCode, message, isOperational = true, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, true, details);
  }

  static unauthorized(message = 'Not authorized') {
    return new ApiError(401, message, true);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, true);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, true);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message, true);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

module.exports = ApiError;
