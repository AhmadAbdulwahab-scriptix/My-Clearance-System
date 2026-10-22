/**
 * Delay reminders (SLA).
 *
 * This uses one fixed institutional expectation - clearance
 * should take no more than SLA_DAYS - and reminds ONLY the specific
 * personnel who is late, directly, once per day, for as long as their item
 * stays pending. Nobody else (not the admin, not the student) is notified
 * of this; it's a private nudge to the person holding things up.
 */
const ClearanceItem = require('../models/ClearanceItem');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const SLA_DAYS = parseInt(process.env.SLA_DAYS) || 7;
const MS_PER_DAY = parseInt(process.env.MS_PER_DAY) || 24 * 60 * 60 * 1000; // default to 1 day in ms if not set

/** How students/personnel are told what to expect - a fixed, honest number
 * rather than a computed estimate that would vary (misleadingly) by officer. */
function getExpectedTurnaround() {
  return { days: `${SLA_DAYS} days (1 week)` };
}

/**
 * Scans every currently actionable (status: 'pending') item and, for any
 * that has been waiting SLA_DAYS or more since it was unlocked, sends the
 * responsible personnel a reminder - at most one per calendar day, so a
 * request that's 10 days late gets exactly one nudge on day 10, not ten.
 */
async function runDailySweep() {
  const now = new Date();
  const slaMs = SLA_DAYS * MS_PER_DAY;

  const overdueItems = await ClearanceItem.find({
    status: 'pending',
    unlockedAt: { $ne: null, $lte: new Date(now.getTime() - slaMs) },
  })
    .populate('personnel', 'name officeName')
    .populate('student', 'name');

  let remindedCount = 0;

  for (const item of overdueItems) {
    const daysWaited = Math.floor((now.getTime() - item.unlockedAt.getTime()) / MS_PER_DAY);
    const daysLate = daysWaited - SLA_DAYS;

    const alreadyRemindedToday = item.lastReminderAt && now.getTime() - item.lastReminderAt.getTime() < MS_PER_DAY;

    if (alreadyRemindedToday) continue;
    const lateMessage = daysLate <= 0
        ? `You have kept a student waiting ${SLA_DAYS} days for clearance. Please review it when you can.`
        : `You have kept a student waiting ${SLA_DAYS} days and ${daysLate} day${daysLate === 1 ? '' : 's'} for clearance. Please review it when you can.`;

    // eslint-disable-next-line no-await-in-loop
    await notificationService.notify(
      item.personnel._id,
      'delay_reminder',
      lateMessage,
      item._id,
      {
        personnelName: item.personnel?.name,
        studentName: item.student?.name,
        officeName: item.personnel?.officeName || 'Office',
        daysPending: daysWaited,
        slaTarget: SLA_DAYS,
      }
    );

    item.reminderCount += 1;
    item.lastReminderAt = now;
    // eslint-disable-next-line no-await-in-loop
    await item.save();

    remindedCount += 1;
  }

  logger.info(`Delay reminder sweep complete. ${remindedCount} personnel reminded.`);
  return remindedCount;
}

module.exports = { runDailySweep, getExpectedTurnaround, SLA_DAYS };
