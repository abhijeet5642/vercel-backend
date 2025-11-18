const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');

/**
 * Generate QR code for a registration
 */
const generateQRCode = async (registrationId) => {
  try {
    // Create a verification URL or data string
    const qrData = JSON.stringify({
      registrationId: registrationId,
      timestamp: new Date().toISOString(),
      type: 'event_ticket'
    });
    
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate PDF ticket with QR code - Compact Rectangle Design
 */
const generateTicketPDF = async (registration, event, user, qrCodeDataURL) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a compact ticket - landscape orientation, smaller size
      const doc = new PDFDocument({ 
        size: [600, 280],  // Width x Height (landscape, compact)
        margin: 0 
      });
      const chunks = [];

      // Collect PDF data
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ===== LEFT SIDE: EVENT INFORMATION =====
      const leftWidth = 370;
      const rightWidth = 230;
      
      // Background gradient effect (left side)
      doc.rect(0, 0, leftWidth, 280).fill('#3B82F6');
      
      // Header
      doc.fillColor('#FFFFFF')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('EVENT TICKET', 20, 20);
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#E0E7FF')
         .text('CampusEventHub', 20, 45);

      // Divider line
      doc.moveTo(20, 60)
         .lineTo(leftWidth - 20, 60)
         .strokeColor('#FFFFFF')
         .lineWidth(1)
         .stroke();

      // Event Title
      doc.fillColor('#FFFFFF')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(event.title.length > 40 ? event.title.substring(0, 40) + '...' : event.title, 
               20, 70, { width: leftWidth - 40, lineGap: 2 });

      // Event Details
      let yPos = 100;
      const lineHeight = 18;
      
      // Date
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#E0E7FF')
         .text('DATE:', 20, yPos);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#FFFFFF')
         .text(new Date(event.start_date).toLocaleDateString('en-US', {
           month: 'short',
           day: 'numeric',
           year: 'numeric'
         }), 80, yPos);

      yPos += lineHeight;

      // Time
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#E0E7FF')
         .text('TIME:', 20, yPos);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#FFFFFF')
         .text(new Date(event.start_date).toLocaleTimeString('en-US', {
           hour: '2-digit',
           minute: '2-digit'
         }), 80, yPos);

      yPos += lineHeight;

      // Location
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#E0E7FF')
         .text('LOCATION:', 20, yPos);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#FFFFFF')
         .text(event.location.length > 30 ? event.location.substring(0, 30) + '...' : event.location, 
               80, yPos, { width: leftWidth - 100 });

      yPos += lineHeight;

      // College
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#E0E7FF')
         .text('COLLEGE:', 20, yPos);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#FFFFFF')
         .text(event.college_name.length > 28 ? event.college_name.substring(0, 28) + '...' : event.college_name, 
               80, yPos, { width: leftWidth - 100 });

      yPos += lineHeight + 8;

      // Attendee Info Section
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#E0E7FF')
         .text('ATTENDEE:', 20, yPos);
      
      yPos += 15;
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text(user.name.length > 30 ? user.name.substring(0, 30) + '...' : user.name, 20, yPos);
      
      yPos += 14;
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#E0E7FF')
         .text(user.email.length > 35 ? user.email.substring(0, 35) + '...' : user.email, 20, yPos);

      // Registration ID at bottom
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#93C5FD')
         .text(`ID: ${registration._id.toString().substring(0, 12)}...`, 20, 258);

      // ===== RIGHT SIDE: QR CODE =====
      
      // White background for right side
      doc.rect(leftWidth, 0, rightWidth, 280).fill('#FFFFFF');

      // QR Code Section Header
      doc.fillColor('#3B82F6')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('SCAN TO VERIFY', leftWidth + 20, 30, { 
           width: rightWidth - 40, 
           align: 'center' 
         });

      // Add QR Code
      const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
      const qrSize = 150;
      const qrX = leftWidth + (rightWidth - qrSize) / 2;
      const qrY = 60;
      
      doc.image(qrBuffer, qrX, qrY, { 
        width: qrSize, 
        height: qrSize 
      });

      // Instructions
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#6B7280')
         .text('Present this at entrance', leftWidth + 20, 225, {
           width: rightWidth - 40,
           align: 'center'
         });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * @route   GET /api/tickets/:registrationId
 * @desc    Download ticket for a registration
 * @access  Private (Student or Admin)
 */
exports.downloadTicket = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // Find registration and populate event and user details
    const registration = await Registration.findById(registrationId)
      .populate('event_id')
      .populate('user_id');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }

    // Check if user is authorized to download this ticket
    if (req.user.role !== 'super_admin' && 
        req.user.role !== 'college_admin' && 
        registration.user_id._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this ticket'
      });
    }

    // Check if registration is approved
    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Ticket is only available for approved registrations'
      });
    }

    const event = registration.event_id;
    const user = registration.user_id;

    // Generate QR code
    const qrCodeDataURL = await generateQRCode(registration._id.toString());

    // Generate PDF ticket
    const pdfBuffer = await generateTicketPDF(registration, event, user, qrCodeDataURL);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket-${registration._id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error downloading ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate ticket',
      message: error.message
    });
  }
};

/**
 * @route   GET /api/tickets/verify/:registrationId
 * @desc    Verify a ticket using QR code data
 * @access  Private (Admin)
 */
exports.verifyTicket = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // Find registration
    const registration = await Registration.findById(registrationId)
      .populate('event_id', 'title start_date location')
      .populate('user_id', 'name email college');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Invalid ticket',
        verified: false
      });
    }

    // Check if registration is approved
    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Ticket is not approved',
        verified: false
      });
    }

    // Return verification details
    res.status(200).json({
      success: true,
      verified: true,
      data: {
        registration: {
          id: registration._id,
          status: registration.status,
          registeredAt: registration.createdAt
        },
        event: {
          title: registration.event_id.title,
          date: registration.event_id.start_date,
          location: registration.event_id.location
        },
        user: {
          name: registration.user_id.name,
          email: registration.user_id.email,
          college: registration.user_id.college
        }
      }
    });

  } catch (error) {
    console.error('Error verifying ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify ticket',
      verified: false
    });
  }
};

module.exports = exports;

