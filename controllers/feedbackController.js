const Feedback = require('../models/Feedback');
const Comment = require('../models/Comment');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Create new feedback for an event
// @route   POST /api/feedback
// @access  Private (Student)
exports.createFeedback = async (req, res) => {
  try {
    const { event_id, rating, comments } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!event_id || !rating || !comments) {
      return res.status(400).json({
        success: false,
        message: 'Please provide event_id, rating, and comments'
      });
    }

    // Check if event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user has registered for this event
    const registration = await Registration.findOne({
      event_id,
      user_id,
      status: 'approved'
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You can only provide feedback for events you have registered for and been approved'
      });
    }

    // Check if user has already provided feedback
    const existingFeedback = await Feedback.findOne({ event_id, user_id });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'You have already provided feedback for this event'
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      event_id,
      user_id,
      rating,
      comments
    });

    // Update event rating
    const { average, count } = await Feedback.calculateEventRating(event_id);
    await Event.findByIdAndUpdate(event_id, {
      'rating.average': average,
      'rating.count': count
    });

    // Populate user details
    await feedback.populate('user_id', 'name college');

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Error creating feedback:', error);
    
    // Handle duplicate feedback error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already provided feedback for this event'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating feedback',
      error: error.message
    });
  }
};

// @desc    Get all feedbacks for an event
// @route   GET /api/feedback/event/:eventId
// @access  Public
exports.getEventFeedbacks = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get all feedbacks for the event with populated replies
    const feedbacks = await Feedback.find({ event_id: eventId })
      .populate('user_id', 'name college email role')
      .populate('replies.user_id', 'name college role')
      .sort({ timestamp: -1 });

    // Get rating distribution
    const distribution = await Feedback.getRatingDistribution(eventId);

    // Calculate average rating
    const { average, count } = await Feedback.calculateEventRating(eventId);

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        stats: {
          average: parseFloat(average.toFixed(1)),
          count,
          distribution
        }
      }
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedbacks',
      error: error.message
    });
  }
};

// @desc    Update feedback
// @route   PUT /api/feedback/:id
// @access  Private (Student - own feedback only)
exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments } = req.body;
    const user_id = req.user.id;

    // Find feedback
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Check if user owns this feedback
    if (feedback.user_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own feedback'
      });
    }

    // Update feedback
    if (rating) feedback.rating = rating;
    if (comments) feedback.comments = comments;

    await feedback.save();

    // Update event rating
    const { average, count } = await Feedback.calculateEventRating(feedback.event_id);
    await Event.findByIdAndUpdate(feedback.event_id, {
      'rating.average': average,
      'rating.count': count
    });

    await feedback.populate('user_id', 'name college');

    res.status(200).json({
      success: true,
      message: 'Feedback updated successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feedback',
      error: error.message
    });
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private (Student - own feedback only, Admin - any feedback)
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Find feedback
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Check if user has permission to delete this feedback
    const isAdmin = user_role === 'college_admin' || user_role === 'super_admin';
    const isOwner = feedback.user_id.toString() === user_id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own feedback'
      });
    }

    const event_id = feedback.event_id;

    // Delete feedback
    await Feedback.findByIdAndDelete(id);

    // Update event rating
    const { average, count } = await Feedback.calculateEventRating(event_id);
    await Event.findByIdAndUpdate(event_id, {
      'rating.average': average,
      'rating.count': count
    });

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting feedback',
      error: error.message
    });
  }
};

// @desc    Check if user can provide feedback
// @route   GET /api/feedback/can-feedback/:eventId
// @access  Private (Student)
exports.canProvideFeedback = async (req, res) => {
  try {
    const { eventId } = req.params;
    const user_id = req.user.id;

    // Check if user has registered for this event
    const registration = await Registration.findOne({
      event_id: eventId,
      user_id,
      status: 'approved'
    });

    if (!registration) {
      return res.status(200).json({
        success: true,
        canProvideFeedback: false,
        reason: 'not_registered'
      });
    }

    // Check if user has already provided feedback
    const existingFeedback = await Feedback.findOne({
      event_id: eventId,
      user_id
    });

    if (existingFeedback) {
      return res.status(200).json({
        success: true,
        canProvideFeedback: false,
        reason: 'already_provided',
        feedback: existingFeedback
      });
    }

    res.status(200).json({
      success: true,
      canProvideFeedback: true
    });
  } catch (error) {
    console.error('Error checking feedback eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking feedback eligibility',
      error: error.message
    });
  }
};

// ============ COMMENT CONTROLLERS ============

