const express = require('express');
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/my', getMyNotifications); // /api/notifications/my
router.patch('/:id/read', markAsRead); // /api/notifications/:id/read
router.patch('/mark-all-read', markAllAsRead); // /api/notifications/mark-all-read

module.exports = router;