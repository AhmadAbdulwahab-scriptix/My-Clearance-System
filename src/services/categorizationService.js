
/**
 * AI Component 3: Rejection Reason Auto-Categorization
 *
 * Fires the moment a personnel officer submits a rejection. Classifies the
 * free-text rejection reason into a fixed taxonomy so it can feed both the
 * admin analytics dashboard and the RAG chatbot (Component 4).
 *
 * Uses Google's Gemini API for classification.
 * Falls back to a transparent, keyword-based rule classifier otherwise, so
 * the feature still works with no external API key set.
 */
const logger = require('../utils/logger');
const gemini = require('../utils/geminiClient');
const { REJECTION_CATEGORIES } = require('../models/ClearanceItem');

const KEYWORD_MAP = {
  'Missing Document': ['document', 'certificate', 'file', 'upload', 'attach', 'form', 'transcript'],
  'Unpaid Fee': ['fee', 'payment', 'unpaid', 'owe', 'balance', 'debt', 'bill'],
  'Disciplinary': ['discipline', 'misconduct', 'violation', 'rustication', 'query', 'sanction', 'probation', 'expulsion'],
};

function ruleBasedCategorize(reasonText) {
  const lower = reasonText.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return 'Other';
}

async function llmCategorize(reasonText) {
  const prompt = `Classify the following clearance rejection reason into exactly one of these categories: 
  ${REJECTION_CATEGORIES.join(', ')}. Respond with only the category name, nothing else.\n\nReason: "${reasonText}"`;

  const text = await gemini.generateText(prompt, { maxOutputTokens: 256, temperature: 0 });
  const cleaned = text.trim();

  return REJECTION_CATEGORIES.includes(cleaned) ? cleaned : ruleBasedCategorize(reasonText);
}

/**
 * @param {string} reasonText - the free-text rejection reason from personnel
 * @returns {Promise<string>} one of REJECTION_CATEGORIES
 */
async function categorizeRejection(reasonText) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await llmCategorize(reasonText);
    } catch (err) {
      logger.warn('Gemini categorization failed, falling back to rule-based classifier', err);
      return ruleBasedCategorize(reasonText);
    }
  }
  return ruleBasedCategorize(reasonText);
}

module.exports = { categorizeRejection };