const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const User = require('../models/User');
const ClearanceRequest = require('../models/ClearanceRequest');
const ClearanceItem = require('../models/ClearanceItem');
const Certificate = require('../models/Certificate');

const notificationService = require('../services/notificationService');
const workflowService = require('../services/workflowService');
const delayReminderService = require('../services/delayReminderService');
const categorizationService = require('../services/categorizationService');

/**
 * POST /api/clearance/requests
 * Student submits a single clearance request. The system auto-generates
 * one ClearanceItem per ACTIVE personnel, staged so HOD is actionable immediately,
 * every other office is locked until HOD approves, and Bursary is locked
 * until every other office has approved (see workflowService).
 */
const createRequest = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const existingPending = await ClearanceRequest.findOne({
    student: studentId,
    status: 'pending',
  });
  if (existingPending) {
    throw ApiError.conflict('You already have a pending clearance request');
  }

  // Only fetch ACTIVE personnel
  const personnelList = await User.find({ role: 'personnel', status: 'active' });
  if (!personnelList.length) {
    throw ApiError.internal('No active personnel are configured for this department yet');
  }

  // Every stage must have at least one active personnel, otherwise the
  // request will get stuck mid-pipeline or silently skip a required step.
  const stagesPresent = new Set(personnelList.map((p) => p.stage));
  if (!stagesPresent.has(1)) {
    throw ApiError.internal('No active Head of Department account is configured; cannot start the approval sequence');
  }
  if (!stagesPresent.has(2)) {
    throw ApiError.internal('No active Stage 2 office personnel are configured; clearance would stall after HOD approval');
  }
  if (!stagesPresent.has(3)) {
    throw ApiError.internal('No active Bursary account is configured; clearance could never be finalized');
  }

  const request = await ClearanceRequest.create({ student: studentId });
  const items = await workflowService.initializeItems(request._id, studentId, personnelList);

  logger.info('Clearance request created', { requestId: request._id, studentId });

  sendSuccess(res, 201, 'Clearance request submitted', { request, items });
});

/**
 * GET /api/clearance/requests/my
 * Student views their own request history.
 */
const getMyRequests = asyncHandler(async (req, res) => {
  const requests = await ClearanceRequest.find({ student: req.user._id }).sort('-createdAt');
  sendSuccess(res, 200, 'Requests fetched', { requests });
});

/**
 * GET /api/clearance/requests/:id
 * Full status breakdown of one request (all personnel items + their state,
 * including which are locked, pending, approved, or rejected).
 */
const getRequestStatus = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Clearance request not found');

  if (req.user.role === 'student' && String(request.student) !== String(req.user._id)) {
    throw ApiError.forbidden("You cannot view another student's request");
  }

  const items = await ClearanceItem.find({ request: request._id })
    .populate('personnel', 'name officeName stage')
    .sort('stage');

  sendSuccess(res, 200, 'Request status fetched', { request, items });
});

/**
 * GET /api/clearance/requests/:id/estimate
 * Returns the fixed institutional SLA plus how long each currently-pending
 * item has been waiting so far.
 */
const getRequestEstimate = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Clearance request not found');

  if (req.user.role === 'student' && String(request.student) !== String(req.user._id)) {
    throw ApiError.forbidden("You cannot view another student's request");
  }

  const pendingItems = await ClearanceItem.find({
    request: request._id,
    status: 'pending',
  }).populate('personnel', 'name officeName');

  const now = Date.now();
  const items = pendingItems.map((item) => ({
    itemId: item._id,
    personnel: item.personnel.name,
    officeName: item.personnel.officeName,
    daysWaitingSoFar: item.unlockedAt ? Math.floor((now - item.unlockedAt.getTime()) / (24 * 60 * 60 * 1000)) : 0,
  }));

  sendSuccess(res, 200, 'Estimate fetched', {
    expectedTurnaround: delayReminderService.getExpectedTurnaround(),
    items,
  });
});

