const User = require('../models/User');

// Get all users (filtered by college for college_admin, all for super_admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { role } = req.user;
    let query = {};

    // College admin can only see STUDENTS from their college
    if (role === 'college_admin') {
      query.college = req.user.college;
      query.role = 'student'; // Only show students to college admin
    }
    // Super admin can see all users and filter by role
    else if (role === 'super_admin') {
      // Can filter by role if specified (for User Management tab)
      if (req.query.role) {
        query.role = req.query.role;
      }
      // If no role specified, show students by default in User Management
      // College admins are managed in Admin Approval tab
      else {
        query.role = { $in: ['student', 'college_admin'] };
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add search functionality
    if (req.query.search) {
      query.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { college: new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { users }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Update user approval status (super_admin only)
exports.updateApprovalStatus = async (req, res) => {
  try {
    // Only super admin can approve/reject
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can approve users' });
    }

    const { userId } = req.params;
    const { approval_status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'college_admin') {
      return res.status(400).json({ error: 'Only college admins require approval' });
    }

    user.approval_status = approval_status;
    await user.save();

    // Log this activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'user_updated',
        description: `${approval_status.charAt(0).toUpperCase() + approval_status.slice(1)} college admin "${user.name}" from ${user.college}`,
        details: {
          admin_id: userId,
          admin_name: user.name,
          admin_email: user.email,
          admin_college: user.college,
          new_status: approval_status
        }
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
    }

    res.status(200).json({
      success: true,
      message: `User ${approval_status} successfully`,
      data: { user }
    });

  } catch (error) {
    console.error('Update approval status error:', error);
    res.status(500).json({ error: 'Failed to update approval status' });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // College admin can only delete users from their college
    if (req.user.role === 'college_admin') {
      if (user.college !== req.user.college) {
        return res.status(403).json({ error: 'You can only delete users from your college' });
      }
      // College admin cannot delete other admins
      if (user.role === 'college_admin' || user.role === 'super_admin') {
        return res.status(403).json({ error: 'You cannot delete admin users' });
      }
    }

    // Super admin can delete anyone except other super admins
    if (req.user.role === 'super_admin' && user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin users' });
    }

    await User.findByIdAndDelete(userId);

    // Log this activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'user_deleted',
        description: `Deleted user "${user.name}" (${user.role})`,
        details: {
          deleted_user_id: userId,
          deleted_user_name: user.name,
          deleted_user_email: user.email,
          deleted_user_role: user.role,
          deleted_user_college: user.college
        }
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    let query = {};
    
    // College admin sees only their college's student stats
    if (req.user.role === 'college_admin') {
      query.college = req.user.college;
      query.role = 'student'; // Only count students
      
      const totalStudents = await User.countDocuments(query);
      
      return res.status(200).json({
        success: true,
        data: {
          totalUsers: totalStudents,
          students: totalStudents,
          admins: 0, // College admin doesn't see admin stats
          pendingApprovals: 0
        }
      });
    }

    // Super admin sees all stats
    const totalUsers = await User.countDocuments(query);
    const students = await User.countDocuments({ ...query, role: 'student' });
    const admins = await User.countDocuments({ ...query, role: 'college_admin' });
    const pendingApprovals = await User.countDocuments({ 
      ...query, 
      role: 'college_admin', 
      approval_status: 'pending' 
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        students,
        admins,
        pendingApprovals
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};

module.exports = exports;

