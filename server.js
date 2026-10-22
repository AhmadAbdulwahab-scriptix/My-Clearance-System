require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const startDelayReminderJob = require('./src/jobs/delayReminderJob');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5080;

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    startDelayReminderJob();
  });
}

start().catch((err) => {
  logger.error('Fatal error during server startup', err);
  process.exit(1);
});

// Catch anything that slips through the normal error-handling pipeline
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception - shutting down', err);
  process.exit(1);
});
