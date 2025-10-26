const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { register, login, getProfile, getDriverStats } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Import OTP routes
const otpRouter = require('./otp');

=======
const { register, login, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3
// Public routes
router.post('/register', register);
router.post('/login', login);

<<<<<<< HEAD
// OTP routes (merge with auth routes)
router.use('/', otpRouter);

// Protected routes
router.get('/profile', protect, getProfile);
router.get('/driver-stats', protect, getDriverStats);
=======
// Protected routes
router.get('/profile', protect, getProfile);
>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3

module.exports = router;
