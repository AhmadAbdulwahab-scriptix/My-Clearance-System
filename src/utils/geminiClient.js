/**
 * Shared helper for calling Google's Gemini API.
 * Used by both AI Component 3 (rejection categorization) and
 * AI Component 4 (RAG chatbot).
 *
 * Requires GEMINI_API_KEY in .env. Model is configurable via
 * GEMINI_MODEL (defaults to gemini-2.0-flash).
 */
const logger = require('./logger');

const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * @param {string} prompt - the full prompt to send
 * @param {object} [options]
 * @param {number} [options.maxOutputTokens]
 * @param {number} [options.temperature]
 * @returns {Promise<string>} the model's text response
 */
async function generateText(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig = {
    maxOutputTokens: options.maxOutputTokens || 300,
    temperature: options.temperature ?? 0.2,
  };

  // Thinking is counted inside maxOutputTokens, so thinking that is not limited
  // can use up the budget and cut the visible answer short.
  if (model.startsWith('gemini-3')) {
    // Gemini 3 models: pick how much to think. 'low' is the smallest level that
    // all Gemini 3 Flash models accept ('minimal' is rejected by 3.8 Flash).
    generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  } else if (model.includes('2.5') && model.includes('flash')) {
    // Gemini 2.5 Flash can have thinking switched off completely.
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  // Other models (2.0 Flash, 2.5 Pro) are left alone: 2.0 rejects any thinking
  // setting and 2.5 Pro cannot switch thinking off.

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API responded with status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') || '';

  // Say so in the log when an answer was cut off, so it is never a mystery.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    logger.warn('Gemini answer was cut off (MAX_TOKENS). Raise maxOutputTokens or turn thinking off.', {
      model,
      usage: data.usageMetadata,
    });
  }

  if (!text) {
    logger.warn('Gemini API returned an empty response', data);
  }

  return text.trim();
}
module.exports = { generateText };