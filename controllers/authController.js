const crypto = require("crypto");
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, college, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      college,
      role
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    // Log more detailed error information
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`${key}:`, error.errors[key].message);
      });
    }
    res.status(500).json({ error: error.message || 'Server error. Please try again later.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists - explicitly select password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      college: user.college,
      role: user.role
    };

    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

// Update user profile (name and email)
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validate input
    if (!name && !email) {
      return res.status(400).json({ error: 'Please provide name or email to update' });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.user.id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Server error. Please try again later.' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide both old and new password' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message || 'Server error. Please try again later.' });
  }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    let query = {};

    // Add search functionality
    if (req.query.search) {
      query.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { college: new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password -resetToken -resetTokenExpiry -passwordChangedAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        users,
        total: users.length
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get user by ID (Admin only) - without password
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password -resetToken -resetTokenExpiry -passwordChangedAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Save token & expiry in DB
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    // Create reset link - Use FRONTEND_URL from env or fallback
    const frontendUrl = process.env.FRONTEND_URL || 'https://vercel-frontend-gilt-beta.vercel.app/';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send beautiful password reset email
    const { sendPasswordResetEmail } = require('../utils/emailService');
    const emailResult = await sendPasswordResetEmail(user, resetLink);
    
    if (emailResult.success) {
      return res.status(200).json({ 
        message: "Password reset email sent successfully. Please check your inbox." 
      });
    } else {
      console.log('⚠️ Email not sent:', emailResult.message || emailResult.error);
      // Still return success to user (token is saved in DB)
      // User can use the reset page directly if they have the token
      return res.status(200).json({ 
        message: "Password reset initiated. If email is configured, you will receive instructions shortly." 
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.password = newPassword;

    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    const jwtToken = generateToken(user._id);

    res.status(200).json({
      message: "Password reset successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
