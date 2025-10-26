const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');
const User = require('../models/user');
const Tracking = require('../models/tracking');

// @desc    Get all deliveries
// @route   GET /api/deliveries
// @access  Private
const getDeliveries = async (req, res) => {
  try {
    let query = {};

    // Filter based on user role
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'driver') {
      query.driver = req.user._id;
    }

    const deliveries = await Delivery.find(query)
      .populate('customer', 'name email')
      .populate('driver', 'name email')
      .populate('vehicle', 'vehicleNumber type')
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single delivery
// @route   GET /api/deliveries/:id
// @access  Private
const getDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('driver', 'name email phone')
      .populate('vehicle', 'vehicleNumber type capacity');

    if (delivery) {
      // Check if user has permission to view this delivery
      if (
        req.user.role === 'customer' &&
        delivery.customer._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      if (
        req.user.role === 'driver' &&
        delivery.driver &&
        delivery.driver._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      res.json(delivery);
    } else {
      res.status(404).json({ message: 'Delivery not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a delivery
// @route   POST /api/deliveries
// @access  Private/Admin or Customer
const createDelivery = async (req, res) => {
  const {
    pickupLocation,
    dropLocation,
    scheduledPickupTime,
    scheduledDeliveryTime,
    packageDetails,
  } = req.body;

  try {
    const delivery = await Delivery.create({
      customer: req.user.role === 'customer' ? req.user._id : req.body.customer,
      pickupLocation,
      dropLocation,
      scheduledPickupTime,
      scheduledDeliveryTime,
      packageDetails,
    });

    if (delivery) {
      res.status(201).json(delivery);
    } else {
      res.status(400).json({ message: 'Invalid delivery data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update delivery status
// @route   PUT /api/deliveries/:id/status
// @access  Private
const updateDeliveryStatus = async (req, res) => {
  const { status, notes } = req.body;

  try {
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Check permissions
    if (req.user.role === 'customer' && delivery.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'driver' && delivery.driver && delivery.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update status and add tracking update
    delivery.status = status;

    const trackingUpdate = {
      status,
      notes,
    };

    if (req.user.role === 'driver' && delivery.vehicle) {
      const vehicle = await Vehicle.findById(delivery.vehicle);
      if (vehicle && vehicle.currentLocation) {
        trackingUpdate.location = vehicle.currentLocation;
      }
    }

    delivery.trackingUpdates.push(trackingUpdate);

    // Set actual times
    if (status === 'picked-up') {
      delivery.actualPickupTime = new Date();
    } else if (status === 'delivered') {
      delivery.actualDeliveryTime = new Date();
    }

    const updatedDelivery = await delivery.save();
    res.json(updatedDelivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign driver and vehicle to delivery
// @route   PUT /api/deliveries/:id/assign
// @access  Private/Admin
const assignDelivery = async (req, res) => {
  const { driverId, vehicleId } = req.body;

  try {
    const delivery = await Delivery.findById(req.params.id);
    const driver = await User.findById(driverId);
    const vehicle = await Vehicle.findById(vehicleId);

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    if (!driver || driver.role !== 'driver') {
      return res.status(400).json({ message: 'Invalid driver' });
    }

    if (!vehicle || vehicle.status !== 'available') {
      return res.status(400).json({ message: 'Invalid or unavailable vehicle' });
    }

    // Check for scheduling conflicts
    const conflictingDelivery = await Delivery.findOne({
      driver: driverId,
      status: { $in: ['assigned', 'on-route', 'picked-up'] },
      $or: [
        {
          scheduledPickupTime: { $lt: delivery.scheduledDeliveryTime },
          scheduledDeliveryTime: { $gt: delivery.scheduledPickupTime },
        },
      ],
    });

    if (conflictingDelivery) {
      return res.status(400).json({ message: 'Driver has scheduling conflict' });
    }

    delivery.driver = driverId;
    delivery.vehicle = vehicleId;
    delivery.status = 'assigned';

    const updatedDelivery = await delivery.save();

    // Update vehicle status
    vehicle.status = 'in-use';
    await vehicle.save();

    res.json(updatedDelivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get delivery tracking
// @route   GET /api/deliveries/:id/track
// @access  Private
const getDeliveryTracking = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('customer', 'name')
      .populate('driver', 'name')
      .populate('vehicle', 'vehicleNumber type');

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Check permissions
    if (
      req.user.role === 'customer' &&
      delivery.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (
      req.user.role === 'driver' &&
      delivery.driver &&
      delivery.driver._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get recent tracking data
    const trackingData = await Tracking.find({ delivery: req.params.id })
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({
      delivery: {
        _id: delivery._id,
        status: delivery.status,
        pickupLocation: delivery.pickupLocation,
        dropLocation: delivery.dropLocation,
        scheduledPickupTime: delivery.scheduledPickupTime,
        scheduledDeliveryTime: delivery.scheduledDeliveryTime,
        actualPickupTime: delivery.actualPickupTime,
        actualDeliveryTime: delivery.actualDeliveryTime,
        customer: delivery.customer,
        driver: delivery.driver,
        vehicle: delivery.vehicle,
        trackingUpdates: delivery.trackingUpdates,
      },
      trackingData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDeliveries,
  getDelivery,
  createDelivery,
  updateDeliveryStatus,
  assignDelivery,
  getDeliveryTracking,
};
