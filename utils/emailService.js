const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  // Check if email configuration exists
  const missingVars = [];
  if (!process.env.EMAIL_HOST) missingVars.push('EMAIL_HOST');
  if (!process.env.EMAIL_USER) missingVars.push('EMAIL_USER');
  if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Email configuration incomplete. Missing:', missingVars.join(', '));
    console.warn('⚠️  Email notifications will be disabled.');
    console.warn('ℹ️  To enable emails, add these to your .env file:');
    console.warn('   EMAIL_HOST=smtp.gmail.com');
    console.warn('   EMAIL_PORT=587');
    console.warn('   EMAIL_SECURE=false');
    console.warn('   EMAIL_USER=your-email@gmail.com');
    console.warn('   EMAIL_PASS=your-app-password');
    console.warn('ℹ️  See Backend/EMAIL_SETUP.md for detailed setup instructions');
    return null;
  }

  try {
    // Note: It's createTransport (not createTransporter)
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } catch (error) {
    console.error('❌ Error creating email transporter:', error.message);
    return null;
  }
};

/**
 * Send ticket approval email with download link
 */
exports.sendTicketApprovalEmail = async (user, event, registration) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured. Skipping email notification.');
      return { success: false, message: 'Email service not configured' };
    }

    const ticketDownloadLink = `${process.env.FRONTEND_URL || 'https://campuseventhub-1.onrender.com'}/student-dashboard`;


    const mailOptions = {
      from: `"CampusEventHub" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🎉 Your Registration for "${event.title}" has been Approved!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
            }
            .event-details {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #3B82F6;
            }
            .event-details h2 {
              color: #3B82F6;
              margin-top: 0;
            }
            .detail-row {
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: bold;
              color: #666;
              display: inline-block;
              width: 120px;
            }
            .download-button {
              display: inline-block;
              background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
              background-color: #3B82F6 !important;
              color: #ffffff !important;
              padding: 15px 40px;
              text-decoration: none !important;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              text-align: center;
              margin: 20px 0;
              border: 2px solid #3B82F6;
              box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
              -webkit-text-fill-color: #ffffff;
              mso-line-height-rule: exactly;
            }
            .download-button:hover {
              background-color: #2563EB !important;
              opacity: 0.95;
            }
            .download-button span {
              color: #ffffff !important;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 14px;
              background: #f9fafb;
              border-radius: 0 0 10px 10px;
            }
            .badge {
              display: inline-block;
              background: #10B981;
              color: white;
              padding: 5px 15px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: bold;
            }
            .info-box {
              background: #EFF6FF;
              border: 1px solid #BFDBFE;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Registration Approved!</h1>
          </div>
          
          <div class="content">
            <p>Dear <strong>${user.name}</strong>,</p>
            
            <p>Great news! Your registration for the following event has been <span class="badge">APPROVED</span></p>
            
            <div class="event-details">
              <h2>${event.title}</h2>
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                ${new Date(event.start_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Time:</span>
                ${new Date(event.start_date).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div class="detail-row">
                <span class="detail-label">📍 Location:</span>
                ${event.location}
              </div>
              <div class="detail-row">
                <span class="detail-label">🏫 College:</span>
                ${event.college_name}
              </div>
              <div class="detail-row">
                <span class="detail-label">🎫 Registration ID:</span>
                <code>${registration._id}</code>
              </div>
            </div>
            
            <div class="info-box">
              <strong>📥 Download Your Ticket</strong>
              <p style="margin: 10px 0;">Your event ticket with QR code is now ready! Login to your dashboard to download it.</p>
              <center>
                <a href="${ticketDownloadLink}" class="download-button" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); background-color: #3B82F6 !important; color: #ffffff !important; padding: 15px 40px; text-decoration: none !important; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; margin: 20px 0; border: 2px solid #3B82F6; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  <span style="color: #ffffff !important; -webkit-text-fill-color: #ffffff; text-decoration: none;">Go to Dashboard</span>
                </a>
              </center>
            </div>
            
            <div class="info-box">
              <strong>ℹ️ Important Instructions:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Please bring your ticket (digital or printed) to the event</li>
                <li>The QR code on your ticket will be scanned at the entrance</li>
                <li>Arrive at least 15 minutes before the event starts</li>
                <li>Keep your registration ID safe for reference</li>
              </ul>
            </div>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact the event organizers.</p>
            
            <p>We look forward to seeing you at the event!</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>CampusEventHub Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} CampusEventHub. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${user.name},

Great news! Your registration for "${event.title}" has been APPROVED!

Event Details:
- Event: ${event.title}
- Date: ${new Date(event.start_date).toLocaleDateString()}
- Time: ${new Date(event.start_date).toLocaleTimeString()}
- Location: ${event.location}
- College: ${event.college_name}
- Registration ID: ${registration._id}

Your event ticket with QR code is now ready! Login to your dashboard to download it:
${ticketDownloadLink}

Important Instructions:
- Please bring your ticket (digital or printed) to the event
- The QR code on your ticket will be scanned at the entrance
- Arrive at least 15 minutes before the event starts
- Keep your registration ID safe for reference

If you have any questions, please contact the event organizers.

We look forward to seeing you at the event!

Best regards,
CampusEventHub Team

---
This is an automated email. Please do not reply to this message.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending ticket approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send registration rejection email
 */
exports.sendRejectionEmail = async (user, event, reason = '') => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured. Skipping email notification.');
      return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: `"CampusEventHub" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Registration Update for "${event.title}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: #EF4444;
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 14px;
              background: #f9fafb;
              border-radius: 0 0 10px 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Registration Update</h1>
          </div>
          
          <div class="content">
            <p>Dear <strong>${user.name}</strong>,</p>
            
            <p>We regret to inform you that your registration for <strong>"${event.title}"</strong> was not approved.</p>
            
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            
            <p>We apologize for any inconvenience this may cause. Please feel free to register for other upcoming events on our platform.</p>
            
            <p>If you have any questions, please contact the event organizers.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>CampusEventHub Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} CampusEventHub. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${user.name},

