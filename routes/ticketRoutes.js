const express = require('express');
const router = express.Router();
const { downloadTicket, verifyTicket } = require('../controllers/ticketController');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/tickets/:registrationId
// @desc    Download ticket for a registration
// @access  Private
router.get('/:registrationId', protect, downloadTicket);

// @route   GET /api/tickets/verify/:registrationId
// @desc    Verify a ticket
// @access  Private (Admin only)
router.get('/verify/:registrationId', protect, verifyTicket);

module.exports = router;