// @desc    Create new comment for an event
// @route   POST /api/feedback/comments
// @access  Private (Student)
exports.createComment = async (req, res) => {
  try {
    const { event_id, text } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!event_id || !text) {
      return res.status(400).json({
        success: false,
        message: 'Please provide event_id and text'
      });
    }

    // Check if event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Create comment
    const comment = await Comment.create({
      event_id,
      user_id,
      text
    });

    // Populate user details
    await comment.populate('user_id', 'name college');

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      data: comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment',
      error: error.message
    });
  }
};

// @desc    Get all comments for an event
// @route   GET /api/feedback/comments/event/:eventId
// @access  Public
exports.getEventComments = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get all comments for the event
    const comments = await Comment.find({ event_id: eventId })
      .populate('user_id', 'name college email')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: {
        comments,
        count: comments.length
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

// @desc    Update comment
// @route   PUT /api/feedback/comments/:id
// @access  Private (Student - own comment only)
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const user_id = req.user.id;

    // Find comment
    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user owns this comment
    if (comment.user_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own comments'
      });
    }

    // Update comment
    comment.text = text;
    await comment.save();

    await comment.populate('user_id', 'name college');

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: comment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment',
      error: error.message
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/feedback/comments/:id
// @access  Private (Student - own comment only)
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Find comment
    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user owns this comment
    if (comment.user_id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments'
      });
    }

    // Delete comment
    await Comment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message
    });
  }
};

// ============ REPLY CONTROLLERS (For threaded replies to feedback) ============

// @desc    Add reply to feedback
// @route   POST /api/feedback/:feedbackId/reply
// @access  Private (Any logged-in user)
exports.addReplyToFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { text } = req.body;
    const user_id = req.user.id;

    // Validate input
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required'
      });
    }

    if (text.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Reply cannot exceed 500 characters'
      });
    }

    // Find feedback and populate owner details
    const feedback = await Feedback.findById(feedbackId)
      .populate('user_id', 'name')
      .populate('event_id', 'title');
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Get replier details to check if admin
    const replier = await User.findById(user_id);
    const isAdmin = replier.role === 'college_admin' || replier.role === 'super_admin';

    // Add reply
    feedback.replies.push({
      user_id,
      text: text.trim(),
      timestamp: new Date()
    });

    await feedback.save();

    // Create notification for the review owner (if not replying to own review)
    if (feedback.user_id._id.toString() !== user_id) {
      const notificationType = isAdmin ? 'admin_reply' : 'review_reply';
      const roleLabel = isAdmin ? 'Admin' : 'Student';
      
      await Notification.createNotification({
        user_id: feedback.user_id._id,
        message: `${roleLabel} ${replier.name} replied to your review on "${feedback.event_id.title}"`,
        type: notificationType,
        related_event: feedback.event_id._id,
        related_feedback: feedback._id,
        replied_by: user_id
      });
    }

    // Populate the last reply with user details
    await feedback.populate({
      path: 'replies.user_id',
      select: 'name college role'
    });

    const newReply = feedback.replies[feedback.replies.length - 1];

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: newReply
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding reply',
      error: error.message
    });
  }
};

// @desc    Delete reply from feedback
// @route   DELETE /api/feedback/:feedbackId/reply/:replyId
// @access  Private (Reply owner or Admin)
exports.deleteReplyFromFeedback = async (req, res) => {
  try {
    const { feedbackId, replyId } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Find feedback
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Find reply
    const reply = feedback.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Reply not found'
      });
    }

    // Check if user has permission to delete this reply
    const isAdmin = user_role === 'college_admin' || user_role === 'super_admin';
    const isOwner = reply.user_id.toString() === user_id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own replies'
      });
    }

    // Remove reply
    feedback.replies.pull(replyId);
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Reply deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reply',
      error: error.message
    });
  }
};

// ============ ADMIN CONTROLLERS ============

// @desc    Get all feedbacks for admin (across all events)
// @route   GET /api/feedback/admin/all
// @access  Private (Admin only)
exports.getAllFeedbacksForAdmin = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('user_id', 'name email college role')
      .populate('event_id', 'title category start_date')
      .populate({
        path: 'replies.user_id',
        select: 'name college role'
      })
      .sort({ timestamp: -1 })
      .lean();

    // Calculate stats
    const totalFeedbacks = feedbacks.length;
    const averageRating = feedbacks.length > 0 
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length 
      : 0;
    
    // Count unique events with reviews
    const uniqueEvents = new Set(feedbacks.map(f => f.event_id?._id?.toString()).filter(Boolean));
    const totalEvents = uniqueEvents.size;
    
    // Count recent feedbacks (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentFeedbacks = feedbacks.filter(f => new Date(f.timestamp) > sevenDaysAgo).length;

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        stats: {
          totalFeedbacks,
          averageRating: Math.round(averageRating * 10) / 10,
          totalEvents,
          recentFeedbacks
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all feedbacks for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedbacks',
      error: error.message
    });
  }
};

