const express = require('express');
const cors = require('cors');
const path = require('path');
const connectToDb = require('./db/db');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const userRoutes = require('./routes/userRoutes');
const systemHealthRoutes = require('./routes/systemHealthRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');

// --- CORS Configuration ---
const FRONTEND_URL = 'https://abhijeet5642-vercel-frontend.vercel.app';
const allowedOrigins = [
    FRONTEND_URL,
    'http://localhost:3000' // For local development
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        // OR requests from one of the explicitly allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Block other origins
            console.log('Blocked by CORS:', origin); 
            callback(new Error('Not allowed by CORS'));
        }
    },
    // Crucial for passing cookies, Authorization headers, etc.
    credentials: true, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization'
};
// --------------------------


const app = express();

// Middleware
// Apply the specific CORS configuration
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to Database
const startDb = async () => {
    await connectToDb();
};
startDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/logs', activityLogRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemHealthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/feedback', feedbackRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Welcome to the CampusEventHub API');
});

// Handle undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
