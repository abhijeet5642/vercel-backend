const Registration = require('../models/Registration');
const Event = require('../models/Event');
const path = require('path');
const XLSX = require('xlsx');

// Initialize Stripe with better error handling
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
    });
    console.log('Stripe initialized successfully');
  } else {
    console.warn('STRIPE_SECRET_KEY not found in environment variables');
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error.message);
}

// Register for an event
exports.registerForEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;

    // Validate eventId format
    if (!eventId || eventId.length !== 24) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      console.log('Event not found:', eventId);
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if registration is open
    if (!event.registration_open) {
      return res.status(400).json({ 
        error: event.current_registrations >= event.registration_limit 
          ? 'Event is full' 
          : 'Registration is closed for this event' 
      });
    }

    // Check if user is already registered
    const existingRegistration = await Registration.findOne({
      event_id: eventId,
      user_id: userId
    });

    if (existingRegistration) {
      return res.status(400).json({ 
        error: 'You are already registered for this event',
        status: existingRegistration.status
      });
    }

    // Handle payment for paid events
    if (event.price > 0) {
      if (!stripe) {
        return res.status(500).json({ 
          error: 'Payment processing is temporarily unavailable. Please try again later or contact administrator.' 
        });
      }

      try {
        const frontendBase = process.env.FRONTEND_URL || 'https://vercel-frontend-gilt-beta.vercel.app/';
        
        // Validate required data for Stripe session
        if (!event.title || !event._id) {
          throw new Error('Event data incomplete for payment processing');
        }

        const sessionData = {
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'inr',
              product_data: {
                name: event.title,
                description: `Registration for ${event.title} at ${event.college_name || 'Campus Event'}`,
                images: event.image ? [`${frontendBase}/api/events/uploads/${path.basename(event.image)}`] : []
              },
              unit_amount: Math.round(event.price * 100), // Convert to paise (smallest currency unit)
            },
            quantity: 1,
          }],
          metadata: {
            eventId: event._id.toString(),
            userId: userId,
            eventTitle: event.title,
            userEmail: req.user.email || 'N/A'
          },
          customer_email: req.user.email,
          success_url: `${frontendBase}/event-register/${eventId}?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendBase}/event-register/${eventId}?payment_cancelled=true`,
          expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
        };

        const session = await stripe.checkout.sessions.create(sessionData);

        return res.status(200).json({
          success: true,
          paymentUrl: session.url,
          sessionId: session.id,
          amount: session.amount_total / 100, // Convert back to rupees for display
          currency: session.currency
        });

      } catch (stripeError) {
        console.error('Stripe session creation error:', {
          type: stripeError.type,
          message: stripeError.message
        });

        // Return more specific error messages based on Stripe error type
        let errorMessage = 'Failed to create payment session.';
        
        if (stripeError.type === 'StripeInvalidRequestError') {
          if (stripeError.param) {
            errorMessage = `Invalid payment parameter: ${stripeError.param}. Please contact support.`;
          } else {
            errorMessage = 'Invalid payment request. Please contact support.';
          }
        } else if (stripeError.type === 'StripeAPIError') {
          errorMessage = 'Payment service temporarily unavailable. Please try again.';
        } else if (stripeError.type === 'StripeConnectionError') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (stripeError.type === 'StripeAuthenticationError') {
          errorMessage = 'Payment authentication failed. Please contact administrator.';
        } else if (stripeError.type === 'StripeRateLimitError') {
          errorMessage = 'Too many requests. Please try again later.';
        }

        return res.status(500).json({ 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? {
            type: stripeError.type,
            message: stripeError.message,
            param: stripeError.param
          } : undefined
        });
      }
    }

    // Create new registration with pending status for free events
    try {
      const registration = await Registration.create({
        event_id: eventId,
        user_id: userId,
        status: 'pending'
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Awaiting approval.',
        data: { registration }
      });

    } catch (dbError) {
      console.error('Database error creating registration:', dbError);
      throw new Error('Failed to create registration record');
    }

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) { // MongoDB duplicate key error
      return res.status(400).json({ error: 'You are already registered for this event' });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to register for event',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update the verification function
exports.verifyPaymentAndCreateRegistration = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID is required' 
      });
    }

    if (!stripe) {
      console.error('Stripe not initialized');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment service not configured' 
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment not completed',
        payment_status: session.payment_status 
      });
    }

    const { eventId } = session.metadata;

    if (!eventId) {
      console.error('Event ID not found in session metadata:', session.metadata);
      return res.status(400).json({ 
        success: false, 
        error: 'Event ID not found in session metadata' 
      });
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        error: 'Event not found' 
      });
    }

    // Check if registration already exists
    let registration = await Registration.findOne({ 
      event_id: eventId, 
      user_id: userId 
    });

    if (!registration) {
      // Create new registration with pending status
      registration = await Registration.create({
        event_id: eventId,
        user_id: userId,
        status: 'pending',
        stripe_payment_id: session.payment_intent || session.id,
      });

    } else {
      // Update existing registration
      registration.status = 'pending';
      registration.stripe_payment_id = session.payment_intent || session.id;
      await registration.save();
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and registration created successfully',
      data: { 
        registration: {
          _id: registration._id,
          status: registration.status,
          event_id: eventId,
          user_id: userId,
          payment_verified: true
        }
      }
    });

  } catch (error) {
    console.error('Error verifying payment and creating registration:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify payment',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get registration status for an event
exports.getRegistrationStatus = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;

    const registration = await Registration.findOne({
      event_id: eventId,
      user_id: userId
    }).populate('event_id', 'title');

    if (!registration) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'not_registered'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        status: registration.status,
        registrationId: registration._id,
        eventTitle: registration.event_id?.title
      }
    });

  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ error: 'Failed to get registration status' });
  }
};

