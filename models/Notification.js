const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    maxLength: 500
  },
  type: {
    type: String,
    enum: ['event_created', 'registration_approved', 'registration_rejected', 'event_updated', 'event_cancelled', 'review_reply', 'admin_reply'],
    required: true
  },
  related_event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  related_registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    default: null
  },
  related_feedback: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback',
    default: null
  },
  replied_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Index for efficient querying of user notifications
notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, read: 1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = await this.create(data);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  try {
    const notification = await this.findOneAndUpdate(
      { _id: notificationId, user_id: userId },
      { read: true },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    const count = await this.countDocuments({ user_id: userId, read: false });
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

