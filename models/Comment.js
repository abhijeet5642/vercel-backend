const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event reference is required']
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  text: {
    type: String,
    required: [true, 'Comment text is required'],
    trim: true,
    minLength: [3, 'Comment must be at least 3 characters'],
    maxLength: [1000, 'Comment cannot exceed 1000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // For threaded comments/replies (to be implemented later)
  parent_comment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  // Admin reply feature (to be implemented later)
  admin_reply: {
    reply_text: {
      type: String,
      trim: true,
      maxLength: [1000, 'Reply cannot exceed 1000 characters']
    },
    replied_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    replied_at: {
      type: Date
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for querying comments by event
commentSchema.index({ event_id: 1, timestamp: -1 });

// Index for user's comments
commentSchema.index({ user_id: 1, timestamp: -1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;

