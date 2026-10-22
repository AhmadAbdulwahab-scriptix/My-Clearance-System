const express = require('express');
const { askChatbot } = require('../controllers/chatbotController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/query', protect, authorize('student'), askChatbot); // /api/chatbot/query

module.exports = router;