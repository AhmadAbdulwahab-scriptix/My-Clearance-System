const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const User = require('../models/User');
const ClearanceItem = require('../models/ClearanceItem');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/admin/personnel
 * Admin creates a personnel account for an office in the department.
 */
const createPersonnel = asyncHandler(async (req, res) => {
  const { name, email, password, officeName } = req.body;

  if (!name || !email || !password || !officeName) {
    throw ApiError.badRequest('name, email, password, and officeName are required');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const personnel = await User.create({
    name,
    email,
    password,
    role: 'personnel',
    officeName,
  });

  logger.info(`Admin created personnel account: ${personnel.email}`);

  sendSuccess(res, 201, 'Personnel account created', { personnel: personnel.toSafeObject() });
});

/**
 * GET /api/admin/personnel
 * List all personnel with optional status filter
 * - ?status=active|inactive (filter by status, default: all)
 */
const listPersonnel = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const query = { role: 'personnel' };

  // Filter by status if provided
  if (status && ['active', 'inactive'].includes(status)) {
    query.status = status;
  }

  const personnel = await User.find(query).select('-password').sort('officeName');
  sendSuccess(res, 200, 'Personnel fetched', { personnel, count: personnel.length });
});

/**
 * PATCH /api/admin/personnel/:id/status
 * Toggle personnel status between active/inactive (for personnel replacement scenarios)
 */
const updatePersonnelStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'inactive'].includes(status)) {
    throw ApiError.badRequest('status must be either "active" or "inactive"');
  }

  const personnel = await User.findOne({ _id: id, role: 'personnel' });
  if (!personnel) {
    throw ApiError.notFound('Personnel not found');
  }

  personnel.status = status;
  await personnel.save();

  logger.info(`Personnel status updated: ${personnel.email} -> ${status}`);

  sendSuccess(res, 200, 'Personnel status updated', { personnel: personnel.toSafeObject() });
});

/**
 * GET /api/admin/students
 * List all students with optional filters:
 * - ?year=2023 (filter by year extracted from regNumber)
 * - ?status=approved|pending (filter by clearance status)
 * - ?search=searchTerm (search by name or regNumber)
 * - ?hasRejection=true (students with rejected items)
 * - ?rejectionCategory=category (students rejected for specific reason)
 * - ?department=department (filter by department)
 * - ?createdAfter=2026-09-01 (requests created after date)
 * - ?createdBefore=2026-10-10 (requests created before date)
 * - ?overdueDays=7 (students waiting longer than X days)
 * - ?sort=name|-createdAt (sort order, default: -createdAt)
 */
