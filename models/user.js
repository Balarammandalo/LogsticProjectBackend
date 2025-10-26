const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'driver', 'customer'],
    default: 'customer',
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
<<<<<<< HEAD
  profilePicture: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=200',
  },
  // Driver-specific fields
  licenseNumber: {
    type: String,
  },
  vehicleType: {
    type: String,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  // Driver statistics
  totalDeliveries: {
    type: Number,
    default: 0,
  },
  completedDeliveries: {
    type: Number,
    default: 0,
  },
  cancelledDeliveries: {
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    default: 0,
  },
  totalPayments: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
=======
>>>>>>> b72fee63b630eb7d53463ed14994a82c69694bf3
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
