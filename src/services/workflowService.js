/**
 * Staged approval workflow.
 *
 * Personnel act in three stages, not all at once:
 *   Stage 1 - Head of Department (must approve before anyone else can act)
 *   Stage 2 - every other office (can act in any order, once HOD has approved)
 *   Stage 3 - Bursary (only unlocked once every Stage 2 office has approved)
 *
 * A ClearanceItem is created 'locked' if it isn't that personnel's turn yet,
 * and only becomes 'pending' (actionable, and then their SLA clock
 * starts) once every item in the stage before it has been approved. If
 * anything in a stage is rejected, later stages simply stay locked until
 * the issue is resolved - there is no auto-resubmission flow yet.
 */
const ClearanceItem = require('../models/ClearanceItem');
const User = require('../models/User');
const notificationService = require('./notificationService');

/**
 * Creates one ClearanceItem per personnel for a new request, with the
 * correct initial status per stage, and notifies only the personnel whose
 * items are immediately actionable (Stage 1 / HOD).
 *
 * Expects only active personnel - the caller (clearanceController) is
 * responsible for fetching active-only from the database.
 */
async function initializeItems(requestId, studentId, personnelList) {
  const now = new Date();

  const items = await ClearanceItem.insertMany(
    personnelList.map((p) => ({
      request: requestId,
      student: studentId,
      personnel: p._id,
      stage: p.stage,
      status: p.stage === 1 ? 'pending' : 'locked',
      unlockedAt: p.stage === 1 ? now : null,
    }))
  );

  const personnelById = new Map(personnelList.map((p) => [String(p._id), p]));

  // The email to the officer must say WHICH student the item is from.
  const student = await User.findById(studentId).select('name');

  await Promise.all(
    items
      .filter((it) => it.status === 'pending')
      .map((it) => {
        const officeName =
          personnelById.get(String(it.personnel))?.officeName || 'Head of Department';

        return notificationService.notify(
          it.personnel,
          'clearance_pending',
          `A new clearance request is awaiting your review as ${officeName}.`,
          it._id,
          { studentName: student ? student.name : undefined, officeName }
        );
      })
  );

  return items;
}

/**
 * Call this after an item in `stage` is approved. If every item in that
 * stage is now approved (and none rejected or pending), unlocks every item
 * in the next stage and notifies those personnel. Stage 3 has no next stage -
 * overall request completion is handled separately.
 *
 * Note: Rejected items block stage advancement until they are resubmitted
 * and approved.
 */
async function tryAdvanceStage(requestId, stage) {
  if (stage >= 3) return; // Bursary is last; nothing further to unlock

  const itemsInStage = await ClearanceItem.find({ request: requestId, stage });
  const allApproved = itemsInStage.every((it) => it.status === 'approved');
  const anyRejected = itemsInStage.some((it) => it.status === 'rejected');

  // Don't advance if any items are still pending, rejected, or not all approved
  if (!allApproved || anyRejected) return;

  const nextStage = stage + 1;
  const now = new Date();

  const nextItems = await ClearanceItem.find({ request: requestId, stage: nextStage })
    .populate('personnel', 'name officeName')
    .populate('student', 'name');

  await Promise.all(
    nextItems.map(async (item) => {
      // Only unlock if still locked (avoid resetting items that were already unlocked)
      if (item.status === 'locked') {
        item.status = 'pending';
        item.unlockedAt = now;
        await item.save();
        await notificationService.notify(
          item.personnel._id,
          'clearance_pending',
          `A clearance request is now awaiting your review ${item.personnel.officeName ? ` (${item.personnel.officeName})` : ''}.`,
          item._id,
          {
            studentName: item.student ? item.student.name : undefined,
            officeName: item.personnel.officeName,
          }
        );
      }
    })
  );
}

module.exports = { initializeItems, tryAdvanceStage };