const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  pickupLocation: {
    address: {
      type: String,
      required: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  dropLocation: {
    address: {
      type: String,
      required: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'on-route', 'picked-up', 'delivered', 'cancelled'],
    default: 'pending',
  },
  scheduledPickupTime: {
    type: Date,
    required: true,
  },
  scheduledDeliveryTime: {
    type: Date,
    required: true,
  },
  actualPickupTime: {
    type: Date,
  },
  actualDeliveryTime: {
    type: Date,
  },
<<<<<<< HEAD
  deliveredAt: {
    type: Date,
  },
  assignedAt: {
    type: Date,
  },
=======
>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3
  packageDetails: {
    description: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
  },
<<<<<<< HEAD
  vehicleType: {
    type: String,
  },
  distance: {
    type: Number, // in kilometers
  },
  payment: {
    amount: Number,
    method: String,
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
  },
=======
>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3
  trackingUpdates: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    location: {
      latitude: Number,
      longitude: Number,
    },
    notes: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Delivery', deliverySchema);
