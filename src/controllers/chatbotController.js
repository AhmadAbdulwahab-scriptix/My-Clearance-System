const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const chatbotService = require('../services/chatbotService');

/**
 * POST /api/chatbot/query
 * Body: { question: string }
 * Student asks a question about their own clearance status/rejections.
 */
const askChatbot = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    throw ApiError.badRequest('question is required');
  }

  const answer = await chatbotService.answerStudentQuery(req.user._id, question);

  sendSuccess(res, 200, 'Answer generated', { question, answer });
});

module.exports = { askChatbot };
