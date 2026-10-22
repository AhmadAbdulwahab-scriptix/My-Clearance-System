const express = require('express');
const {
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
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/personnel', createPersonnel); // /api/admin/personnel
router.get('/personnel', listPersonnel); // /api/admin/personnel
router.patch('/personnel/:id/status', updatePersonnelStatus); // /api/admin/personnel/:id/status
router.get('/students', listStudents); // /api/admin/students
router.get('/items', listItems); // /api/admin/items
router.get('/requests', listRequests); // /api/admin/requests
router.get('/students/:id', getStudentDetail); // /api/admin/students/:id
router.get('/analytics/rejections', getRejectionAnalytics); // /api/admin/analytics/rejections
router.get('/analytics/bottlenecks', getBottleneckAnalytics); // /api/admin/analytics/bottlenecks
router.get('/dashboard', getDashboardOverview); // /api/admin/dashboard
router.patch('/clearance/items/:id/reassign', reassignItem); // /api/admin/clearance/items/:id/reassign
router.patch('/clearance/items/:id/override-approve', overrideApprove); // /api/admin/clearance/items/:id/override-approve
router.get('/search', globalSearch); // /api/admin/search

module.exports = router;

