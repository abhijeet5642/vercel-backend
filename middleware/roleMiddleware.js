// Role-based access control middleware

/**
 * Middleware to restrict access based on user roles
 * @param {...string} roles - Allowed roles
 * @returns {function} Express middleware function
 */
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