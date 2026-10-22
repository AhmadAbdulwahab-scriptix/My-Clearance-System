/**
 * AI Component 4: AI Clearance Assistant (RAG chatbot)
 *
 * Fires when a student asks a question about their clearance status.
 * Retrieves the student's own data (already categorized by
 * Component 3) plus anonymized similar cases, and constrains the answer
 * to only that retrieved context - no invented requirements.
 *
 * Uses Google's Gemini API to phrase the answer when GEMINI_API_KEY is
 * set. Falls back to a rule-based answer composed directly from the
 * retrieved data otherwise, so the feature still works without a key.
 */
const ClearanceItem = require('../models/ClearanceItem');
const logger = require('../utils/logger');
const gemini = require('../utils/geminiClient');

/**
 * Retrieval step: the student's complete clearance data including all items
 * (pending, approved, rejected), plus anonymized examples of how other students
 * resolved similar rejection categories.
 */
async function retrieveContext(studentId) {
  // Fetch ALL student's clearance items (not just rejected)
  const allItems = await ClearanceItem.find({
    student: studentId,
  })
    .populate('personnel', 'name officeName')
    .select('status rejectionReason rejectionCategory personnel stage unlockedAt respondedAt')
    .sort('stage');

  // Separate by status for better context
  const pending = allItems.filter(item => item.status === 'pending');
  const approved = allItems.filter(item => item.status === 'approved');
  const rejected = allItems.filter(item => item.status === 'rejected');
  const locked = allItems.filter(item => item.status === 'locked');

  // Get similar resolved cases for rejected items
  const categories = [...new Set(rejected.map((r) => r.rejectionCategory).filter(Boolean))];

  let similarCases = [];
  if (categories.length) {
    similarCases = await ClearanceItem.find({
      student: { $ne: studentId },
      rejectionCategory: { $in: categories },
      status: 'approved', // resolved cases only - shows the reason was fixable
    })
      .limit(5)
      .select('rejectionCategory');
  }

  return { pending, approved, rejected, locked, similarCases };
}

/**
 * One plain sentence that says where the student stands overall.
 * It goes into the AI prompt and into the fallback answer, so a question
 * like "am I done?" always has a clear answer to work from.
 */
function overallStatus(context) {
  const { pending, approved, rejected, locked } = context;
  const total = pending.length + approved.length + rejected.length + locked.length;

  if (total === 0) {
    return 'The student has not started clearance yet (no request on record).';
  }
  if (approved.length === total) {
    return `CLEARANCE COMPLETE: all ${total} offices have approved. Nothing is left to do.`;
  }
  return (
    `CLEARANCE IN PROGRESS: ${approved.length} of ${total} offices have approved. ` +
    `${pending.length} pending, ${rejected.length} rejected, ${locked.length} locked.`
  );
}

/**
 * Plain-text answer built straight from the data. It is only used when the
 * AI is not available, so it must still answer the student clearly.
 */
function ruleBasedAnswer(question, context) {
  const { pending, approved, rejected, locked } = context;
  const total = pending.length + approved.length + rejected.length + locked.length;

  if (!total) {
    return `You don't have any clearance request on record. Submit a clearance request to begin the approval process.`;
  }

  // Everything approved: say so clearly and stop.
  if (approved.length === total) {
    return `Your clearance is complete. All ${total} offices have approved, and you can print your certificate from the My clearance page.`;
  }

  let summary = `You have ${approved.length} of ${total} approvals so far.\n`;

  if (approved.length) {
    summary += `Approved (${approved.length}): ${approved.map((a) => a.personnel?.officeName || 'office').join(', ')}\n`;
  }

  if (pending.length) {
    summary += `Pending (${pending.length}): ${pending.map((p) => p.personnel?.officeName || 'office').join(', ')}\n`;
  }

  if (rejected.length) {
    summary += `Rejected (${rejected.length}):\n`;
    rejected.forEach((r) => {
      const office = r.personnel?.officeName || 'an office';
      summary += `  - ${office}: "${r.rejectionReason}"\n`;
    });
    summary += `You can resubmit rejected items with updated information.\n`;
  }

  if (locked.length) {
    summary += `Locked (${locked.length}): waiting for earlier stages to be approved.\n`;
  }

  return summary;
}

