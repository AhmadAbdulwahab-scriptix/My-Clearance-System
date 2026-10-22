/**
 * Simple, dependency-free logger.
 *
 * Differentiates log types (ERROR, WARN, INFO, DEBUG), timestamps every line,
 * prints to the console in color, and persists logs to disk:
 *   - logs/error.log     -> ERROR level only
 *   - logs/combined.log  -> every level
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started on port 5000');
 *   logger.warn('Officer queue is unusually long', { officerId });
 *   logger.error('Failed to save clearance item', err);
 *   logger.debug('Payload received', req.body);
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');
const COMBINED_LOG_PATH = path.join(LOG_DIR, 'combined.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = {
  ERROR: { label: 'ERROR', color: '\x1b[31m' }, // red
  WARN: { label: 'WARN', color: '\x1b[33m' },  // yellow
  INFO: { label: 'INFO', color: '\x1b[36m' },  // cyan
  DEBUG: { label: 'DEBUG', color: '\x1b[90m' }, // gray
};
const RESET = '\x1b[0m';

function timestamp() {
  return new Date().toISOString();
}

function serializeMeta(meta) {
  if (meta === undefined) return '';
  if (meta instanceof Error) {
    return ` :: meta-message: ${meta.message}\nmeta-stack: ${meta.stack}`;
  }
  try {
    return ` :: ${JSON.stringify(meta)}`;
  } catch (_err) {
    return ` :: [unserializable meta]`;
  }
}

function writeToFile(filePath, line) {
  fs.appendFile(filePath, line + '\n', (err) => {
    if (err) {
      // Avoid infinite loops by not calling logger.error here.
      // eslint-disable-next-line no-console
      console.error('Logger failed to write to file:', filePath, err.message);
    }
  });
}

function log(level, message, meta) {
  const { label, color } = LEVELS[level];
  const line = `[${timestamp()}] [${label}] ${message}${serializeMeta(meta)}`;

  // Console output (colored for readability during development)
  // eslint-disable-next-line no-console
  console.log(`${color}${line}${RESET}`);

  // Persist every log line
  writeToFile(COMBINED_LOG_PATH, line);

  // Persist error-level lines separately so they're easy to scan/alert on
  if (level === 'ERROR') {
    writeToFile(ERROR_LOG_PATH, line);
  }
}

module.exports = {
  error: (message, meta) => log('ERROR', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  info: (message, meta) => log('INFO', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta),
};