const listStudents = asyncHandler(async (req, res) => {
  const {
    year,
    status,
    search,
    hasRejection,
    rejectionCategory,
    department,
    createdAfter,
    createdBefore,
    overdueDays,
    sort = '-createdAt'
  } = req.query;

  let query = { role: 'student' };

  // Filter by year in registration number (e.g., CST/22/SWE/0001)
  if (year) {
    query.regNumber = { $regex: year, $options: 'i' };
  }

  // Filter by department
  if (department) {
    query.department = department;
  }

  // Search by name or regNumber
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { regNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const students = await User.find(query).select('-password').lean();

  // If filtering by clearance status, rejection, date range, or overdue
  if (status || hasRejection || rejectionCategory || createdAfter || createdBefore || overdueDays) {
    const ClearanceRequest = require('../models/ClearanceRequest');

    const requestQuery = {};

    // Filter by overall clearance completion status
    if (status) {
      requestQuery.status = status === 'approved' ? 'completed' : 'pending';
    }

    // Filter by date range
    if (createdAfter || createdBefore) {
      requestQuery.createdAt = {};
      if (createdAfter) requestQuery.createdAt.$gte = new Date(createdAfter);
      if (createdBefore) requestQuery.createdAt.$lte = new Date(createdBefore);
    }

    let requests = await ClearanceRequest.find(requestQuery).lean();

    // Filter by rejection status, category, or overdue
    if (hasRejection === 'true' || rejectionCategory || overdueDays) {
      const requestIds = requests.map(r => r._id);

      const itemQuery = { request: { $in: requestIds } };

      if (hasRejection === 'true') {
        itemQuery.status = 'rejected';
      }

      if (rejectionCategory) {
        itemQuery.rejectionCategory = rejectionCategory;
      }

      if (overdueDays) {
        const overdueThreshold = new Date(Date.now() - parseInt(overdueDays) * 24 * 60 * 60 * 1000);
        itemQuery.status = 'pending';
        itemQuery.unlockedAt = { $lte: overdueThreshold, $ne: null };
      }

      const matchingItems = await ClearanceItem.find(itemQuery).distinct('request');
      requests = requests.filter(r => matchingItems.some(itemReqId => itemReqId.toString() === r._id.toString()));
    }

    const studentIds = requests.map(r => r.student.toString());

    const filteredStudents = students.filter(s =>
      studentIds.includes(s._id.toString())
    );

    // Sort results
    const sortedStudents = sortStudents(filteredStudents, sort);

    return sendSuccess(res, 200, 'Students fetched', {
      students: sortedStudents,
      count: sortedStudents.length
    });
  }

  // Sort results
  const sortedStudents = sortStudents(students, sort);

  sendSuccess(res, 200, 'Students fetched', {
    students: sortedStudents,
    count: sortedStudents.length
  });
});

/**
 * GET /api/admin/items
 * Every clearance item in the system, so the admin can find an item ID
 * (needed for reassign / override-approve).
 * Query (all optional):
 *   ?status=locked|pending|approved|rejected
 *   ?personnel=<userId>      items assigned to one officer
 *   ?student=<userId>        items for one student
 *   ?search=<text>           student name or reg number
 *   ?overdueDays=7           pending items waiting at least this many days
 *   ?page=1&limit=50
 */
const listItems = asyncHandler(async (req, res) => {
  const { status, personnel, student, search, overdueDays } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const query = {};

  if (['locked', 'pending', 'approved', 'rejected'].includes(status)) query.status = status;
  if (personnel) query.personnel = personnel;
  if (student) query.student = student;

  if (overdueDays) {
    query.status = 'pending';
    query.unlockedAt = {
      $ne: null,
      $lte: new Date(Date.now() - parseInt(overdueDays, 10) * DAY_MS),
    };
  }

  if (search && !student) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    const ids = await User.find({ role: 'student', $or: [{ name: rx }, { regNumber: rx }] }).distinct('_id');
    query.student = { $in: ids };
  }

  const [items, total] = await Promise.all([
    ClearanceItem.find(query)
      .populate('student', 'name regNumber')
      .populate('personnel', 'name officeName stage')
      .sort('-updatedAt')
      .skip((page - 1) * limit)
      .limit(limit),
    ClearanceItem.countDocuments(query),
  ]);

  sendSuccess(res, 200, 'Items fetched', {
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

/**
 * GET /api/admin/requests
 * Clearance requests with their items and a progress count.
 * Query (all optional):
 *   ?status=pending|completed
 *   ?student=<userId>
 *   ?page=1&limit=25
 */
const listRequests = asyncHandler(async (req, res) => {
  const ClearanceRequest = require('../models/ClearanceRequest');
  const { status, student } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

  const query = {};
  if (['pending', 'completed'].includes(status)) query.status = status;
  if (student) query.student = student;

  const [requests, total] = await Promise.all([
    ClearanceRequest.find(query)
      .populate('student', 'name regNumber email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ClearanceRequest.countDocuments(query),
  ]);

  // One query for all the items, then group them under their request.
  const items = await ClearanceItem.find({ request: { $in: requests.map((r) => r._id) } })
    .populate('personnel', 'name officeName stage')
    .sort('stage')
    .lean();

  const byRequest = {};
  items.forEach((item) => {
    const key = String(item.request);
    (byRequest[key] = byRequest[key] || []).push(item);
  });

  const result = requests.map((r) => {
    const list = byRequest[String(r._id)] || [];
    return {
      ...r,
      items: list,
      progress: {
        approved: list.filter((i) => i.status === 'approved').length,
        total: list.length,
      },
    };
  });

  sendSuccess(res, 200, 'Requests fetched', {
    requests: result,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

/**
 * GET /api/admin/students/:id
 * One student with every request, its items, and the certificate (if issued).
 */
const getStudentDetail = asyncHandler(async (req, res) => {
  const ClearanceRequest = require('../models/ClearanceRequest');
  const Certificate = require('../models/Certificate');

  const student = await User.findOne({ _id: req.params.id, role: 'student' }).select('-password').lean();
  if (!student) throw ApiError.notFound('Student not found');

  const requests = await ClearanceRequest.find({ student: student._id }).sort('-createdAt').lean();
  const requestIds = requests.map((r) => r._id);

  const [items, certificates] = await Promise.all([
    ClearanceItem.find({ request: { $in: requestIds } })
      .populate('personnel', 'name officeName stage')
      .sort('stage')
      .lean(),
    Certificate.find({ request: { $in: requestIds } }).lean(),
  ]);

  const result = requests.map((r) => ({
    ...r,
    items: items.filter((i) => String(i.request) === String(r._id)),
    certificate: certificates.find((c) => String(c.request) === String(r._id)) || null,
  }));

  sendSuccess(res, 200, 'Student fetched', { student, requests: result });
});

// Helper function to sort students
function sortStudents(students, sortParam) {
  const isDescending = sortParam.startsWith('-');
  const field = isDescending ? sortParam.slice(1) : sortParam;
  const order = isDescending ? -1 : 1;

  return students.sort((a, b) => {
    const aVal = a[field] || '';
    const bVal = b[field] || '';

    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });
}

/**
 * GET /api/admin/analytics/rejections
 * Rejection-cause breakdown by category (feeds off AI Component 3's output).
 */
const getRejectionAnalytics = asyncHandler(async (req, res) => {
  const breakdown = await ClearanceItem.aggregate([
    { $match: { status: 'rejected' } },
    { $group: { _id: '$rejectionCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  sendSuccess(res, 200, 'Rejection analytics fetched', { breakdown });
});

/**
 * GET /api/admin/analytics/bottlenecks
 * Average time-to-resolve per personnel officer, measured from when an
 * item actually became actionable for them (unlockedAt), not from when it
 * was created - a locked item isn't waiting on them yet. Slowest first.
 */
const getBottleneckAnalytics = asyncHandler(async (req, res) => {
  const bottlenecks = await ClearanceItem.aggregate([
    {
      $match: {
        status: { $in: ['approved', 'rejected'] },
        respondedAt: { $ne: null },
        unlockedAt: { $ne: null },
      },
    },
    {
      $project: {
        personnel: 1,
        durationMs: { $subtract: ['$respondedAt', '$unlockedAt'] },
      },
    },
    {
      $group: {
        _id: '$personnel',
        avgDurationMs: { $avg: '$durationMs' },
        resolvedCount: { $sum: 1 },
      },
    },
    { $sort: { avgDurationMs: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'personnel',
      },
    },
    { $unwind: '$personnel' },
    {
      $project: {
        _id: 0,
        personnelId: '$personnel._id',
        name: '$personnel.name',
        officeName: '$personnel.officeName',
        avgDurationMs: 1,
        resolvedCount: 1,
      },
    },
  ]);

  sendSuccess(res, 200, 'Bottleneck analytics fetched', { bottlenecks });
});

/**
 * GET /api/admin/dashboard
 * System overview dashboard with key metrics
 */
const getDashboardOverview = asyncHandler(async (req, res) => {
  const ClearanceRequest = require('../models/ClearanceRequest');

  // Total students
  const totalStudents = await User.countDocuments({ role: 'student' });

  // Pending clearances
  const pendingClearances = await ClearanceRequest.countDocuments({ status: 'pending' });

  // Completed today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const completedToday = await ClearanceRequest.countDocuments({
    status: 'completed',
    completedAt: { $gte: startOfToday }
  });

  // Completed this week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const completedThisWeek = await ClearanceRequest.countDocuments({
    status: 'completed',
    completedAt: { $gte: startOfWeek }
  });

  // Average completion time (in days)
  const completedRequests = await ClearanceRequest.find({
    status: 'completed',
    completedAt: { $ne: null }
  }).select('createdAt completedAt').lean();

  let avgCompletionDays = 0;
  if (completedRequests.length > 0) {
    const totalDays = completedRequests.reduce((sum, req) => {
      const days = (req.completedAt - req.createdAt) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgCompletionDays = Math.round(totalDays / completedRequests.length * 10) / 10;
  }

  // Bottleneck offices (offices with most pending items)
  const bottleneckOffices = await ClearanceItem.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: '$personnel', pendingCount: { $sum: 1 } } },
    { $sort: { pendingCount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'personnel'
      }
    },
    { $unwind: '$personnel' },
    {
      $project: {
        _id: 0,
        officeName: '$personnel.officeName',
        personnelName: '$personnel.name',
        pendingCount: 1
      }
    }
  ]);

  // Total rejections
  const totalRejections = await ClearanceItem.countDocuments({ status: 'rejected' });

  sendSuccess(res, 200, 'Dashboard overview fetched', {
    totalStudents,
    pendingClearances,
    completedToday,
    completedThisWeek,
    avgCompletionDays,
    bottleneckOffices,
    totalRejections
  });
});

/**
 * PATCH /api/admin/clearance/items/:id/reassign
 * Reassign a clearance item to a different personnel (e.g., when someone goes on leave)
 */
const reassignItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPersonnelId } = req.body;

  if (!newPersonnelId) {
    throw ApiError.badRequest('newPersonnelId is required');
  }

  const item = await ClearanceItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Clearance item not found');
  }

  const newPersonnel = await User.findOne({ _id: newPersonnelId, role: 'personnel', status: 'active' });
  if (!newPersonnel) {
    throw ApiError.notFound('New personnel not found or inactive');
  }

  const oldPersonnelId = item.personnel;
  item.personnel = newPersonnelId;
  item.stage = newPersonnel.stage; // Update stage based on new personnel
  await item.save();

  logger.info(`Item ${id} reassigned from ${oldPersonnelId} to ${newPersonnelId} by admin`);

  // Notify new personnel
  const notificationService = require('../services/notificationService');
  const student = await User.findById(item.student).select('name');

  await notificationService.notify(
    newPersonnelId,
    'clearance_pending',
    `A clearance item has been reassigned to you for review.`,
    item._id,
    {
      studentName: student?.name,
      officeName: newPersonnel.officeName
    }
  );

  sendSuccess(res, 200, 'Item reassigned successfully', { item });
});

/**
 * PATCH /api/admin/clearance/items/:id/override-approve
 * Force approve an item (emergency/special cases)
 */
const overrideApprove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason for override is required');
  }

  const item = await ClearanceItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Clearance item not found');
  }

  if (item.status === 'approved') {
    throw ApiError.badRequest('Item is already approved');
  }

  item.status = 'approved';
  item.respondedAt = new Date();
  item.resubmissionHistory.push({
    action: 'resubmitted',
    actor: req.user._id,
    reason: `Admin override: ${reason}`,
    timestamp: new Date()
  });
  await item.save();

  logger.warn(`Item ${id} force-approved by admin ${req.user.email}: ${reason}`);

  // Notify student
  const notificationService = require('../services/notificationService');
  const workflowService = require('../services/workflowService');
  const personnel = await User.findById(item.personnel).select('officeName');
  const student = await User.findById(item.student).select('name');

  const remainingCount = await ClearanceItem.countDocuments({
    request: item.request,
    status: { $in: ['pending', 'locked'] }
  });

  await notificationService.notify(
    item.student,
    'clearance_approved',
    `Your clearance item with ${personnel?.officeName || 'an office'} has been approved.`,
    item._id,
    {
      officeName: personnel?.officeName || 'Office',
      studentName: student?.name,
      remainingOffices: remainingCount
    }
  );

  // Try to advance workflow
  await workflowService.tryAdvanceStage(item.request, item.stage);

  // Check if request is complete
  const { checkAndCompleteRequest } = require('../controllers/clearanceController');
  await checkAndCompleteRequest(item.request, item.student);

  sendSuccess(res, 200, 'Item force-approved', { item });
});

/**
 * GET /api/admin/search
 * System-wide search for students, personnel, or requests
 */
const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    throw ApiError.badRequest('Search query must be at least 2 characters');
  }

  const searchRegex = { $regex: q, $options: 'i' };

  // Search students
  const students = await User.find({
    role: 'student',
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { regNumber: searchRegex }
    ]
  }).select('name email regNumber').limit(10).lean();

  // Search personnel
  const personnel = await User.find({
    role: 'personnel',
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { officeName: searchRegex }
    ]
  }).select('name email officeName status').limit(10).lean();

  // Search by certificate code
  const Certificate = require('../models/Certificate');
  const certificates = await Certificate.find({
    certificateCode: searchRegex
  }).populate('student', 'name regNumber').limit(5).lean();

  sendSuccess(res, 200, 'Search results fetched', {
    students,
    personnel,
    certificates,
    totalResults: students.length + personnel.length + certificates.length
  });
});


module.exports = {
  createPersonnel,
  listPersonnel,
  updatePersonnelStatus,
  listStudents,
  listItems,
  listRequests,
  getStudentDetail,
  getRejectionAnalytics,
  getBottleneckAnalytics,
  getDashboardOverview,
  reassignItem,
  overrideApprove,
  globalSearch
};

