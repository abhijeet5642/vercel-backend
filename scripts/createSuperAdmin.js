const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectToDb = async () => {
  try {
    // Use DB_CONNECT (same as db.js) or fallback to MONGO_URI
    const mongoUri = process.env.DB_CONNECT || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus-eventhub';
    console.log('Connecting to MongoDB...');
    console.log('Using connection string:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure MongoDB is running: net start MongoDB (Windows)');
    console.error('2. Check your DB_CONNECT in .env file');
    console.error('3. Try using 127.0.0.1 instead of localhost');
    console.error('4. Verify MongoDB is listening on port 27017');
    process.exit(1);
  }
};

const createSuperAdmin = async () => {
  try {
    await connectToDb();

    // Super Admin credentials from environment variables
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

    // Validate required environment variables
    if (!superAdminEmail || !superAdminPassword) {
      console.error('❌ Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env file');
      console.error('\nPlease add the following to your .env file:');
      console.error('SUPER_ADMIN_EMAIL=your-email@example.com');
      console.error('SUPER_ADMIN_PASSWORD=your-secure-password');
      console.error('SUPER_ADMIN_NAME=Super Admin (optional)');
      process.exit(1);
    }

    const superAdminData = {
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      college: 'System Administrator',
      role: 'super_admin',
      approval_status: 'approved',
      isActive: true
    };

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ email: superAdminData.email });
    
    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin already exists with this email!');
      console.log('Email:', superAdminData.email);
      console.log('\nIf you need to reset the password, please do it through the application.');
    } else {
      // Create super admin
      const superAdmin = await User.create(superAdminData);
      console.log('✅ Super Admin created successfully!');
      console.log('📧 Email:', superAdminData.email);
      console.log('\n⚠️  IMPORTANT: Keep your credentials secure and change the password after first login!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();

