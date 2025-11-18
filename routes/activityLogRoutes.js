const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes require authentication and admin access

// Get all activity logs
router.get('/', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  activityLogController.getActivityLogs
);

// Get activity log statistics
router.get('/stats', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  activityLogController.getLogStats
);

// Clear activity logs (super admin only)
router.delete('/clear',
  protect,
  restrictTo('super_admin'),
  activityLogController.clearActivityLogs
);

module.exports = router;

