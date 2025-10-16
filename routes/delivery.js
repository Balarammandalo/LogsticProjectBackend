const express = require('express');
const router = express.Router();
const {
  getDeliveries,
  getDelivery,
  createDelivery,
  updateDeliveryStatus,
  assignDelivery,
  getDeliveryTracking,
} = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

// All routes require authentication
router.use(protect);

// Routes accessible by all authenticated users
router.get('/', getDeliveries);
router.get('/:id', getDelivery);
router.get('/:id/track', getDeliveryTracking);

// Customer and admin can create deliveries
router.post('/', authorize('customer', 'admin'), createDelivery);

// Update delivery status (drivers and customers)
router.put('/:id/status', authorize('driver', 'customer'), updateDeliveryStatus);

// Admin only routes
router.put('/:id/assign', authorize('admin'), assignDelivery);

module.exports = router;
