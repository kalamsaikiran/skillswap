const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Exchange = require('../models/Exchange');
const User = require('../models/User');
const Notification = require('../models/Notification');

let io;

// Function to initialize io
const initializeIO = (_io) => {
  io = _io;
};

// Get all exchanges for the current user (including requests)
router.get('/', auth, async (req, res) => {
  try {
    const exchanges = await Exchange.find({
      $or: [
        { initiator: req.user.id },
        { partner: req.user.id }
      ]
    })
    .populate('initiator', 'name profilePicture')
    .populate('partner', 'name profilePicture')
    .sort({ createdAt: -1 });

    res.json(exchanges);
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    res.status(500).json({ message: 'Error fetching exchanges', error: error.message });
  }
});

// Get pending exchange requests for the current user
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await Exchange.find({
      partner: req.user.id,
      requestStatus: 'pending'
    })
    .populate('initiator', 'name profilePicture')
    .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching exchange requests:', error);
    res.status(500).json({ message: 'Error fetching exchange requests', error: error.message });
  }
});

// Create a new exchange request
router.post('/', auth, async (req, res) => {
  try {
    const { skill, partnerId, duration } = req.body;

    // Validate required fields
    if (!skill || !partnerId || !duration) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          skill: !skill,
          partnerId: !partnerId,
          duration: !duration
        }
      });
    }

    // Convert duration to number and validate
    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ 
        message: 'Invalid duration',
        details: 'Duration must be a positive number'
      });
    }

    // Verify partner exists
    const partner = await User.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        message: 'Partner not found',
        details: 'The selected partner does not exist'
      });
    }

    // Calculate end date based on duration
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (durationNum * 7)); // duration in weeks

    const exchange = new Exchange({
      initiator: req.user.id,
      partner: partnerId,
      skill,
      duration: durationNum,
      endDate,
      notifications: [{
        recipient: partnerId,
        type: 'request',
        message: `${req.user.name} wants to exchange skills with you: ${skill}`
      }]
    });

    await exchange.save();

    // Create notification for the partner
    const notification = new Notification({
      recipient: partnerId,
      sender: req.user.id,
      type: 'exchange',
      message: `${req.user.name} wants to exchange ${skill} with you`
    });

    await notification.save();

    // Populate the exchange with user details
    const populatedExchange = await Exchange.findById(exchange._id)
      .populate('initiator', 'name profilePicture')
      .populate('partner', 'name profilePicture');

    res.status(201).json(populatedExchange);
  } catch (error) {
    console.error('Error creating exchange:', error);
    res.status(500).json({ 
      message: 'Error creating exchange', 
      error: error.message,
      details: error.stack
    });
  }
});

// Respond to exchange request (accept/reject)
router.patch('/:id/respond', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const exchange = await Exchange.findOne({
      _id: req.params.id,
      partner: req.user.id,
      requestStatus: 'pending'
    });

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange request not found' });
    }

    exchange.requestStatus = status;
    exchange.status = status === 'accepted' ? 'active' : 'rejected';
    
    // Add notification for the initiator
    exchange.notifications.push({
      recipient: exchange.initiator,
      type: status === 'accepted' ? 'acceptance' : 'rejection',
      message: `${req.user.name} has ${status} your exchange request for ${exchange.skill}`
    });

    await exchange.save();

    // Emit socket event to notify the initiator if io is initialized
    if (io) {
      io.to(exchange.initiator.toString()).emit('exchange_response', {
        exchangeId: exchange._id,
        status,
        message: `${req.user.name} has ${status} your exchange request for ${exchange.skill}`
      });
    }

    const populatedExchange = await Exchange.findById(exchange._id)
      .populate('initiator', 'name profilePicture')
      .populate('partner', 'name profilePicture');

    res.json(populatedExchange);
  } catch (error) {
    console.error('Error responding to exchange:', error);
    res.status(500).json({ message: 'Error responding to exchange', error: error.message });
  }
});

// Get exchange notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const exchanges = await Exchange.find({
      'notifications.recipient': req.user.id,
      'notifications.read': false
    })
    .populate('initiator', 'name profilePicture')
    .populate('partner', 'name profilePicture');

    const notifications = exchanges.flatMap(exchange => 
      exchange.notifications.filter(n => 
        n.recipient.toString() === req.user.id && !n.read
      )
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.patch('/notifications/:exchangeId', auth, async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.exchangeId);
    
    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    exchange.notifications.forEach(notification => {
      if (notification.recipient.toString() === req.user.id) {
        notification.read = true;
      }
    });

    await exchange.save();
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Error marking notifications as read', error: error.message });
  }
});

// Update exchange status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      $or: [
        { initiator: req.user.id },
        { partner: req.user.id }
      ]
    });

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    exchange.status = status;
    await exchange.save();

    res.json(exchange);
  } catch (error) {
    console.error('Error updating exchange status:', error);
    res.status(500).json({ message: 'Error updating exchange status', error: error.message });
  }
});

// Update exchange progress
router.patch('/:id/progress', auth, async (req, res) => {
  try {
    const { progress } = req.body;
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      $or: [
        { initiator: req.user.id },
        { partner: req.user.id }
      ]
    });

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    exchange.progress = progress;
    await exchange.save();

    res.json(exchange);
  } catch (error) {
    console.error('Error updating exchange progress:', error);
    res.status(500).json({ message: 'Error updating exchange progress', error: error.message });
  }
});

// Update an exchange
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, requestStatus, meetingLink, progress } = req.body;
    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    // Update fields if provided
    if (status) exchange.status = status;
    if (requestStatus) exchange.requestStatus = requestStatus;
    if (typeof progress === 'number') exchange.progress = progress;
    if (meetingLink) {
      exchange.meetingLink = meetingLink;
      // Add notification for meeting link update
      exchange.notifications.push({
        recipient: exchange.initiator.toString() === req.user.id ? exchange.partner : exchange.initiator,
        type: 'meeting_link',
        message: `${req.user.name} has updated the meeting link for ${exchange.skill}`
      });
    }

    await exchange.save();

    // Populate the exchange with user details
    const populatedExchange = await Exchange.findById(exchange._id)
      .populate('initiator', 'name profilePicture')
      .populate('partner', 'name profilePicture');

    res.json(populatedExchange);
  } catch (error) {
    console.error('Error updating exchange:', error);
    res.status(500).json({ message: 'Error updating exchange', error: error.message });
  }
});

// Export the router and initializeIO function
module.exports = router;
module.exports.initializeIO = initializeIO; 