async function llmAnswer(question, context) {
  const { pending, approved, rejected, locked, similarCases } = context;

  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const SLA_DAYS = 7;

  // The overall status comes first, so the AI never has to count offices itself.
  let contextText = `OVERALL STATUS: ${overallStatus(context)}\n\nStudent's clearance items:\n\n`;

  if (approved.length) {
    contextText += `APPROVED (${approved.length}):\n`;
    approved.forEach((a) => {
      contextText += `- ${a.personnel?.officeName || 'Office'} (Stage ${a.stage}): Approved\n`;
    });
    contextText += `\n`;
  }

  if (pending.length) {
    contextText += `PENDING (${pending.length}):\n`;
    pending.forEach((p) => {
      const daysWaiting = p.unlockedAt ? Math.floor((now - p.unlockedAt) / MS_PER_DAY) : 0;
      const estimate = Math.max(0, SLA_DAYS - daysWaiting);
      contextText += `- ${p.personnel?.officeName || 'Office'} (Stage ${p.stage}): Waiting ${daysWaiting} days, estimated ${estimate} days remaining\n`;
    });
    contextText += `\n`;
  }

  if (rejected.length) {
    contextText += `REJECTED (${rejected.length}):\n`;
    rejected.forEach((r) => {
      contextText += `- ${r.personnel?.officeName || 'Office'} (Stage ${r.stage}): "${r.rejectionReason}" [Category: ${r.rejectionCategory || 'Other'}]\n`;
    });
    contextText += `\n`;
  }

  if (locked.length) {
    contextText += `LOCKED (${locked.length}): These items are waiting for earlier stages to complete before becoming actionable.\n\n`;
  }

  const similarText = similarCases.length
    ? `Note: ${similarCases.length} other students resolved similar rejection categories and were later approved.\n`
    : '';

  const prompt = `You are the clearance assistant for Bayero University Kano's student clearance system, and you chat like a friendly person, not like a form. Be natural, warm and a little relaxed. Always answer what the student actually asked first, and use their data below whenever it helps.

  You can chat about whatever the student brings up: greetings, thanks, small talk, general questions. No need to make a big deal of it. If you are not sure about something, say so honestly. If the chat drifts far from clearance, just stay helpful and mention that clearance is what you know best.

  The one firm rule: when it is about THEIR clearance, stick to the data below. If it is not there, say you don't see it instead of guessing, and don't make up offices, fees or deadlines.

  Good to know: clearance goes through stages in order, and an office stays locked until earlier stages approve. A rejected item can be resubmitted with an explanation or a document link. Offices should respond within ${SLA_DAYS} days. Once every office has approved, clearance is complete and the student can print their certificate from the "My clearance" page.

  Write in plain text, because the chat window does not display markdown. Use as many words as the answer needs, and always finish your answer completely.

  STUDENT DATA
  ${contextText}
  ${similarText}
  Student's message: "${question}"`;

  const text = await gemini.generateText(prompt, { maxOutputTokens: 1024, temperature: 0.8 });
  return text || ruleBasedAnswer(question, context);
}

/**
 * @param {ObjectId} studentId
 * @param {string} question
 * @returns {Promise<string>} the assistant's answer
 */
async function answerStudentQuery(studentId, question) {
  const context = await retrieveContext(studentId);

  if (process.env.GEMINI_API_KEY) {
    try {
      return await llmAnswer(question, context);
    } catch (err) {
      logger.warn('Gemini chatbot call failed, falling back to rule-based answer', err);
      return ruleBasedAnswer(question, context);
    }
  }

  return ruleBasedAnswer(question, context);
}

module.exports = { answerStudentQuery };
