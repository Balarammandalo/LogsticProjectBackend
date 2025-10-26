const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');
const User = require('../models/user');

class Scheduler {
  // Check for scheduling conflicts
  static async checkConflicts(deliveryData) {
    const { driverId, vehicleId, scheduledPickupTime, scheduledDeliveryTime } = deliveryData;

    // Check driver conflicts
    if (driverId) {
      const driverConflict = await Delivery.findOne({
        driver: driverId,
        status: { $in: ['assigned', 'on-route', 'picked-up'] },
        $or: [
          {
            scheduledPickupTime: { $lt: scheduledDeliveryTime },
            scheduledDeliveryTime: { $gt: scheduledPickupTime },
          },
        ],
      });

      if (driverConflict) {
        return { conflict: true, type: 'driver', message: 'Driver has scheduling conflict' };
      }
    }

    // Check vehicle conflicts
    if (vehicleId) {
      const vehicleConflict = await Delivery.findOne({
        vehicle: vehicleId,
        status: { $in: ['assigned', 'on-route', 'picked-up'] },
        $or: [
          {
            scheduledPickupTime: { $lt: scheduledDeliveryTime },
            scheduledDeliveryTime: { $gt: scheduledPickupTime },
          },
        ],
      });

      if (vehicleConflict) {
        return { conflict: true, type: 'vehicle', message: 'Vehicle has scheduling conflict' };
      }
    }

    return { conflict: false };
  }

  // Find available drivers for a time slot
  static async findAvailableDrivers(scheduledPickupTime, scheduledDeliveryTime) {
    // Get all drivers
    const drivers = await User.find({ role: 'driver' });

    const availableDrivers = [];

    for (const driver of drivers) {
      const conflict = await Delivery.findOne({
        driver: driver._id,
        status: { $in: ['assigned', 'on-route', 'picked-up'] },
        $or: [
          {
            scheduledPickupTime: { $lt: scheduledDeliveryTime },
            scheduledDeliveryTime: { $gt: scheduledPickupTime },
          },
        ],
      });

      if (!conflict) {
        availableDrivers.push(driver);
      }
    }

    return availableDrivers;
  }

  // Find available vehicles for a time slot
  static async findAvailableVehicles(scheduledPickupTime, scheduledDeliveryTime, requiredCapacity = 0) {
    // Get all available vehicles
    const vehicles = await Vehicle.find({
      status: 'available',
      capacity: { $gte: requiredCapacity },
    });

    const availableVehicles = [];

    for (const vehicle of vehicles) {
      const conflict = await Delivery.findOne({
        vehicle: vehicle._id,
        status: { $in: ['assigned', 'on-route', 'picked-up'] },
        $or: [
          {
            scheduledPickupTime: { $lt: scheduledDeliveryTime },
            scheduledDeliveryTime: { $gt: scheduledPickupTime },
          },
        ],
      });

      if (!conflict) {
        availableVehicles.push(vehicle);
      }
    }

    return availableVehicles;
  }

  // Auto-assign delivery to available driver and vehicle
  static async autoAssignDelivery(deliveryId) {
    try {
      const delivery = await Delivery.findById(deliveryId);

      if (!delivery) {
        throw new Error('Delivery not found');
      }

      const availableDrivers = await this.findAvailableDrivers(
        delivery.scheduledPickupTime,
        delivery.scheduledDeliveryTime
      );

      const availableVehicles = await this.findAvailableVehicles(
        delivery.scheduledPickupTime,
        delivery.scheduledDeliveryTime,
        delivery.packageDetails?.weight || 0
      );

      if (availableDrivers.length === 0) {
        throw new Error('No available drivers for the scheduled time');
      }

      if (availableVehicles.length === 0) {
        throw new Error('No available vehicles for the scheduled time');
      }

      // Simple assignment: take the first available
      delivery.driver = availableDrivers[0]._id;
      delivery.vehicle = availableVehicles[0]._id;
      delivery.status = 'assigned';

      await delivery.save();

      // Update vehicle status
      availableVehicles[0].status = 'in-use';
      await availableVehicles[0].save();

      return delivery;
    } catch (error) {
      throw error;
    }
  }

  // Get delivery statistics
  static async getDeliveryStats() {
    const stats = await Delivery.aggregate([
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          pendingDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          completedDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $and: ['$actualPickupTime', '$actualDeliveryTime'] },
                { $subtract: ['$actualDeliveryTime', '$actualPickupTime'] },
                null,
              ],
            },
          },
        },
      },
    ]);

    return stats[0] || {
      totalDeliveries: 0,
      pendingDeliveries: 0,
      completedDeliveries: 0,
      avgDeliveryTime: 0,
    };
  }

  // Get driver performance stats
  static async getDriverStats() {
    const driverStats = await Delivery.aggregate([
      {
        $match: { status: 'delivered' },
      },
      {
        $group: {
          _id: '$driver',
          totalDeliveries: { $sum: 1 },
          avgDeliveryTime: {
            $avg: {
              $subtract: ['$actualDeliveryTime', '$actualPickupTime'],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      {
        $unwind: '$driver',
      },
      {
        $project: {
          driverName: '$driver.name',
          totalDeliveries: 1,
          avgDeliveryTime: 1,
        },
      },
    ]);

    return driverStats;
  }

  // Get vehicle utilization stats
  static async getVehicleStats() {
    const vehicleStats = await Delivery.aggregate([
      {
        $match: { status: 'delivered' },
      },
      {
        $group: {
          _id: '$vehicle',
          totalDeliveries: { $sum: 1 },
          totalWeight: { $sum: '$packageDetails.weight' },
        },
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: '_id',
          as: 'vehicle',
        },
      },
      {
        $unwind: '$vehicle',
      },
      {
        $project: {
          vehicleNumber: '$vehicle.vehicleNumber',
          vehicleType: '$vehicle.type',
          capacity: '$vehicle.capacity',
          totalDeliveries: 1,
          totalWeight: 1,
          utilizationRate: {
            $multiply: [{ $divide: ['$totalWeight', '$vehicle.capacity'] }, 100],
          },
        },
      },
    ]);

    return vehicleStats;
  }
}

module.exports = Scheduler;
