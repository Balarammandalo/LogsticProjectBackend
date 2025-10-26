const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const {
  getMyDeliveries,
  markAsDelivered,
  updateDeliveryStatus,
  getDriverStats,
} = require('../controllers/driverController');

// Protect all driver routes
router.use(protect);
router.use(authorize('driver'));

// Driver delivery routes
router.get('/deliveries', getMyDeliveries);
router.put('/deliver/:orderId', markAsDelivered);
router.put('/deliveries/:orderId/status', updateDeliveryStatus);
router.get('/stats', getDriverStats);

module.exports = router;
