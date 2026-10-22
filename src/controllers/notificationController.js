const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Notification = require('../models/Notification');

/**
 * GET /api/notifications/my
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id }).sort('-createdAt');
  sendSuccess(res, 200, 'Notifications fetched', { notifications });
});

/**
 * PATCH /api/notifications/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found');

  if (String(notification.recipient) !== String(req.user._id)) {
    throw ApiError.forbidden('You cannot modify another user\'s notification');
  }

  notification.read = true;
  await notification.save();

  sendSuccess(res, 200, 'Notification marked as read', { notification });
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for the current user
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } }
  );

  sendSuccess(res, 200, 'All notifications marked as read', {
    modifiedCount: result.modifiedCount
  });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead };

