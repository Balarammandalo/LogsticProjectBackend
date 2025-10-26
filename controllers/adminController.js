const User = require('../models/user');
const Delivery = require('../models/delivery');
const { getIO } = require('../sockets/trackerSocket');

// @desc    Get all drivers
// @route   GET /api/admin/drivers
// @access  Private/Admin
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message,
    });
  }
};

// @desc    Create new driver
// @route   POST /api/admin/drivers
// @access  Private/Admin
exports.createDriver = async (req, res) => {
  try {
    const { name, email, phone, password, licenseNumber, vehicleType } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, phone, password',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'Email already registered'
          : 'Phone number already registered',
      });
    }

    // Create driver
    const driver = await User.create({
      name,
      email,
      phone,
      password, // Will be hashed by pre-save hook
      role: 'driver',
      licenseNumber,
      vehicleType,
      profilePicture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff&size=200`,
    });

    // Remove password from response
    const driverResponse = driver.toObject();
    delete driverResponse.password;

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driverResponse,
    });
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      error: error.message,
    });
  }
};

// @desc    Update driver
// @route   PUT /api/admin/drivers/:id
// @access  Private/Admin
exports.updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow role change through this endpoint
    delete updates.role;

    // If password is being updated, it will be hashed by pre-save hook
    const driver = await User.findOneAndUpdate(
      { _id: id, role: 'driver' },
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver,
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update driver',
      error: error.message,
    });
  }
};

// @desc    Delete driver
// @route   DELETE /api/admin/drivers/:id
// @access  Private/Admin
exports.deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await User.findOneAndDelete({ _id: id, role: 'driver' });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    res.json({
      success: true,
      message: 'Driver deleted successfully',
    });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: error.message,
    });
  }
};

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Private/Admin
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Delivery.find()
      .populate('customer', 'name email phone')
      .populate('driver', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

// @desc    Assign driver to booking
// @route   POST /api/admin/bookings/:id/assign
// @access  Private/Admin
exports.assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Verify driver exists
    const driver = await User.findOne({ _id: driverId, role: 'driver' });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    // Update booking
    const booking = await Delivery.findByIdAndUpdate(
      id,
      {
        driver: driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
      { new: true }
    )
      .populate('customer', 'name email phone')
      .populate('driver', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Send real-time notification to driver via Socket.IO
    const io = getIO();
    if (io) {
      const notificationPayload = {
        type: 'driverAssigned',
        bookingId: booking._id,
        pickup: {
          address: booking.pickupLocation?.address || booking.pickupLocation,
          lat: booking.pickupLocation?.lat,
          lng: booking.pickupLocation?.lng,
        },
        drop: {
          address: booking.dropLocation?.address || booking.dropLocation,
          lat: booking.dropLocation?.lat,
          lng: booking.dropLocation?.lng,
        },
        estimatedDistanceKm: booking.distance || 0,
        vehicleType: booking.vehicleType,
        packageDetails: booking.packageDetails,
        payment: booking.payment,
        assignedBy: req.user._id,
        assignedByName: req.user.name,
        timestamp: new Date().toISOString(),
      };

      // Emit to specific driver room
      io.to(`driver:${driverId}`).emit('driverAssigned', notificationPayload);
      
      // Also emit to general driver room as fallback
      io.to('drivers').emit('driverAssigned', notificationPayload);

      console.log(`Notification sent to driver ${driverId} for booking ${id}`);
    }

    // Update driver stats
    await User.findByIdAndUpdate(driverId, {
      $inc: { totalDeliveries: 1 },
    });

    res.json({
      success: true,
      message: 'Driver assigned successfully and notified',
      data: booking,
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver',
      error: error.message,
    });
  }
};

// @desc    Update booking status
// @route   PUT /api/admin/bookings/:id/status
// @access  Private/Admin
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'assigned', 'in-transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const booking = await Delivery.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('customer', 'name email phone')
      .populate('driver', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Notify driver of status change
    const io = getIO();
    if (io && booking.driver) {
      io.to(`driver:${booking.driver._id}`).emit('bookingStatusUpdated', {
        bookingId: booking._id,
        status,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking,
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message,
    });
  }
};
