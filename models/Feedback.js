const mongoose = require('mongoose');

// Reply sub-schema for threaded replies
const replySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    minLength: [1, 'Reply must be at least 1 character'],
    maxLength: [500, 'Reply cannot exceed 500 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const feedbackSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comments: {
    type: String,
    required: [true, 'Feedback comment is required'],
    trim: true,
    minLength: [10, 'Feedback must be at least 10 characters'],
    maxLength: [2000, 'Feedback cannot exceed 2000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Threaded replies to this review
  replies: [replySchema],
  // Helpful votes for feedback
  helpful_count: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index to prevent duplicate feedback from same user for same event
feedbackSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

// Index for querying feedbacks by event
feedbackSchema.index({ event_id: 1, timestamp: -1 });

// Static method to calculate average rating for an event
feedbackSchema.statics.calculateEventRating = async function(eventId) {
  const result = await this.aggregate([
    { $match: { event_id: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$event_id',
        averageRating: { $avg: '$rating' },
        totalCount: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 
    ? { average: result[0].averageRating, count: result[0].totalCount }
    : { average: 0, count: 0 };
};

// Static method to get rating distribution
feedbackSchema.statics.getRatingDistribution = async function(eventId) {
  const distribution = await this.aggregate([
    { $match: { event_id: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Convert to object format
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach(item => {
    dist[item._id] = item.count;
  });

  return dist;
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;

