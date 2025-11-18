const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { forgotPassword } = require("../controllers/authController.js");
const { resetPassword } = require("../controllers/authController.js");

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.put('/change-password', protect, authController.changePassword);

// Admin-only routes
router.get('/admin/users', protect, restrictTo('college_admin', 'super_admin'), authController.getAllUsers);
router.get('/admin/users/:userId', protect, restrictTo('college_admin', 'super_admin'), authController.getUserById);
router.delete('/admin/users/:userId', protect, restrictTo('college_admin', 'super_admin'), authController.deleteUser);

// Forgot Password Route
router.post("/forgot-password", forgotPassword);

// Reset Password
router.post("/reset-password", resetPassword);

module.exports = router;