const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Admin routes (must come before parameterized routes)
router.get('/admin/all', protect, restrictTo('college_admin', 'super_admin'), feedbackController.getAllFeedbacksForAdmin);

// Feedback routes
router.post('/', protect, feedbackController.createFeedback);
router.get('/event/:eventId', feedbackController.getEventFeedbacks);
router.get('/can-feedback/:eventId', protect, feedbackController.canProvideFeedback);
router.put('/:id', protect, feedbackController.updateFeedback);
router.delete('/:id', protect, feedbackController.deleteFeedback);

// Reply routes (for threaded replies to feedback)
router.post('/:feedbackId/reply', protect, feedbackController.addReplyToFeedback);
router.delete('/:feedbackId/reply/:replyId', protect, feedbackController.deleteReplyFromFeedback);

// Comment routes (keeping for backward compatibility)
router.post('/comments', protect, feedbackController.createComment);
router.get('/comments/event/:eventId', feedbackController.getEventComments);
router.put('/comments/:id', protect, feedbackController.updateComment);
router.delete('/comments/:id', protect, feedbackController.deleteComment);

module.exports = router;

