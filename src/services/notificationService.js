/**
 * Every notification in the system goes through here. Two channels:
 *   1. In-app - a Notification document the recipient sees on their
 *      dashboard once logged in (this is a web app, so there is no native
 *      mobile push).
 *   2. Email - a best-effort copy sent via emailClient, so personnel don't
 *      have to be logged in to find out something needs their attention.
 * Email failures never block the in-app notification or the calling
 * workflow (an approval should still succeed even if SMTP is down).
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const emailClient = require('../utils/emailClient');
const logger = require('../utils/logger');
const { generateEmailHTML } = require('../templates/emailTemplates');

const EMAIL_SUBJECTS = {
  clearance_pending: 'Clearance item awaiting your review',
  clearance_approved: 'Your clearance item was approved',
  clearance_rejected: 'Your clearance item was rejected',
  clearance_completed: 'Your clearance is complete',
  delay_reminder: "You've kept a student waiting on clearance",
};

async function notify(recipientId, type, message, relatedItemId = null, emailData = {}) {
  let notification = null;

  try {
    notification = await Notification.create({
      recipient: recipientId,
      type,
      message,
      relatedItem: relatedItemId,
    });
  } catch (err) {
    // Notification failures shouldn't break the main workflow (e.g. an
    // approval should still succeed even if the notification write fails),
    // so we log and swallow rather than throw.
    logger.error('Failed to create notification', err);
  }

  // Best-effort email alongside the in-app notification. Never throws.
  try {
    const recipient = await User.findById(recipientId).select('email name role');;
    if (recipient && recipient.email) {
      const subject = EMAIL_SUBJECTS[type] || 'Clearance system notification';

      // Generate beautiful HTML email
      const htmlBody = generateEmailHTML(type, {
        ...emailData,
        studentName: emailData.studentName || (recipient.role === 'student' ? recipient.name : undefined),
        personnelName: emailData.personnelName || recipient.name,
        recipientRole: recipient.role,
        message,
      });
      console.log(`${emailData.studentName}, ${emailData.personnelName}`);

      await emailClient.sendEmail(recipient.email, subject, message, htmlBody);
    }
  } catch (err) {
    logger.error('Failed to send notification email', err);
  }

  return notification;
}

module.exports = { notify };

