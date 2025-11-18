const Event = require('../models/Event');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Helper function to delete uploaded file if error occurs
const deleteUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Create a new event
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      start_date,
      end_date,
      college_name,
      registration_limit,
      price = 0,
      tags,
      registration_deadline
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !location || !start_date || !end_date || !registration_limit) {
      if (req.file) deleteUploadedFile(req.file.path);
      return res.status(400).json({ 
        error: 'Please provide all required fields: title, description, category, location, start_date, end_date, registration_limit' 
      });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const now = new Date();

    if (startDate <= now) {
      if (req.file) deleteUploadedFile(req.file.path);
      return res.status(400).json({ error: 'Start date must be in the future' });
    }

    if (endDate <= startDate) {
      if (req.file) deleteUploadedFile(req.file.path);
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Get the creating user
    const creatingUser = await User.findById(req.user.id);
    if (!creatingUser) {
      if (req.file) deleteUploadedFile(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    // For now, use the creating user's college info
    // In future, you might want to map college_name to a separate colleges collection
    const collegeId = creatingUser._id; // Using user ID as college reference for now
    const finalCollegeName = college_name || creatingUser.college;

    // Handle image upload
    let imagePath = null;
    if (req.file) {
      // Store relative path for serving files
      imagePath = `/uploads/events/${req.file.filename}`;
    }

    // Process tags if provided
    let processedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        processedTags = tags.filter(tag => tag && tag.trim().length > 0);
      }
    }

    // Create the event
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      start_date: startDate,
      end_date: endDate,
      college_id: collegeId,
      college_name: finalCollegeName,
      created_by: req.user.id,
      registration_limit: parseInt(registration_limit),
      price: parseFloat(price) || 0,
      image: imagePath,
      tags: processedTags
    };

    // Add registration deadline if provided
    if (registration_deadline) {
      const regDeadline = new Date(registration_deadline);
      if (regDeadline > startDate) {
        if (req.file) deleteUploadedFile(req.file.path);
        return res.status(400).json({ error: 'Registration deadline must be before or same as start date' });
      }
      eventData.registration_deadline = regDeadline;
    }

    const event = await Event.create(eventData);

    // Populate the created event with user details
    const populatedEvent = await Event.findById(event._id)
      .populate('created_by', 'name email college role')
      .populate('college_id', 'name college');

    // Log this activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'event_created',
        description: `Created event "${title}"`,
        details: {
          event_id: event._id,
          event_title: title,
          category: category,
          start_date: startDate,
          registration_limit: parseInt(registration_limit)
        }
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
      // Don't fail the request if logging fails
    }

    // Send notifications to all students about the new event
    try {
      const { notifyStudentsAboutNewEvent } = require('./notificationController');
      await notifyStudentsAboutNewEvent(event);
    } catch (notifError) {
      console.error('Failed to send notifications:', notifError);
      // Continue even if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event: populatedEvent
      }
    });

  } catch (error) {
    console.error('Create event error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file) deleteUploadedFile(req.file.path);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: validationErrors.join('. ') });
    }

    res.status(500).json({ error: 'Failed to create event. Please try again.' });
  }
};

// Get all events with filtering and pagination
exports.getAllEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // College filter
    if (req.query.college) {
      filter.college_name = new RegExp(req.query.college, 'i');
    }

    // Location filter
    if (req.query.location) {
      filter.location = new RegExp(req.query.location, 'i');
    }

    // Date range filters
    if (req.query.start_date || req.query.end_date) {
      filter.start_date = {};
      if (req.query.start_date) {
        filter.start_date.$gte = new Date(req.query.start_date);
      }
      if (req.query.end_date) {
        filter.start_date.$lte = new Date(req.query.end_date);
      }
    }

    // Search filter (title, description, college_name, or location)
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') },
        { college_name: new RegExp(req.query.search, 'i') },
        { location: new RegExp(req.query.search, 'i') }
      ];
    }

    // Featured events only
    if (req.query.featured === 'true') {
      filter.is_featured = true;
    }

    // Upcoming events only
    if (req.query.upcoming === 'true') {
      filter.start_date = { $gte: new Date() };
      filter.status = { $in: ['upcoming', 'active'] };
    }

    // Execute query with pagination
    const events = await Event.find(filter)
      .populate('created_by', 'name email college role')
      .populate('college_id', 'name college')
      .sort({ start_date: req.query.sort === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Event.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_events: total,
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

// Get single event by ID
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('created_by', 'name email college role')
      .populate('college_id', 'name college');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.status(200).json({
      success: true,
      data: { event }
    });

  } catch (error) {
    console.error('Get event by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

// Update event (only by creator or admin)
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user can update (creator or admin)
    const canUpdate = event.created_by.toString() === req.user.id || 
                     ['college_admin', 'super_admin'].includes(req.user.role);

    if (!canUpdate) {
      return res.status(403).json({ error: 'You can only update events you created' });
    }

    // Don't allow updates to completed or cancelled events
    if (['completed', 'cancelled'].includes(event.status)) {
      return res.status(400).json({ error: `Cannot update ${event.status} event` });
    }

    const allowedUpdates = [
      'title', 'description', 'location', 'start_date', 'end_date', 
      'registration_limit', 'price', 'tags', 'registration_deadline'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validate date updates
    if (updates.start_date || updates.end_date) {
      const startDate = new Date(updates.start_date || event.start_date);
      const endDate = new Date(updates.end_date || event.end_date);
      
      if (startDate <= new Date()) {
        return res.status(400).json({ error: 'Start date must be in the future' });
      }
      
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (event.image) {
        const oldImagePath = path.join(__dirname, '..', 'uploads', 'events', path.basename(event.image));
        deleteUploadedFile(oldImagePath);
      }
      updates.image = `/uploads/events/${req.file.filename}`;
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('created_by', 'name email college role')
      .populate('college_id', 'name college');

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: { event: updatedEvent }
    });

  } catch (error) {
    console.error('Update event error:', error);
    
    if (req.file) deleteUploadedFile(req.file.path);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: validationErrors.join('. ') });
    }

    res.status(500).json({ error: 'Failed to update event' });
  }
};

