const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['truck', 'van', 'bike', 'car'],
  },
  capacity: {
    type: Number,
    required: true, // in kg or cubic meters
  },
  status: {
    type: String,
    enum: ['available', 'in-use', 'maintenance'],
    default: 'available',
  },
  currentLocation: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
