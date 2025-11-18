const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Get all notifications for current user
router.get('/', notificationController.getUserNotifications);

// Get unread count
router.get('/unread/count', notificationController.getUnreadCount);

// Mark notification as read
router.post('/:notificationId/read', notificationController.markNotificationAsRead);

// Mark all notifications as read
router.post('/read-all', notificationController.markAllAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Delete all notifications
router.delete('/', notificationController.deleteAllNotifications);

module.exports = router;

