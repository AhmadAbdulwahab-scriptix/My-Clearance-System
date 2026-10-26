/**
 * Thin wrapper so the rest of the app can just call
 * sendEmail(to, subject, text, html) without knowing how mail is sent.
 *
 * Two ways to send, chosen from .env:
 *   1. Brevo web API (over HTTPS). Set BREVO_API_KEY and BREVO_SENDER_EMAIL.
 *      Use this on hosts that block SMTP ports, such as Render's free plan.
 *   2. SMTP through nodemailer. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * If neither is set, sendEmail() does nothing (it logs and returns false) so the
 * app still runs without a mail account.
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

// Sends one email through Brevo's web API. Throws if Brevo refuses it.
async function sendWithBrevo(to, subject, text, html) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'BUK Clearance',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo responded with status ${response.status}: ${await response.text()}`);
  }
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} [html] - optional HTML body
 * @returns {Promise<boolean>} true if the email was handed to a mail service
 */
async function sendEmail(to, subject, text, html) {
  // Way 1: Brevo web API
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
    try {
      await sendWithBrevo(to, subject, text, html);
      return true;
    } catch (err) {
      logger.error(`Failed to send email to ${to} through Brevo`, err);
      return false;
    }
  }

  // Way 2: SMTP
  const t = getTransporter();
  if (!t) {
    logger.debug(`Email not sent (no mail service configured): ${subject} -> ${to}`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@clearance.local',
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    logger.error(`Failed to send email to ${to}`, err);
    return false;
  }
}

module.exports = { sendEmail };