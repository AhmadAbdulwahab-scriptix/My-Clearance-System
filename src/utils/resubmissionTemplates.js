/**
 * Contextual placeholders for resubmission notes based on rejection category
 */
const RESUBMISSION_PLACEHOLDERS = {
  'Missing Document': {
    icon: '📄',
    placeholder: 'What document did you upload? (e.g., Final transcript, Medical clearance, Hostel registration)',
    hint: 'Tell us which document you\'ve provided to resolve this issue.',
    tone: 'conversational',
  },
  'Unpaid Fee': {
    icon: '💰',
    placeholder: 'How much was sent and for what? (e.g., ₦50,000 for hostel charges, ref: TXN123456)',
    hint: 'Let us know the payment details so we can verify.',
    tone: 'conversational',
  },
  'Disciplinary': {
    icon: '⚖️',
    placeholder: 'What\'s your explanation? (e.g., I\'ve completed probation, all requirements satisfied)',
    hint: 'Provide context on how you\'ve resolved the disciplinary issue.',
    tone: 'conversational',
  },
  'Other': {
    icon: '✏️',
    placeholder: 'Tell us how you\'ve fixed this. Any additional context helps!',
    hint: 'Explain what you\'ve done to address the rejection.',
    tone: 'conversational',
  },
};

/**
 * Generate a resubmission form section dynamically
 * Call this when a student views a rejected item
 */
function getResubmissionForm(rejectionCategory = 'Other') {
  const config = RESUBMISSION_PLACEHOLDERS[rejectionCategory] || RESUBMISSION_PLACEHOLDERS['Other'];

  return {
    category: rejectionCategory,
    icon: config.icon,
    placeholder: config.placeholder,
    hint: config.hint,
    tone: config.tone,
  };
}

module.exports = {
  RESUBMISSION_PLACEHOLDERS,
  getResubmissionForm,
};
