const express = require('express');

const authRoutes = require('./authRoutes');
const clearanceRoutes = require('./clearanceRoutes');
const notificationRoutes = require('./notificationRoutes');
const chatbotRoutes = require('./chatbotRoutes');
const adminRoutes = require('./adminRoutes');
const certificateRoutes = require('./certificateRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/clearance', clearanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/admin', adminRoutes);
router.use('/certificates', certificateRoutes);
// Simple health check
router.get('/health', (req, res) => res.json({ success: true, message: 'API is healthy' }));

module.exports = router;