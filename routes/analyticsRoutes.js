const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getAnalytics, getDetailedAnalytics } = require('../controllers/analyticsController');

// Protect analytics routes - only admins can access
router.get('/', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  getAnalytics
);

router.get('/detailed', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  getDetailedAnalytics
);

module.exports = router;
