const mongoose = require('mongoose');

const connectToDb = async () => {
    try {
        await mongoose.connect(process.env.DB_CONNECT || 'mongodb+srv://aydv760:1its8eG1SjDl53zN@abhijeet.2gj2pel.mongodb.net/campus?appName=abhijeet');
        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

module.exports = connectToDb;