const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  action: {
    type: String,
    required: [true, 'Action type is required'],
    enum: [
      'event_created',
      'event_updated',
      'event_deleted',
      'registration_status_update',
      'user_created',
      'user_updated',
      'user_deleted',
      'login',
      'logout',
      'system_error'
    ]
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip_address: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for faster queries
activityLogSchema.index({ user_id: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;

