const Tracking = require('../models/tracking');
const Delivery = require('../models/delivery');
const Vehicle = require('../models/vehicle');

let io;

const initSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Driver joins their tracking room
    socket.on('join-driver-room', (driverId) => {
      socket.join(`driver-${driverId}`);
      socket.join(`driver:${driverId}`); // New format for notifications
      socket.join('drivers'); // General drivers room
      console.log(`Driver ${driverId} joined room`);
      
      // Acknowledge connection
      socket.emit('driver-connected', {
        driverId,
        timestamp: new Date().toISOString(),
      });
    });

    // Customer joins delivery tracking room
    socket.on('join-delivery-room', (deliveryId) => {
      socket.join(`delivery-${deliveryId}`);
      console.log(`Joined delivery room: ${deliveryId}`);
    });

    // Admin joins admin room for all updates
    socket.on('join-admin-room', () => {
      socket.join('admin-room');
      console.log('Admin joined admin room');
    });

    // Handle location updates from drivers
    socket.on('update-location', async (data) => {
      try {
        const { driverId, vehicleId, deliveryId, location, speed, heading, status } = data;

        // Update vehicle location
        await Vehicle.findByIdAndUpdate(vehicleId, {
          currentLocation: location,
        });

        // Create tracking record
        const tracking = await Tracking.create({
          delivery: deliveryId,
          driver: driverId,
          vehicle: vehicleId,
          location,
          speed,
          heading,
          status: status || 'moving',
        });

        // Update delivery tracking
        await Delivery.findByIdAndUpdate(deliveryId, {
          $push: {
            trackingUpdates: {
              status: 'on-route',
              location,
              notes: `Location updated: ${location.latitude}, ${location.longitude}`,
            },
          },
        });

        // Emit to delivery room (customers tracking this delivery)
        io.to(`delivery-${deliveryId}`).emit('location-update', {
          deliveryId,
          location,
          speed,
          heading,
          status,
          timestamp: tracking.timestamp,
        });

        // Emit to admin room
        io.to('admin-room').emit('tracking-update', {
          deliveryId,
          driverId,
          vehicleId,
          location,
          speed,
          heading,
          status,
          timestamp: tracking.timestamp,
        });

      } catch (error) {
        console.error('Error updating location:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Handle delivery status updates
    socket.on('update-delivery-status', async (data) => {
      try {
        const { deliveryId, status, notes } = data;

        const delivery = await Delivery.findById(deliveryId)
          .populate('customer', '_id');
        if (!delivery) {
          socket.emit('error', { message: 'Delivery not found' });
          return;
        }

        // Update delivery status
        delivery.status = status;
        delivery.trackingUpdates.push({
          status,
          notes,
          timestamp: new Date(),
        });

        if (status === 'picked-up') {
          delivery.actualPickupTime = new Date();
        } else if (status === 'delivered') {
          delivery.actualDeliveryTime = new Date();
        }

        await delivery.save();

        // Emit status update to delivery room
        io.to(`delivery-${deliveryId}`).emit('status-update', {
          deliveryId,
          status,
          notes,
          timestamp: new Date(),
        });

        // Emit to customer room (customer dashboard)
        if (delivery.customer) {
          io.to(`customer-${delivery.customer._id}`).emit('delivery-status-update', {
            deliveryId,
            customerId: delivery.customer._id,
            status,
            notes,
            timestamp: new Date(),
          });
        }

        // Emit to admin room
        io.to('admin-room').emit('delivery-status-update', {
          deliveryId,
          status,
          notes,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error('Error updating delivery status:', error);
        socket.emit('error', { message: 'Failed to update delivery status' });
      }
    });

    // Customer joins their own room
    socket.on('join-customer-room', (customerId) => {
      socket.join(`customer-${customerId}`);
      console.log(`Customer ${customerId} joined their room`);
    });

    // Handle driver availability updates
    socket.on('update-driver-status', async (data) => {
      try {
        const { driverId, status } = data;

        // Emit to admin room
        io.to('admin-room').emit('driver-status-update', {
          driverId,
          status,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error('Error updating driver status:', error);
        socket.emit('error', { message: 'Failed to update driver status' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initSocket, getIO };
