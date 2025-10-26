const express = require('express');
const router = express.Router();
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignDriver,
  updateLocation,
} = require('../controllers/vehicleController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

// All routes require authentication
router.use(protect);

// Admin only routes
router.get('/', authorize('admin'), getVehicles);
router.post('/', authorize('admin'), createVehicle);
router.put('/:id/assign-driver', authorize('admin'), assignDriver);

// Admin and driver routes
router.get('/:id', authorize('admin', 'driver'), getVehicle);
router.put('/:id', authorize('admin'), updateVehicle);
router.delete('/:id', authorize('admin'), deleteVehicle);

// Driver only routes
router.put('/:id/location', authorize('driver'), updateLocation);

module.exports = router;
