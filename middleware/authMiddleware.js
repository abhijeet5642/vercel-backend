const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized to access this route' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated' });
      }

      // Check approval status for college admins
      if (user.role === 'college_admin' && user.approval_status !== 'approved') {
        return res.status(403).json({ 
          error: 'Your admin account is pending approval',
          approval_status: user.approval_status 
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized to access this route' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

// Middleware to restrict access based on roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};