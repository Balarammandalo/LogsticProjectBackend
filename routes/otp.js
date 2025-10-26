const express = require('express');
const router = express.Router();

// Store OTPs temporarily (use Redis in production)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;
    
    if (!phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Phone and email are required',
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with 5-minute expiry
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      email,
    });
    
    // In production, send SMS via Twilio/AWS SNS
    console.log(`\n=================================`);
    console.log(`📱 OTP for ${phone}: ${otp}`);
    console.log(`📧 Email: ${email}`);
    console.log(`⏰ Expires in 5 minutes`);
    console.log(`=================================\n`);
    
    // For demo purposes, return OTP in response
    // REMOVE THIS IN PRODUCTION!
    res.json({
      success: true,
      message: 'OTP sent successfully',
      otp, // Remove this line in production
      expiresIn: 300, // seconds
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error.message,
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required',
      });
    }
    
    const stored = otpStore.get(phone);
    
    if (!stored) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.',
      });
    }
    
    // Check if OTP expired
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }
    
    // Verify OTP
    if (stored.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }
    
    // OTP verified successfully, remove from store
    otpStore.delete(phone);
    
    console.log(`✅ OTP verified successfully for ${phone}`);
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message,
    });
  }
});

// Verify Admin Secret Key
router.post('/verify-secret-key', async (req, res) => {
  try {
    const { secretKey } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Secret key is required',
      });
    }
    
    // Admin secret key (store in .env in production)
    const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'TRACKMATE_ADMIN_2024';
    
    if (secretKey === ADMIN_SECRET) {
      console.log('✅ Admin secret key verified');
      res.json({
        success: true,
        message: 'Secret key verified',
      });
    } else {
      console.log('❌ Invalid admin secret key attempt');
      res.status(401).json({
        success: false,
        message: 'Invalid admin secret key',
      });
    }
  } catch (error) {
    console.error('Error verifying secret key:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message,
    });
  }
});

// Resend OTP (same as send-otp but with different message)
router.post('/resend-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;
    
    if (!phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Phone and email are required',
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Store OTP with 5-minute expiry
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      email,
    });
    
    console.log(`\n=================================`);
    console.log(`🔄 OTP RESENT for ${phone}: ${otp}`);
    console.log(`📧 Email: ${email}`);
    console.log(`⏰ Expires in 5 minutes`);
    console.log(`=================================\n`);
    
    res.json({
      success: true,
      message: 'OTP resent successfully',
      otp, // Remove in production
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: error.message,
    });
  }
});

module.exports = router;