// Get all registrations for a user
exports.getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;

    const registrations = await Registration.find({ user_id: userId })
      .populate('event_id')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: { registrations }
    });

  } catch (error) {
    console.error('Get user registrations error:', error);
    res.status(500).json({ error: 'Failed to get user registrations' });
  }
};

// Get all registrations for an event (admin only)
exports.getEventRegistrations = async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // Check if user is authorized (event creator or admin)
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isAuthorized = event.created_by.toString() === req.user.id || 
                        ['college_admin', 'super_admin'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to view registrations' });
    }

    const registrations = await Registration.find({ event_id: eventId })
      .populate('user_id', 'name email college')
      .sort({ timestamp: -1 });

    // Filter out registrations where user has been deleted
    const validRegistrations = registrations.filter(reg => reg.user_id !== null);

    res.status(200).json({
      success: true,
      data: { registrations: validRegistrations }
    });

  } catch (error) {
    console.error('Get event registrations error:', error);
    res.status(500).json({ error: 'Failed to get event registrations' });
  }
};

// Get all registrations across all events (admin only)
exports.getAllRegistrations = async (req, res) => {
  try {
    // Check if user is admin
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let registrations;

    if (req.user.role === 'college_admin') {
      // College admin: only get registrations for events they created
      registrations = await Registration.find()
        .populate({
          path: 'user_id', 
          select: 'name email college'
        })
        .populate({
          path: 'event_id', 
          select: 'title category college_name created_by',
          populate: {
            path: 'created_by',
            select: 'name email'
          },
          match: { created_by: req.user.id } // Filter events by creator
        })
        .sort({ timestamp: -1 });

      // Filter out registrations where event_id is null (due to match filter)
      registrations = registrations.filter(reg => reg.event_id !== null);
    } else {
      // Super admin: get all registrations
      registrations = await Registration.find()
        .populate({
          path: 'user_id', 
          select: 'name email college'
        })
        .populate({
          path: 'event_id', 
          select: 'title category college_name created_by',
          populate: {
            path: 'created_by',
            select: 'name email'
          }
        })
        .sort({ timestamp: -1 });
    }

    // Filter out registrations where user has been deleted
    const validRegistrations = registrations.filter(reg => 
      reg.user_id !== null && reg.event_id !== null
    );

    // Format the data to include event information
    const formattedRegistrations = validRegistrations.map(reg => ({
      _id: reg._id,
      user_id: reg.user_id,
      event_id: {
        ...reg.event_id.toObject(),
        created_by: reg.event_id.created_by
      },
      eventTitle: reg.event_id?.title,
      eventType: reg.event_id?.category,
      status: reg.status,
      timestamp: reg.timestamp,
      created_at: reg.created_at
    }));

    res.status(200).json({
      success: true,
      data: { registrations: formattedRegistrations }
    });

  } catch (error) {
    console.error('Get all registrations error:', error);
    res.status(500).json({ error: 'Failed to get all registrations' });
  }
};

