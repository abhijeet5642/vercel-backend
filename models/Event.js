const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxLength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxLength: [2000, 'Description cannot be more than 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: {
      values: ['hackathon', 'cultural', 'sports', 'workshop', 'seminar', 'competition'],
      message: '{VALUE} is not a valid category'
    }
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true,
    maxLength: [200, 'Location cannot be more than 200 characters']
  },
  start_date: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Event start date must be in the future'
    }
  },
  end_date: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.start_date;
      },
      message: 'End date must be after start date'
    }
  },
  college_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'College information is required']
  },
  college_name: {
    type: String,
    required: [true, 'College name is required'],
    trim: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Event creator is required']
  },
  image: {
    type: String, // Store file path/URL
    default: null
  },
  registration_limit: {
    type: Number,
    required: [true, 'Registration limit is required'],
    min: [1, 'Registration limit must be at least 1'],
    max: [10000, 'Registration limit cannot exceed 10000']
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative'],
    max: [100000, 'Price cannot exceed ₹100,000']
  },
  current_registrations: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: {
      values: ['upcoming', 'active', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'upcoming'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  // Additional fields for future features
  tags: [{
    type: String,
    trim: true
  }],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  is_featured: {
    type: Boolean,
    default: false
  },
  registration_deadline: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= this.start_date;
      },
      message: 'Registration deadline must be before or same as start date'
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
eventSchema.index({ college_id: 1, start_date: -1 });
eventSchema.index({ category: 1, start_date: -1 });
eventSchema.index({ status: 1, start_date: -1 });
eventSchema.index({ location: 1 });
eventSchema.index({ created_at: -1 });

// Virtual for checking if registration is open
eventSchema.virtual('registration_open').get(function() {
  const now = new Date();
  const deadline = this.registration_deadline || this.start_date;
  return this.status === 'upcoming' && 
         now < deadline && 
         this.current_registrations < this.registration_limit;
});

// Virtual for registration percentage
eventSchema.virtual('registration_percentage').get(function() {
  if (this.registration_limit === 0) return 0;
  return Math.round((this.current_registrations / this.registration_limit) * 100);
});

// Virtual for event duration in hours
eventSchema.virtual('duration_hours').get(function() {
  if (!this.start_date || !this.end_date) return 0;
  return Math.round((this.end_date - this.start_date) / (1000 * 60 * 60));
});

// Pre-save middleware to update the updated_at field
eventSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Pre-save middleware to auto-update status based on dates
eventSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.status !== 'cancelled') {
    if (now < this.start_date) {
      this.status = 'upcoming';
    } else if (now >= this.start_date && now <= this.end_date) {
      this.status = 'active';
    } else if (now > this.end_date) {
      this.status = 'completed';
    }
  }
  
  next();
});

// Static method to find events by college
eventSchema.statics.findByCollege = function(collegeId, options = {}) {
  const query = this.find({ college_id: collegeId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.category) {
    query.where('category').equals(options.category);
  }
  
  if (options.upcoming) {
    query.where('start_date').gte(new Date());
  }
  
  return query.sort({ start_date: -1 }).populate('created_by', 'name email');
};

// Static method to find featured events
eventSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ 
    is_featured: true, 
    status: { $in: ['upcoming', 'active'] } 
  })
  .sort({ start_date: 1 })
  .limit(limit)
  .populate('college_id', 'name college')
  .populate('created_by', 'name email');
};

// Instance method to check if user can register
eventSchema.methods.canUserRegister = function() {
  return this.registration_open && this.current_registrations < this.registration_limit;
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