/**
 * GET /api/clearance/items/pending
 * Personnel views their own queue of currently actionable (pending) items.
 * Locked items don't show here since it isn't this personnel's turn yet.
 */
const getPendingItemsForPersonnel = asyncHandler(async (req, res) => {
  const items = await ClearanceItem.find({
    personnel: req.user._id,
    status: 'pending',
  })
    .populate('student', 'name regNumber')
    .sort('unlockedAt');

  sendSuccess(res, 200, 'Pending items fetched', { items });
});

/**
 * Helper: after any item is resolved, check whether the whole request is
 * now complete (nothing pending, locked, or rejected left), and if so issue
 * a certificate + notify the student.
 */
async function checkAndCompleteRequest(requestId, studentId) {
  const unresolvedCount = await ClearanceItem.countDocuments({
    request: requestId,
    status: { $in: ['pending', 'locked'] },
  });
  const anyRejected = await ClearanceItem.countDocuments({
    request: requestId,
    status: 'rejected',
  });

  if (unresolvedCount === 0 && anyRejected === 0) {
    const request = await ClearanceRequest.findById(requestId);
    if (request.status !== 'completed') {
      request.status = 'completed';
      request.completedAt = new Date();
      await request.save();

      const certificate = await Certificate.create({
        request: requestId,
        student: studentId,
        certificateCode: Certificate.generateCode(),
      });

      const student = await User.findById(studentId).select('name');
      await notificationService.notify(
        studentId,
        'clearance_completed',
        'All personnel have approved your clearance. Your certificate is ready.',
        null,
        {
          studentName: student?.name,
          completedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
        }
      );

      logger.info('Clearance request completed, certificate issued', {
        requestId,
        certificateCode: certificate.certificateCode,
      });
    }
  }
}

/**
 * PATCH /api/clearance/items/:id/approve
 * After approving, tries to advance the workflow to the next stage
 * (unlocking the next office's items) and checks whether the whole
 * request is now fully cleared.
 */
const approveItem = asyncHandler(async (req, res) => {
  const item = await ClearanceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Clearance item not found');

  if (String(item.personnel) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only act on items assigned to you');
  }
  if (item.status !== 'pending') {
    throw ApiError.badRequest('This item is not currently actionable (already resolved, or not yet your turn)');
  }

  item.status = 'approved';
  item.respondedAt = new Date();
  await item.save();

  const student = await User.findById(item.student).select('name');
  const remainingCount = await ClearanceItem.countDocuments({
    request: item.request,
    status: { $in: ['pending', 'locked'] },
  });

  await notificationService.notify(
    item.student,
    'clearance_approved',
    `Your clearance item with ${req.user.officeName || 'an office'} has been approved.`,
    item._id,
    {
      officeName: req.user.officeName || 'Office',
      studentName: student?.name,
      remainingOffices: remainingCount,
    }
  );

  await workflowService.tryAdvanceStage(item.request, item.stage);
  await checkAndCompleteRequest(item.request, item.student);

  sendSuccess(res, 200, 'Item approved', { item });
});

/**
 * PATCH /api/clearance/items/:id/reject
 * Body: { reason: string }
 * The reason is auto-categorized. A rejection halts the chain - later
 * stages stay locked until this is resolved. Student can resubmit.
 */
const rejectItem = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A rejection reason is required');
  }

  const item = await ClearanceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Clearance item not found');

  if (String(item.personnel) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only act on items assigned to you');
  }
  if (item.status !== 'pending') {
    throw ApiError.badRequest('This item is not currently actionable (already resolved, or not yet your turn)');
  }

  const category = await categorizationService.categorizeRejection(reason);

  item.status = 'rejected';
  item.rejectionReason = reason;
  item.rejectionCategory = category;
  item.respondedAt = new Date();

  // Track rejection in history
  item.resubmissionHistory.push({
    action: 'rejected',
    actor: req.user._id,
    reason,
    timestamp: new Date(),
  });

  await item.save();

  const student = await User.findById(item.student).select('name');
  await notificationService.notify(
    item.student,
    'clearance_rejected',
    `Your clearance item with ${req.user.officeName || 'an office'} was rejected: "${reason}". You can resubmit with updated information.`,
    item._id,
    {
      officeName: req.user.officeName || 'Office',
      studentName: student?.name,
      reason,
      category,
    }
  );

  sendSuccess(res, 200, 'Item rejected', { item });
});

