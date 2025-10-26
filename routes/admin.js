const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const {
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getAllBookings,
  assignDriver,
  updateBookingStatus,
} = require('../controllers/adminController');

// Protect all admin routes
router.use(protect);
router.use(authorize('admin'));

// Driver management routes
router.get('/drivers', getAllDrivers);
router.post('/drivers', createDriver);
router.put('/drivers/:id', updateDriver);
router.delete('/drivers/:id', deleteDriver);

// Booking management routes
router.get('/bookings', getAllBookings);
router.post('/bookings/:id/assign', assignDriver);
router.put('/bookings/:id/status', updateBookingStatus);

module.exports = router;
