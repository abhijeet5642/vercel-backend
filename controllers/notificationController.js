const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all notifications for the current user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const notifications = await Notification.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .populate('related_event', 'title category college_name start_date')
      .lean();

    const unreadCount = await Notification.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      data: { notification }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { user_id: userId, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user_id: userId
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Delete all notifications for user
exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ user_id: userId });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully'
    });

  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Failed to delete all notifications' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Notification.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// Helper function to create notification (used by other controllers)
exports.createNotification = async (userId, message, type, relatedEvent = null, relatedRegistration = null) => {
  try {
    const notification = await Notification.create({
      user_id: userId,
      message,
      type,
      related_event: relatedEvent,
      related_registration: relatedRegistration
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Helper function to notify all students when a new event is created
exports.notifyStudentsAboutNewEvent = async (event) => {
  try {
    // Get all students
    const students = await User.find({ role: 'student', isActive: true }).select('_id');
    
    const message = `New ${event.category} event "${event.title}" at ${event.college_name} on ${new Date(event.start_date).toLocaleDateString()}`;
    
    // Create notifications for all students
    const notifications = students.map(student => ({
      user_id: student._id,
      message,
      type: 'event_created',
      related_event: event._id
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Error notifying students about new event:', error);
  }
};

