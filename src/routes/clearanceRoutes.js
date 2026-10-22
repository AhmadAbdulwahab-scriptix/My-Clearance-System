const express = require('express');
const {
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
} = require('../controllers/clearanceController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All clearance routes require authentication
router.use(protect);

// --- Student ---
router.post('/requests', authorize('student'), createRequest); // /api/clearance/requests
router.get('/requests/my', authorize('student'), getMyRequests); // /api/clearance/requests/my
router.get('/requests/:id', authorize('student', 'personnel', 'admin'), getRequestStatus); // /api/clearance/requests/:id
router.get('/requests/:id/estimate', authorize('student', 'personnel', 'admin'), getRequestEstimate); // /api/clearance/requests/:id/estimate
router.get('/requests/:id/certificate', authorize('student', 'personnel', 'admin'), getCertificate); // /api/clearance/requests/:id/certificate
router.patch('/items/:id/resubmit', authorize('student'), resubmitItem); // /api/clearance/items/:id/resubmit

// --- Personnel ---
router.get('/items/pending', authorize('personnel'), getPendingItemsForPersonnel); // /api/clearance/items/pending
router.get('/personnel/statistics', authorize('personnel'), getPersonnelStatistics); // /api/clearance/personnel/statistics
router.get('/personnel/history', authorize('personnel'), getPersonnelHistory); // /api/clearance/personnel/history
router.patch('/items/:id/approve', authorize('personnel'), approveItem); // /api/clearance/items/:id/approve
router.patch('/items/:id/reject', authorize('personnel'), rejectItem); // /api/clearance/items/:id/reject
router.patch('/items/:id/unreject', authorize('personnel'), unrejectItem); // /api/clearance/items/:id/unreject

// --- Shared (Student, Personnel, Admin) ---
router.get('/items/:id', authorize('student', 'personnel', 'admin'), getItemDetail); // /api/clearance/items/:id

module.exports = router;
