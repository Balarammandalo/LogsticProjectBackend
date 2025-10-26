const Delivery = require('../models/delivery');
const User = require('../models/user');
const Vehicle = require('../models/vehicle');
const { getIO } = require('../sockets/trackerSocket');

// @desc    Get driver's assigned deliveries
// @route   GET /api/driver/deliveries
// @access  Private/Driver
exports.getMyDeliveries = async (req, res) => {
  try {
    const driverId = req.user._id;

    const deliveries = await Delivery.find({
      driver: driverId,
      status: { $in: ['assigned', 'on-route', 'picked-up'] },
    })
      .populate('customer', 'name email phone')
      .populate('vehicle', 'vehicleNumber vehicleType')
      .sort({ scheduledPickupTime: 1 });

    res.json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deliveries',
      error: error.message,
    });
  }
};

// @desc    Mark delivery as delivered
// @route   PUT /api/driver/deliver/:orderId
// @access  Private/Driver
exports.markAsDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const driverId = req.user._id;
    const { deliveredAt } = req.body;

    // Find the delivery
    const delivery = await Delivery.findOne({
      _id: orderId,
      driver: driverId,
    })
      .populate('customer', 'name email phone')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'vehicleNumber vehicleType');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you',
      });
    }

    // Check if already delivered
    if (delivery.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Delivery already marked as delivered',
      });
    }

    // Update delivery status
    delivery.status = 'delivered';
    delivery.deliveredAt = deliveredAt || new Date();
    delivery.actualDeliveryTime = deliveredAt || new Date();
    delivery.trackingUpdates.push({
      status: 'delivered',
      timestamp: new Date(),
      notes: `Delivered by ${req.user.name}`,
    });

    await delivery.save();

    // Update driver availability
    await User.findByIdAndUpdate(driverId, {
      isAvailable: true,
      $inc: { completedDeliveries: 1 },
    });

    // Update vehicle availability
    if (delivery.vehicle) {
      await Vehicle.findByIdAndUpdate(delivery.vehicle._id, {
        status: 'available',
        currentLocation: delivery.dropLocation.coordinates,
      });
    }

    // Update driver earnings (if payment amount exists)
    if (delivery.payment && delivery.payment.amount) {
      const driverEarning = delivery.payment.amount * 0.7; // 70% to driver
      await User.findByIdAndUpdate(driverId, {
        $inc: { totalEarnings: driverEarning },
      });
    }

    // Send real-time notifications via Socket.IO
    const io = getIO();
    if (io) {
      // Notify customer
      if (delivery.customer) {
        const customerNotification = {
          type: 'deliveryCompleted',
          orderId: delivery._id,
          message: 'Your product has been successfully delivered.',
          deliveredAt: delivery.deliveredAt,
          driverName: delivery.driver.name,
          vehicleNumber: delivery.vehicle?.vehicleNumber,
          timestamp: new Date().toISOString(),
        };

        io.to(`customer-${delivery.customer._id}`).emit(
          'deliveryCompleted',
          customerNotification
        );
        console.log(`Notification sent to customer ${delivery.customer._id}`);
      }

      // Notify admin
      const adminNotification = {
        type: 'deliveryCompleted',
        orderId: delivery._id,
        message: `Driver ${delivery.driver.name} has completed the delivery for Order ${delivery._id}. Driver and vehicle are now available.`,
        driverName: delivery.driver.name,
        driverId: delivery.driver._id,
        vehicleNumber: delivery.vehicle?.vehicleNumber,
        vehicleId: delivery.vehicle?._id,
        customerName: delivery.customer.name,
        deliveredAt: delivery.deliveredAt,
        timestamp: new Date().toISOString(),
      };

      io.to('admin-room').emit('deliveryCompleted', adminNotification);
      console.log('Notification sent to admin');

      // Notify all admins about driver availability
      io.to('admin-room').emit('driverAvailable', {
        driverId: delivery.driver._id,
        driverName: delivery.driver.name,
        isAvailable: true,
        timestamp: new Date().toISOString(),
      });

      // Notify all admins about vehicle availability
      if (delivery.vehicle) {
        io.to('admin-room').emit('vehicleAvailable', {
          vehicleId: delivery.vehicle._id,
          vehicleNumber: delivery.vehicle.vehicleNumber,
          status: 'available',
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      message: 'Delivery marked as delivered successfully',
      data: delivery,
    });
  } catch (error) {
    console.error('Mark as delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark delivery as delivered',
      error: error.message,
    });
  }
};

// @desc    Update delivery status (picked-up, on-route, etc.)
// @route   PUT /api/driver/deliveries/:orderId/status
// @access  Private/Driver
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;
    const driverId = req.user._id;

    const validStatuses = ['on-route', 'picked-up'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const delivery = await Delivery.findOne({
      _id: orderId,
      driver: driverId,
    })
      .populate('customer', 'name email phone')
      .populate('driver', 'name email phone');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you',
      });
    }

    // Update status
    delivery.status = status;
    if (status === 'picked-up' && !delivery.actualPickupTime) {
      delivery.actualPickupTime = new Date();
    }

    delivery.trackingUpdates.push({
      status,
      timestamp: new Date(),
      location,
      notes: notes || `Status updated to ${status}`,
    });

    await delivery.save();

    // Send real-time notification
    const io = getIO();
    if (io && delivery.customer) {
      io.to(`customer-${delivery.customer._id}`).emit('statusUpdate', {
        orderId: delivery._id,
        status,
        notes,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'Delivery status updated successfully',
      data: delivery,
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message,
    });
  }
};

// @desc    Get driver statistics
// @route   GET /api/driver/stats
// @access  Private/Driver
exports.getDriverStats = async (req, res) => {
  try {
    const driverId = req.user._id;

    // Get driver info
    const driver = await User.findById(driverId).select(
      'totalDeliveries completedDeliveries cancelledDeliveries totalEarnings averageRating'
    );

    // Get active deliveries count
    const activeDeliveries = await Delivery.countDocuments({
      driver: driverId,
      status: { $in: ['assigned', 'on-route', 'picked-up'] },
    });

    // Get completed deliveries this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyDeliveries = await Delivery.countDocuments({
      driver: driverId,
      status: 'delivered',
      deliveredAt: { $gte: startOfMonth },
    });

    // Get recent deliveries
    const recentDeliveries = await Delivery.find({
      driver: driverId,
      status: 'delivered',
    })
      .sort({ deliveredAt: -1 })
      .limit(5)
      .populate('customer', 'name')
      .select('deliveredAt payment.amount pickupLocation dropLocation');

    res.json({
      success: true,
      data: {
        ...driver.toObject(),
        activeDeliveries,
        monthlyDeliveries,
        recentDeliveries,
      },
    });
  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver statistics',
      error: error.message,
    });
  }
};