/**
 * PATCH /api/clearance/items/:id/unreject
 * Personnel can revert their own rejection back to pending state,
 * resetting the SLA timer. This allows flexibility when a student
 * addresses issues externally (e.g., pays fee in person).
 */
const unrejectItem = asyncHandler(async (req, res) => {
  const item = await ClearanceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Clearance item not found');

  if (String(item.personnel) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only act on items assigned to you');
  }
  if (item.status !== 'rejected') {
    throw ApiError.badRequest('This item is not currently rejected');
  }

  // Reset to pending and restart SLA timer
  item.status = 'pending';
  item.unlockedAt = new Date(); // Reset SLA timer
  // item.rejectionReason = null;
  // item.rejectionCategory = null;
  item.respondedAt = null;
  item.reminderCount = 0;
  item.lastReminderAt = null;

  // Track unreject in history
  item.resubmissionHistory.push({
    action: 'unreject',
    actor: req.user._id,
    reason: 'Personnel reverted rejection',
    timestamp: new Date(),
  });

  await item.save();

  const student = await User.findById(item.student).select('name');
  await notificationService.notify(
    item.student,
    'clearance_pending',
    `Your clearance item with ${req.user.officeName || 'an office'} has been reopened for review.`,
    item._id,
    {
      officeName: req.user.officeName || 'Office',
      studentName: student?.name,
    }
  );

  sendSuccess(res, 200, 'Item unrejected and reset to pending', { item });
});

/**
 * PATCH /api/clearance/items/:id/resubmit
 * Student resubmits a rejected item with updated information/documents.
 * Resets the item to pending status and restarts the SLA timer.
 * Body: { note?: string, documents?: [{ name, url }] }
 */
const resubmitItem = asyncHandler(async (req, res) => {
  const { note, documents } = req.body;

  const item = await ClearanceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Clearance item not found');

  if (String(item.student) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only resubmit your own items');
  }
  if (item.status !== 'rejected') {
    throw ApiError.badRequest('This item is not currently rejected');
  }

  // Reset to pending and restart SLA timer
  item.status = 'pending';
  item.unlockedAt = new Date(); // Reset SLA timer
  item.respondedAt = null;
  item.reminderCount = 0;
  item.lastReminderAt = null;

  // Store resubmission details
  if (note) item.resubmissionNote = note;
  if (documents && Array.isArray(documents)) {
    item.resubmissionDocuments.push(...documents.map(doc => ({
      name: doc.name,
      url: doc.url,
      uploadedAt: new Date(),
    })));
  }

  // Track resubmission in history
  item.resubmissionHistory.push({
    action: 'resubmitted',
    actor: req.user._id,
    reason: note || 'Student resubmitted with updated information',
    timestamp: new Date(),
  });

  // Keep rejection reason visible for context, but clear category
  item.rejectionCategory = null;

  await item.save();

  // Notify the personnel that there's a resubmission to review
  const personnel = await User.findById(item.personnel).select('name officeName');
  const student = await User.findById(item.student).select('name');

  await notificationService.notify(
    item.personnel,
    'clearance_pending',
    `A student has resubmitted clearance item for ${personnel?.officeName || 'your office'}. Please review.`,
    item._id,
    {
      officeName: personnel?.officeName || 'Office',
      studentName: student?.name,
    }
  );

  sendSuccess(res, 200, 'Item resubmitted successfully', { item });
});

/**
 * GET /api/clearance/requests/:id/certificate
 */