// Update registration status (admin only)
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const registration = await Registration.findById(registrationId)
      .populate('event_id')
      .populate('user_id', 'name email');
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if user is authorized (event creator or admin)
    const isAuthorized = registration.event_id.created_by.toString() === req.user.id || 
                        ['college_admin', 'super_admin'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to update registration' });
    }

    const oldStatus = registration.status;
    
    // Handle registration count changes based on status transitions
    if (oldStatus !== status) {
      // Pending -> Approved: Increment count
      if (oldStatus === 'pending' && status === 'approved') {
        await Event.findByIdAndUpdate(registration.event_id._id, {
          $inc: { current_registrations: 1 }
        });
      }
      // Approved -> Rejected/Pending: Decrement count
      else if (oldStatus === 'approved' && (status === 'rejected' || status === 'pending')) {
        await Event.findByIdAndUpdate(registration.event_id._id, {
          $inc: { current_registrations: -1 }
        });
      }
      // Rejected -> Approved: Increment count
      else if (oldStatus === 'rejected' && status === 'approved') {
        await Event.findByIdAndUpdate(registration.event_id._id, {
          $inc: { current_registrations: 1 }
        });
      }
    }

    // Update registration status
    registration.status = status;
    await registration.save();

    // Log this activity
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'registration_status_update',
      description: `${status.charAt(0).toUpperCase() + status.slice(1)} registration for ${registration.user_id.name} in event "${registration.event_id.title}"`,
      details: {
        registration_id: registrationId,
        event_id: registration.event_id._id,
        event_title: registration.event_id.title,
        student_name: registration.user_id.name,
        student_email: registration.user_id.email,
        old_status: oldStatus,
        new_status: status
      }
    });

    // Send notification to student about registration status change
    try {
      const { createNotification } = require('./notificationController');
      let message = '';
      let notificationType = '';
      
      if (status === 'approved') {
        message = `Your registration for "${registration.event_id.title}" has been approved! See you at the event.`;
        notificationType = 'registration_approved';
      } else if (status === 'rejected') {
        message = `Your registration for "${registration.event_id.title}" was not approved.`;
        notificationType = 'registration_rejected';
      }
      
      if (message) {
        await createNotification(
          registration.user_id._id,
          message,
          notificationType,
          registration.event_id._id,
          registration._id
        );
      }
    } catch (notifError) {
      console.error('Failed to send registration status notification:', notifError);
      // Continue even if notification fails
    }

    // Send email with ticket for approved registrations
    if (status === 'approved') {
      try {
        const { sendTicketApprovalEmail } = require('../utils/emailService');
        const emailResult = await sendTicketApprovalEmail(
          registration.user_id,
          registration.event_id,
          registration
        );
        
        if (!emailResult.success) {
          console.log('Ticket approval email not sent:', emailResult.message || emailResult.error);
        }
      } catch (emailError) {
        console.error('Failed to send ticket approval email:', emailError);
        // Continue even if email fails
      }
    } else if (status === 'rejected') {
      // Send rejection email
      try {
        const { sendRejectionEmail } = require('../utils/emailService');
        const emailResult = await sendRejectionEmail(
          registration.user_id,
          registration.event_id,
          req.body.reason || ''
        );
        
        if (emailResult.success) {
          console.log('Rejection email sent successfully');
        }
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Continue even if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: `Registration ${status} successfully`,
      data: { registration }
    });

  } catch (error) {
    console.error('Update registration status error:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
};

// Export registrations to Excel (admin only)
exports.exportRegistrationsToExcel = async (req, res) => {
  try {
    const { eventId } = req.query; // Optional: filter by specific event
    
    // Check if user is admin
    if (!['college_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let registrationFilter = {};
    
    // Role-based filtering
    if (req.user.role === 'college_admin') {
      // Get events created by this admin
      const adminEvents = await Event.find({ created_by: req.user.id }).select('_id');
      const adminEventIds = adminEvents.map(event => event._id);
      registrationFilter.event_id = { $in: adminEventIds };
    }
    
    // If specific event requested
    if (eventId) {
      registrationFilter.event_id = eventId;
    }

    // Fetch registrations with populated data
    const registrations = await Registration.find(registrationFilter)
      .populate({
        path: 'user_id',
        select: 'name email college phone'
      })
      .populate({
        path: 'event_id',
        select: 'title category start_date end_date location college_name price registration_limit'
      })
      .sort({ timestamp: -1 });

    // Filter out null references
    const validRegistrations = registrations.filter(reg => 
      reg.user_id !== null && reg.event_id !== null
    );

    // Prepare data for Excel
    const excelData = validRegistrations.map((reg, index) => ({
      'S.No': index + 1,
      'Registration ID': reg._id.toString(),
      'Student Name': reg.user_id.name,
      'Email': reg.user_id.email,
      'College': reg.user_id.college,
      'Phone': reg.user_id.phone || 'N/A',
      'Event Title': reg.event_id.title,
      'Event Category': reg.event_id.category,
      'Event Date': new Date(reg.event_id.start_date).toLocaleDateString('en-US'),
      'Event Time': new Date(reg.event_id.start_date).toLocaleTimeString('en-US'),
      'Event Location': reg.event_id.location,
      'Event College': reg.event_id.college_name,
      'Registration Fee': reg.event_id.price === 0 ? 'Free' : `₹${reg.event_id.price}`,
      'Registration Status': reg.status.toUpperCase(),
      'Ticket Available': reg.status === 'approved' ? 'YES' : 'NO',
      'Ticket Download Link': reg.status === 'approved' 
        ? `${process.env.FRONTEND_URL || 'https://campuseventhub-1.onrender.com'}/api/tickets/${reg._id}`
        : 'N/A',
      'Registration Date': new Date(reg.timestamp).toLocaleDateString('en-US'),
      'Registration Time': new Date(reg.timestamp).toLocaleTimeString('en-US'),
      'Payment ID': reg.stripe_payment_id || 'N/A',
      'Event Capacity': reg.event_id.registration_limit,
      'QR Code Data': JSON.stringify({
        registrationId: reg._id,
        eventId: reg.event_id._id,
        userId: reg.user_id._id,
        timestamp: reg.timestamp
      })
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 5 },  // S.No
      { wch: 25 }, // Registration ID
      { wch: 20 }, // Student Name
      { wch: 30 }, // Email
      { wch: 25 }, // College
      { wch: 15 }, // Phone
      { wch: 30 }, // Event Title
      { wch: 15 }, // Event Category
      { wch: 12 }, // Event Date
      { wch: 12 }, // Event Time
      { wch: 25 }, // Event Location
      { wch: 25 }, // Event College
      { wch: 15 }, // Registration Fee
      { wch: 15 }, // Registration Status
      { wch: 15 }, // Ticket Available
      { wch: 50 }, // Ticket Download Link
      { wch: 15 }, // Registration Date
      { wch: 15 }, // Registration Time
      { wch: 20 }, // Payment ID
      { wch: 15 }, // Event Capacity
      { wch: 40 }  // QR Code Data
    ];
    
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    const sheetName = eventId ? `Event_Registrations_${eventId.slice(-6)}` : 'All_Registrations';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    const fileName = `registrations_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send file
    res.send(excelBuffer);

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export registrations to Excel',
      message: error.message 
    });
  }
};
