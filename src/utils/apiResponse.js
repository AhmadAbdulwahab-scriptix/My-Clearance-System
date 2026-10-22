/**
 * Small helper to keep success responses in a consistent shape across
 * every controller: { success, message, data }.
 */
function sendSuccess(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

module.exports = { sendSuccess };