// Delete event (only by creator or admin)
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user can delete (creator or admin)
    const canDelete = event.created_by.toString() === req.user.id || 
                     ['college_admin', 'super_admin'].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({ error: 'You can only delete events you created' });
    }

    // Don't allow deletion of active events with registrations
    if (event.status === 'active' && event.current_registrations > 0) {
      return res.status(400).json({ error: 'Cannot delete active event with registrations' });
    }

    // Delete associated image file
    if (event.image) {
      const imagePath = path.join(__dirname, '..', 'uploads', 'events', path.basename(event.image));
      deleteUploadedFile(imagePath);
    }

    // Store event details before deletion for logging
    const eventTitle = event.title;
    const eventId = event._id;

    await Event.findByIdAndDelete(req.params.id);

    // Log this activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'event_deleted',
        description: `Deleted event "${eventTitle}"`,
        details: {
          event_id: eventId,
          event_title: eventTitle,
          had_registrations: event.current_registrations > 0,
          registration_count: event.current_registrations
        }
      });
    } catch (logError) {
      console.error('Error creating activity log:', logError);
      // Don't fail the request if logging fails
    }

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

// Get events by college
exports.getEventsByCollege = async (req, res) => {
  try {
    const { collegeId } = req.params;
    const options = {
      status: req.query.status,
      category: req.query.category,
      upcoming: req.query.upcoming === 'true'
    };

    const events = await Event.findByCollege(collegeId, options);

    res.status(200).json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get events by college error:', error);
    res.status(500).json({ error: 'Failed to fetch college events' });
  }
};

// Get featured events
exports.getFeaturedEvents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const events = await Event.findFeatured(limit);

    res.status(200).json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get featured events error:', error);
    res.status(500).json({ error: 'Failed to fetch featured events' });
  }
};

// Toggle featured status (admin only)
exports.toggleFeatured = async (req, res) => {
  try {
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    event.is_featured = !event.is_featured;
    await event.save();

    res.status(200).json({
      success: true,
      message: `Event ${event.is_featured ? 'featured' : 'unfeatured'} successfully`,
      data: { event }
    });

  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({ error: 'Failed to toggle featured status' });
  }
};

// Get event statistics (admin only)
exports.getEventStats = async (req, res) => {
  try {
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let eventFilter = {};
    let registrationFilter = {};

    // College admin only sees their own events and related registrations
    if (req.user.role === 'college_admin') {
      eventFilter.created_by = req.user.id;
      
      // Get events created by this admin first
      const adminEvents = await Event.find({ created_by: req.user.id }).select('_id');
      const adminEventIds = adminEvents.map(event => event._id);
      
      // Filter registrations to only include those for admin's events
      registrationFilter.event_id = { $in: adminEventIds };
    }
    // Super admin sees all events and registrations (no filter needed)

    const stats = await Event.aggregate([
      { $match: eventFilter },
      {
        $group: {
          _id: null,
          total_events: { $sum: 1 },
          upcoming_events: {
            $sum: { $cond: [{ $eq: ['$status', 'upcoming'] }, 1, 0] }
          },
          active_events: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completed_events: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get registration stats with the same filter
    const Registration = require('../models/Registration');
    const registrationStats = await Registration.aggregate([
      { $match: registrationFilter },
      {
        $group: {
          _id: null,
          total_registrations: { $sum: 1 },
          approved_registrations: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          pending_registrations: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    const eventData = stats[0] || {
      total_events: 0,
      upcoming_events: 0,
      active_events: 0,
      completed_events: 0
    };

    const registrationData = registrationStats[0] || {
      total_registrations: 0,
      approved_registrations: 0,
      pending_registrations: 0
    };

    res.status(200).json({
      success: true,
      data: {
        overview: {
          ...eventData,
          ...registrationData
        }
      }
    });

  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ error: 'Failed to fetch event statistics' });
  }
};
