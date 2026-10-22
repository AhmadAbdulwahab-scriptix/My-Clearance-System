const cron = require('node-cron');
const delayReminderService = require('../services/delayReminderService');
const logger = require('../utils/logger');

/**
 * Schedules the daily delay-reminder sweep to run periodically. It checks
 * for at most one reminder per item per day internally, so this can safely
 * run more often than daily (e.g. every few hours) without spamming anyone.
 * Interval is configurable via DELAY_REMINDER_CRON in .env (default: once
 * a day at 8am).
 */
function startDelayReminderJob() {
  const schedule = process.env.DELAY_REMINDER_CRON || '0 8 * * *';

  if (!cron.validate(schedule)) {
    logger.warn(`Invalid DELAY_REMINDER_CRON expression "${schedule}", defaulting to daily at 8am`);
  }

  cron.schedule(cron.validate(schedule) ? schedule : '0 8 * * *', async () => {
    logger.info('Running scheduled delay reminder sweep...');
    try {
      await delayReminderService.runDailySweep();
    } catch (err) {
      logger.error('Delay reminder sweep failed', err);
    }
  });

  logger.info(`Delay reminder job scheduled with pattern "${schedule}"`);
}

module.exports = startDelayReminderJob;