const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const registrationController = require('../controllers/registrationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');

// ---------------------------------------------------------
// 1. CONFIGURATION FOR VERCEL (MEMORY STORAGE)
// ---------------------------------------------------------

// Use memoryStorage so files are stored in RAM (Buffer), not on the hard drive
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, JPG, PNG, WebP)'), false);
  }
};

// Configure multer with size limit (5MB)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware to handle multer errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Too many files. Only one image allowed.' });
    }
  }
  
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  
  next();
};

// ---------------------------------------------------------
// 2. ROUTES
// ---------------------------------------------------------

// PUBLIC ROUTES (no authentication required)

// Debug route to check events in database
router.get('/debug', async (req, res) => {
  try {
    // Note: Ensure the path to your model is correct relative to this file
    const Event = require('../models/Event');
    const events = await Event.find().limit(5);
    res.json({
      success: true,
      count: events.length,
      events: events.map(e => ({
        id: e._id,
        title: e.title,
        college_name: e.college_name,
        category: e.category,
        location: e.location
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events with filtering and pagination
router.get('/', eventController.getAllEvents);

// Get featured events
router.get('/featured', eventController.getFeaturedEvents);

// Get single event by ID
router.get('/:id', eventController.getEventById);

// Get events by college
router.get('/college/:collegeId', eventController.getEventsByCollege);

// PROTECTED ROUTES (authentication required)

// Create new event (admin only)
router.post('/create', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  upload.single('image'), // This now puts the file in req.file.buffer
  handleUploadErrors,
  eventController.createEvent
);

// Update event (creator or admin)
router.patch('/:id', 
  protect,
  upload.single('image'),
  handleUploadErrors,
  eventController.updateEvent
);

// Delete event (creator or admin)
router.delete('/:id', protect, eventController.deleteEvent);

// ADMIN ONLY ROUTES

// Toggle featured status
router.patch('/:id/featured', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  eventController.toggleFeatured
);

// Get event statistics
router.get('/admin/stats', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  eventController.getEventStats
);

/* NOTE: I removed the '/uploads/:filename' route. 
   Since we are not saving to disk, we cannot serve files from disk.
   Your frontend should now use the Cloudinary URL stored in the database.
*/

// Registration routes

// Get registration status for current user
router.get('/:eventId/registration/status', protect, registrationController.getRegistrationStatus);

router.post('/verify-payment-registration', 
  protect,
  registrationController.verifyPaymentAndCreateRegistration
);

// Register for an event
router.post('/:eventId/register', protect, registrationController.registerForEvent);

// Get all registrations for current user
router.get('/user/registrations', protect, registrationController.getUserRegistrations);

// Get all registrations across all events (admin only)
router.get('/all/registrations', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  registrationController.getAllRegistrations
);

// Get all registrations for an event (admin only)
router.get('/:eventId/registrations', 
  protect,
  registrationController.getEventRegistrations
);

// Update registration status (admin only)
router.patch('/registrations/:registrationId', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  registrationController.updateRegistrationStatus
);

// Export registrations to Excel (admin only)
router.get('/export/registrations/excel', 
  protect, 
  restrictTo('college_admin', 'super_admin'),
  registrationController.exportRegistrationsToExcel
);

module.exports = router;