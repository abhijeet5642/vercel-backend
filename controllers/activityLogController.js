const ActivityLog = require('../models/ActivityLog');

// Get all activity logs (admin only)
exports.getActivityLogs = async (req, res) => {
  try {
    // Check if user is admin
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit = 50, page = 1, action, user_id } = req.query;
    const query = {};

    // Filter by action type if provided
    if (action) {
      query.action = action;
    }

    // Filter by user if provided
    if (user_id) {
      query.user_id = user_id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await ActivityLog.find(query)
      .populate('user_id', 'name email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await ActivityLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

// Get activity log statistics
exports.getLogStats = async (req, res) => {
  try {
    // Check if user is admin
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get counts by action type
    const actionCounts = await ActivityLog.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent activity count (last 24 hours)
    const recentActivity = await ActivityLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Get total logs
    const totalLogs = await ActivityLog.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        actionCounts,
        recentActivity,
        totalLogs
      }
    });

  } catch (error) {
    console.error('Get log stats error:', error);
    res.status(500).json({ error: 'Failed to fetch log statistics' });
  }
};

// Clear activity logs (super admin only)
exports.clearActivityLogs = async (req, res) => {
  try {
    // Check if user is super admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Only super admins can clear activity logs' 
      });
    }

    const { period } = req.body;
    let query = {};

    // Calculate date threshold based on period
    if (period !== 'all') {
      const now = new Date();
      let monthsAgo;

      switch (period) {
        case '1-month':
          monthsAgo = 1;
          break;
        case '3-months':
          monthsAgo = 3;
          break;
        case '6-months':
          monthsAgo = 6;
          break;
        default:
          return res.status(400).json({ 
            success: false,
            message: 'Invalid period. Use "1-month", "3-months", "6-months", or "all"' 
          });
      }

      const threshold = new Date(now);
      threshold.setMonth(threshold.getMonth() - monthsAgo);
      query.timestamp = { $lt: threshold };
    }

    // Delete logs based on query
    const result = await ActivityLog.deleteMany(query);

    // Create a log about this clearing action
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'logs_cleared',
      description: `Cleared ${result.deletedCount} activity logs (${period === 'all' ? 'all logs' : `logs older than ${period}`})`,
      details: {
        period,
        count: result.deletedCount
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} activity logs`,
      data: {
        deletedCount: result.deletedCount,
        period
      }
    });

  } catch (error) {
    console.error('Clear activity logs error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to clear activity logs',
      error: error.message 
    });
  }
};

// Helper function to create activity log (can be used in other controllers)
exports.createLog = async (userId, action, description, details = {}, ipAddress = null) => {
  try {
    await ActivityLog.create({
      user_id: userId,
      action,
      description,
      details,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw error - logging should not break the main operation
  }
};

module.exports = exports;

