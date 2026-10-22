/**
 * Thin wrapper around nodemailer so the rest of the app can just call
 * sendEmail(to, subject, text) without knowing about transport config.
 *
 * Configure via .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * If SMTP_HOST is not set, sendEmail() is a no-op (logged, not thrown) so
 * the app still runs end-to-end in local/dev without a mail account.
 */
const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transporter;
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} [html] - optional HTML body
 */
async function sendEmail(to, subject, text, html) {
  const t = getTransporter();
  if (!t) {
    logger.debug(`Email not sent (SMTP not configured): ${subject} -> ${to}`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@clearance.local',
      to,
      subject,
      text,
      html, // HTML body if provided
    });
    return true;
  } catch (err) {
    logger.error(`Failed to send email to ${to}`, err);
    return false;
  }
}

module.exports = { sendEmail };