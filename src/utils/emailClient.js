/**
 * Thin wrapper so the rest of the app can just call
 * sendEmail(to, subject, text, html) without knowing how mail is sent.
 *
 * Two ways to send, chosen from .env:
 *   1. Gmail API (over HTTPS). Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
 *      GMAIL_REFRESH_TOKEN and GMAIL_SENDER_EMAIL. This works on hosts that
 *      block normal email ports, such as Render's free plan.
 *   2. SMTP through nodemailer. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 *      Handy on your own computer.
 * If neither is set, sendEmail() does nothing (it logs and returns false) so the
 * app still runs without a mail account.
 */
const nodemailer = require('nodemailer');
const logger = require('./logger');

/* ---------- Way 1: Gmail API ---------- */

function gmailIsConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_SENDER_EMAIL
  );
}

let cachedToken = null; // { value, expiresAt }

// Trades the long-lived refresh token for a short-lived access token (about an
// hour) and keeps it until a minute before it runs out.
async function getGmailAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60 * 1000) {
    return cachedToken.value;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    // "invalid_grant" means the refresh token died: make a new one (see the setup notes).
    throw new Error(`Google refused the refresh token: ${data.error} ${data.error_description || ''}`);
  }

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// Header values must be one line, and non-English letters need a special encoding.
function encodeHeader(text) {
  const oneLine = String(text).replace(/[\r\n]+/g, ' ');
  return /^[\x20-\x7e]*$/.test(oneLine)
    ? oneLine
    : `=?UTF-8?B?${Buffer.from(oneLine, 'utf8').toString('base64')}?=`;
}

// Builds the raw email text (plain text + optional HTML version).
function buildMime(from, to, subject, text, html) {
  const boundary = 'clearance-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const wrap = (s) => Buffer.from(String(s || ''), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

  const lines = [
    `From: ${from}`,
    `To: ${String(to).replace(/[\r\n]+/g, ' ')}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(text),
  ];

  if (html) {
    lines.push(
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      wrap(html)
    );
  }

  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

// Sends one email through the Gmail API. Throws if Google refuses it.
async function sendWithGmail(to, subject, text, html) {
  const accessToken = await getGmailAccessToken();

  const senderName = process.env.GMAIL_SENDER_NAME || 'BUK Clearance';
  const from = `${encodeHeader(senderName)} <${process.env.GMAIL_SENDER_EMAIL}>`;
  const raw = Buffer.from(buildMime(from, to, subject, text, html), 'utf8').toString('base64url');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    if (response.status === 401) cachedToken = null; // get a fresh access token next time
    throw new Error(`Gmail API responded with status ${response.status}: ${await response.text()}`);
  }
}

/* ---------- Way 2: SMTP ---------- */
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
 * @returns {Promise<boolean>} true if the email was handed to a mail service
 */
async function sendEmail(to, subject, text, html) {
  if (gmailIsConfigured()) {
    try {
      await sendWithGmail(to, subject, text, html);
      return true;
    } catch (err) {
      logger.error(`Failed to send email to ${to} through Gmail`, err);
      return false;
    }
  }

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