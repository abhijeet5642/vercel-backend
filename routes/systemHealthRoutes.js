const express = require('express');
const router = express.Router();
const { getSystemHealth, getSystemMetrics } = require('../controllers/systemHealthController');
const { protect } = require('../middleware/authMiddleware');

// Get system health status
router.get('/health', protect, getSystemHealth);

// Get detailed system metrics
router.get('/metrics', protect, getSystemMetrics);

module.exports = router;