const getCertificate = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Clearance request not found');

  if (req.user.role === 'student' && String(request.student) !== String(req.user._id)) {
    throw ApiError.forbidden("You cannot view another student's certificate");
  }

  const certificate = await Certificate.findOne({ request: request._id });
  if (!certificate) {
    throw ApiError.notFound('Certificate not yet issued for this request');
  }

  sendSuccess(res, 200, 'Certificate fetched', { certificate });
});

/**
 * GET /api/clearance/items/:id
 * Student or personnel views a single clearance item's full details
 */
const getItemDetail = asyncHandler(async (req, res) => {
  const item = await ClearanceItem.findById(req.params.id)
    .populate('personnel', 'name officeName stage')
    .populate('student', 'name regNumber email');

  if (!item) {
    throw ApiError.notFound('Clearance item not found');
  }

  // Authorization: only student who owns it, or personnel assigned to it, or admin can view
  const isStudent = req.user.role === 'student' && String(item.student._id) === String(req.user._id);
  const isPersonnel = req.user.role === 'personnel' && String(item.personnel._id) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isStudent && !isPersonnel && !isAdmin) {
    throw ApiError.forbidden('You do not have permission to view this item');
  }

  sendSuccess(res, 200, 'Item details fetched', { item });
});

/**
 * GET /api/clearance/personnel/statistics
 * Personnel views their own statistics
 */
const getPersonnelStatistics = asyncHandler(async (req, res) => {
  const personnelId = req.user._id;

  // Total items reviewed (approved + rejected)
  const totalReviewed = await ClearanceItem.countDocuments({
    personnel: personnelId,
    status: { $in: ['approved', 'rejected'] }
  });

  // Pending count
  const pendingCount = await ClearanceItem.countDocuments({
    personnel: personnelId,
    status: 'pending'
  });

  // Approval count
  const approvedCount = await ClearanceItem.countDocuments({
    personnel: personnelId,
    status: 'approved'
  });

  // Rejection count
  const rejectedCount = await ClearanceItem.countDocuments({
    personnel: personnelId,
    status: 'rejected'
  });

  // Average response time (in days)
  const reviewedItems = await ClearanceItem.find({
    personnel: personnelId,
    status: { $in: ['approved', 'rejected'] },
    respondedAt: { $ne: null },
    unlockedAt: { $ne: null }
  }).select('unlockedAt respondedAt').lean();

  let avgResponseDays = 0;
  if (reviewedItems.length > 0) {
    const totalDays = reviewedItems.reduce((sum, item) => {
      const days = (item.respondedAt - item.unlockedAt) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgResponseDays = Math.round(totalDays / reviewedItems.length * 10) / 10;
  }

  // Approval ratio
  const approvalRatio = totalReviewed > 0
    ? Math.round((approvedCount / totalReviewed) * 100)
    : 0;

  sendSuccess(res, 200, 'Personnel statistics fetched', {
    totalReviewed,
    pendingCount,
    approvedCount,
    rejectedCount,
    avgResponseDays,
    approvalRatio
  });
});

/**
 * GET /api/clearance/personnel/history
 * Personnel views all items they've reviewed
 */
const getPersonnelHistory = asyncHandler(async (req, res) => {
  const items = await ClearanceItem.find({
    personnel: req.user._id,
    status: { $in: ['approved', 'rejected'] }
  })
    .populate('student', 'name regNumber')
    .sort('-respondedAt');

  sendSuccess(res, 200, 'Personnel history fetched', {
    items,
    count: items.length
  });
});

module.exports = {
  createRequest,
  getMyRequests,
  getRequestStatus,
  getRequestEstimate,
  getPendingItemsForPersonnel,
  approveItem,
  rejectItem,
  unrejectItem,
  resubmitItem,
  getCertificate,
  getItemDetail,
  getPersonnelStatistics,
  getPersonnelHistory,
  checkAndCompleteRequest, // Export for admin controller
};
