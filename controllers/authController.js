const User = require('../models/user');
const Delivery = require('../models/delivery');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password, role, phone, address } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'customer',
      phone,
      address,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        ...(user.role === 'driver' && {
          totalDeliveries: user.totalDeliveries,
          completedDeliveries: user.completedDeliveries,
          cancelledDeliveries: user.cancelledDeliveries,
          totalEarnings: user.totalEarnings,
          totalPayments: user.totalPayments,
          averageRating: user.averageRating,
        }),
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        ...(user.role === 'driver' && {
          totalDeliveries: user.totalDeliveries,
          completedDeliveries: user.completedDeliveries,
          cancelledDeliveries: user.cancelledDeliveries,
          totalEarnings: user.totalEarnings,
          totalPayments: user.totalPayments,
          averageRating: user.averageRating,
        }),
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      const profile = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
      };

      // Include driver stats if user is a driver
      if (user.role === 'driver') {
        profile.totalDeliveries = user.totalDeliveries;
        profile.completedDeliveries = user.completedDeliveries;
        profile.cancelledDeliveries = user.cancelledDeliveries;
        profile.totalEarnings = user.totalEarnings;
        profile.totalPayments = user.totalPayments;
        profile.averageRating = user.averageRating;
      }

      res.json(profile);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get driver statistics
// @route   GET /api/auth/driver-stats
// @access  Private/Driver
const getDriverStats = async (req, res) => {
  try {
    // Check if user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'This endpoint is only for drivers' });
    }

    const user = await User.findById(req.user._id);

    if (user) {
      // Calculate active and pending deliveries from database
      const activeDeliveries = await Delivery.countDocuments({
        driver: req.user._id,
        status: { $in: ['on-route', 'picked-up'] },
      });

      const pendingDeliveries = await Delivery.countDocuments({
        driver: req.user._id,
        status: 'assigned',
      });

      res.json({
        totalDeliveries: user.totalDeliveries,
        completedDeliveries: user.completedDeliveries,
        cancelledDeliveries: user.cancelledDeliveries,
        activeDeliveries: activeDeliveries,
        pendingDeliveries: pendingDeliveries,
        totalEarnings: user.totalEarnings,
        totalPayments: user.totalPayments,
        averageRating: user.averageRating,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getDriverStats,
};
