const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    validate: {
      validator: function(email) {
        // Allow system emails (for super admin)
        if (email.endsWith('@campuseventhub.com')) {
          return true;
        }
        
        const allowedDomains = [
          'gmail.com',
          'outlook.com',
          'yahoo.com',
          'edu',
          'ac.in'
        ];
        // Extract domain from email
        const domain = email.split('@')[1];
        return allowedDomains.some(allowedDomain => 
          domain === allowedDomain || domain.endsWith('.' + allowedDomain)
        );
      },
      message: 'Please use a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't return password in queries by default
  },
  college: {
    type: String,
    required: [true, 'College name is required'],
    trim: true,
    maxLength: [100, 'College name cannot be more than 100 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['student', 'college_admin', 'super_admin'],
      message: '{VALUE} is not a valid role'
    },
    default: 'student'
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: function() {
      // Only college admins need approval
      return this.role === 'college_admin' ? 'pending' : 'approved';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  passwordChangedAt: Date,
  resetToken: String,
  resetTokenExpiry: Date
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update passwordChangedAt field
    this.passwordChangedAt = Date.now() - 1000;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;