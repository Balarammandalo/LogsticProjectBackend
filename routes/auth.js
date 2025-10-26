const express = require('express');
const router = express.Router();
const { register, login, getProfile, getDriverStats } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Import OTP routes
const otpRouter = require('./otp');

// Public routes
router.post('/register', register);
router.post('/login', login);

// OTP routes (merge with auth routes)
router.use('/', otpRouter);

// Protected routes
router.get('/profile', protect, getProfile);
router.get('/driver-stats', protect, getDriverStats);

module.exports = router;
