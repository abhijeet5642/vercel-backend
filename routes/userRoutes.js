const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes require authentication and admin access

// Get all users (filtered by role and college)
router.get('/', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  userController.getAllUsers
);

// Get user statistics
router.get('/stats', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  userController.getUserStats
);

// Update user approval status (super admin only)
router.patch('/:userId/approval', 
  protect, 
  restrictTo('super_admin'),
  userController.updateApprovalStatus
);

// Delete user
router.delete('/:userId', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  userController.deleteUser
);

module.exports = router;