We regret to inform you that your registration for "${event.title}" was not approved.

${reason ? `Reason: ${reason}` : ''}

We apologize for any inconvenience. Please feel free to register for other upcoming events.

Best regards,
CampusEventHub Team
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Rejection email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email with secure link
 */
exports.sendPasswordResetEmail = async (user, resetLink) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured. Skipping password reset email.');
      return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: `"CampusEventHub" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '🔐 Password Reset Request - CampusEventHub',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .header p {
              margin: 10px 0 0 0;
              font-size: 14px;
              opacity: 0.9;
            }
            .content {
              background: #f9fafb;
              padding: 40px 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .greeting {
              font-size: 18px;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .message-box {
              background: white;
              border-left: 4px solid #3B82F6;
              padding: 20px;
              margin: 25px 0;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            .reset-button {
              display: inline-block;
              background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
              background-color: #3B82F6 !important;
              color: #ffffff !important;
              padding: 16px 40px;
              text-decoration: none !important;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              text-align: center;
              margin: 20px 0;
              border: 2px solid #3B82F6;
              box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
              transition: transform 0.2s;
              -webkit-text-fill-color: #ffffff;
              mso-line-height-rule: exactly;
            }
            .reset-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(59, 130, 246, 0.4);
              background-color: #2563EB !important;
            }
            .reset-button span {
              color: #ffffff !important;
            }
            .warning-box {
              background: #FEF3C7;
              border: 1px solid #FCD34D;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .warning-box strong {
              color: #92400E;
              display: block;
              margin-bottom: 5px;
            }
            .warning-box p {
              color: #78350F;
              margin: 5px 0;
              font-size: 14px;
            }
            .info-list {
              background: #EFF6FF;
              border: 1px solid #BFDBFE;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-list ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .info-list li {
              color: #1E40AF;
              margin: 8px 0;
              font-size: 14px;
            }
            .link-box {
              background: #F3F4F6;
              border: 1px solid #D1D5DB;
              border-radius: 8px;
              padding: 15px;
              margin: 15px 0;
              word-break: break-all;
            }
            .link-box p {
              margin: 5px 0;
              font-size: 12px;
              color: #6B7280;
            }
            .link-box a {
              color: #3B82F6;
              text-decoration: none;
              font-size: 13px;
            }
            .footer {
              text-align: center;
              padding: 30px 20px;
              color: #666;
              font-size: 14px;
              background: #f9fafb;
              border-radius: 0 0 10px 10px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .footer p {
              margin: 5px 0;
            }
            .footer a {
              color: #3B82F6;
              text-decoration: none;
            }
            .divider {
              height: 1px;
              background: #E5E7EB;
              margin: 25px 0;
            }
            .badge {
              display: inline-block;
              background: #DC2626;
              color: white;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>CampusEventHub Security</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hello <strong>${user.name}</strong>,</p>
            
            <p>We received a request to reset the password for your CampusEventHub account associated with <strong>${user.email}</strong>.</p>
            
            <div class="message-box">
              <p><strong>🔒 Secure Password Reset</strong></p>
              <p style="margin-top: 10px;">Click the button below to securely reset your password. This link is valid for <strong>15 minutes</strong> only.</p>
              
              <center>
                <a href="${resetLink}" class="reset-button" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); background-color: #3B82F6 !important; color: #ffffff !important; padding: 16px 40px; text-decoration: none !important; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; margin: 20px 0; border: 2px solid #3B82F6; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  <span style="color: #ffffff !important; -webkit-text-fill-color: #ffffff; text-decoration: none;">Reset My Password</span>
                </a>
              </center>
              
              <p style="margin-top: 15px; font-size: 13px; color: #6B7280;">
                <strong>Link expires in:</strong> <span class="badge">15 MINUTES</span>
              </p>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Important Security Notice</strong>
              <p>• If you didn't request this password reset, please ignore this email</p>
              <p>• Your password will remain unchanged</p>
              <p>• Consider changing your password if you suspect unauthorized access</p>
            </div>
            
            <div class="divider"></div>
            
            <div class="info-list">
              <strong style="color: #1E40AF; display: block; margin-bottom: 10px;">📋 What Happens Next?</strong>
              <ul>
                <li>Click the "Reset My Password" button above</li>
                <li>You'll be redirected to a secure page</li>
                <li>Enter your new password (minimum 6 characters)</li>
                <li>Confirm your new password</li>
                <li>Login with your new credentials</li>
              </ul>
            </div>
            
            <div class="divider"></div>
            
            <div class="link-box">
              <p><strong>Button not working?</strong></p>
              <p>Copy and paste this link into your browser:</p>
              <a href="${resetLink}">${resetLink}</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
              <strong>Need help?</strong><br>
              If you're having trouble resetting your password or if you didn't request this change, please contact our support team immediately.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>CampusEventHub</strong></p>
            <p>Your Campus Event Management Platform</p>
            <p style="margin-top: 15px; font-size: 12px; color: #9CA3AF;">
              This is an automated security email. Please do not reply to this message.<br>
              For security reasons, password reset links expire after 15 minutes.
            </p>
            <p style="margin-top: 15px;">
              &copy; ${new Date().getFullYear()} CampusEventHub. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${user.name},

We received a request to reset the password for your CampusEventHub account.

RESET YOUR PASSWORD:
${resetLink}

This link is valid for 15 minutes only.

IMPORTANT SECURITY NOTICE:
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged
- Consider changing your password if you suspect unauthorized access

WHAT HAPPENS NEXT?
1. Click the reset link above
2. You'll be redirected to a secure page
3. Enter your new password (minimum 6 characters)
4. Confirm your new password
5. Login with your new credentials

Need help?
If you're having trouble or didn't request this change, please contact our support team.

Best regards,
CampusEventHub Team

---
This is an automated security email. Please do not reply to this message.
For security reasons, password reset links expire after 15 minutes.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = exports;

