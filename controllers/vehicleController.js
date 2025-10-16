const Vehicle = require('../models/vehicle');
const User = require('../models/user');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private/Admin
const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({})
      .populate('assignedDriver', 'name email')
      .sort({ createdAt: -1 });

    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private/Admin
const getVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate(
      'assignedDriver',
      'name email'
    );

    if (vehicle) {
      res.json(vehicle);
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a vehicle
// @route   POST /api/vehicles
// @access  Private/Admin
const createVehicle = async (req, res) => {
  const { vehicleNumber, type, capacity, currentLocation } = req.body;

  try {
    const vehicleExists = await Vehicle.findOne({ vehicleNumber });

    if (vehicleExists) {
      return res.status(400).json({ message: 'Vehicle already exists' });
    }

    const vehicle = await Vehicle.create({
      vehicleNumber,
      type,
      capacity,
      currentLocation,
    });

    if (vehicle) {
      res.status(201).json(vehicle);
    } else {
      res.status(400).json({ message: 'Invalid vehicle data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private/Admin
const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (vehicle) {
      vehicle.vehicleNumber = req.body.vehicleNumber || vehicle.vehicleNumber;
      vehicle.type = req.body.type || vehicle.type;
      vehicle.capacity = req.body.capacity || vehicle.capacity;
      vehicle.status = req.body.status || vehicle.status;
      vehicle.currentLocation = req.body.currentLocation || vehicle.currentLocation;
      vehicle.assignedDriver = req.body.assignedDriver || vehicle.assignedDriver;

      const updatedVehicle = await vehicle.save();
      res.json(updatedVehicle);
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private/Admin
const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (vehicle) {
      await vehicle.deleteOne();
      res.json({ message: 'Vehicle removed' });
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign driver to vehicle
// @route   PUT /api/vehicles/:id/assign-driver
// @access  Private/Admin
const assignDriver = async (req, res) => {
  const { driverId } = req.body;

  try {
    const vehicle = await Vehicle.findById(req.params.id);
    const driver = await User.findById(driverId);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (!driver || driver.role !== 'driver') {
      return res.status(400).json({ message: 'Invalid driver' });
    }

    // Check if driver is already assigned to another vehicle
    const existingAssignment = await Vehicle.findOne({
      assignedDriver: driverId,
      _id: { $ne: req.params.id },
    });

    if (existingAssignment) {
      return res.status(400).json({ message: 'Driver already assigned to another vehicle' });
    }

    vehicle.assignedDriver = driverId;
    vehicle.status = 'available';

    const updatedVehicle = await vehicle.save();
    res.json(updatedVehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update vehicle location
// @route   PUT /api/vehicles/:id/location
// @access  Private/Driver
const updateLocation = async (req, res) => {
  const { latitude, longitude } = req.body;

  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Check if the requesting user is the assigned driver
    if (!vehicle.assignedDriver || vehicle.assignedDriver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    vehicle.currentLocation = { latitude, longitude };
    const updatedVehicle = await vehicle.save();

    res.json(updatedVehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignDriver,
  updateLocation,
};
