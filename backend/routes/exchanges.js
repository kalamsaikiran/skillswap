const express = require('express');
const router = express.Router();
const Exchange = require('../models/Exchange');
const User = require('../models/User');
const auth = require('../middleware/auth');

let io;

// Function to initialize io
const initializeIO = (_io) => {
  io = _io;
};

// Get all exchanges for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const exchanges = await Exchange.find({
      $or: [{ partner: req.user.id }, { initiator: req.user.id }]
    })
    .populate('partner', 'name profilePicture')
    .populate('initiator', 'name profilePicture')
    .sort({ createdAt: -1 });

    res.json(exchanges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new exchange
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating exchange with data:', req.body);
    const { skill, partner, duration, meetingLink } = req.body;

    // Validate required fields
    if (!skill || !partner || !duration) {
      console.log('Missing required fields:', { skill, partner, duration });
      return res.status(400).json({ 
        message: 'Please provide all required fields',
        missing: {
          skill: !skill,
          partner: !partner,
          duration: !duration
        }
      });
    }

    // Convert duration to number and validate
    const durationInWeeks = Number(duration);
    if (isNaN(durationInWeeks) || durationInWeeks <= 0) {
      console.log('Invalid duration:', duration);
      return res.status(400).json({ message: 'Duration must be a positive number' });
    }

    // Calculate end date based on duration (in weeks)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (durationInWeeks * 7));

    // Create new exchange
    const newExchange = new Exchange({
      skill,
      partner,
      initiator: req.user.id,
      duration: durationInWeeks,
      startDate,
      endDate,
      meetingLink,
      status: 'pending',
      requestStatus: 'pending'
    });

    console.log('Creating exchange:', newExchange);
    const exchange = await newExchange.save();

    // Populate user details
    await exchange.populate('partner', 'name profilePicture');
    await exchange.populate('initiator', 'name profilePicture');

    // Emit socket event to notify the partner if io is initialized
    if (io) {
      io.to(partner).emit('exchange_request', {
        exchangeId: exchange._id,
        skill,
        initiator: {
          id: req.user.id,
          name: exchange.initiator.name
        },
        duration: durationInWeeks,
        message: `You have received a new exchange request for "${skill}"`
      });
    }

    // Add notification for the partner
    exchange.notifications.push({
      recipient: partner,
      type: 'request',
      message: `You have received a new exchange request for "${skill}"`,
      read: false,
      createdAt: new Date()
    });

    await exchange.save();

    console.log('Exchange created successfully:', exchange);
    res.json(exchange);
  } catch (err) {
    console.error('Error creating exchange:', err);
    res.status(500).json({ 
      message: 'Server error creating exchange',
      error: err.message
    });
  }
});

// Update exchange route
router.put('/:id', auth, async (req, res) => {
  try {
    const { meetingLink, status } = req.body;
    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    // Check if user is authorized to update this exchange
    if (exchange.initiator.toString() !== req.user.id && exchange.partner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this exchange' });
    }

    // Update meeting link if provided
    if (meetingLink) {
      exchange.meetingLink = meetingLink;
      
      // Create notification for meeting link update
      const recipientId = exchange.initiator.toString() === req.user.id ? 
        exchange.partner : exchange.initiator;
      
      exchange.notifications.push({
        recipient: recipientId,
        type: 'meeting_link',
        message: `${req.user.name} has updated the meeting link for ${exchange.skill} exchange.`,
        read: false
      });
    }

    // Update status if provided
    if (status) {
      exchange.status = status;
    }

    const updatedExchange = await exchange.save();
    
    // Populate user details before sending response
    await updatedExchange
      .populate('initiator', 'name profilePicture')
      .populate('partner', 'name profilePicture')
      .execPopulate();

    res.json(updatedExchange);
  } catch (error) {
    console.error('Error updating exchange:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update exchange route
router.patch('/:id/update', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find and update the exchange
    const exchange = await Exchange.findById(id);
    
    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }
    
    // Check if user is authorized to update this exchange
    if (exchange.initiator.toString() !== req.user.id && 
        exchange.partner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this exchange' });
    }
    
    // Update the exchange with the new data
    Object.keys(updates).forEach(key => {
      exchange[key] = updates[key];
    });
    
    await exchange.save();
    
    // Populate partner details before sending response
    await exchange.populate('partner', 'name profilePicture');
    
    res.json(exchange);
  } catch (error) {
    console.error('Error updating exchange:', error);
    res.status(500).json({ message: 'Error updating exchange', error: error.message });
  }
});

// Update exchange progress
router.put('/:id/progress', auth, async (req, res) => {
  try {
    const { progress } = req.body;
    
    // Validate progress value
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ 
        message: 'Progress must be a number between 0 and 100' 
      });
    }

    const exchange = await Exchange.findById(req.params.id);

    if (!exchange) {
      return res.status(404).json({ message: 'Exchange not found' });
    }

    // Check if user is authorized to update this exchange
    if (exchange.initiator.toString() !== req.user.id && 
        exchange.partner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this exchange' });
    }

    // Calculate progress difference
    const progressDiff = progress - exchange.progress;

    // Update progress
    exchange.progress = progress;

    // If progress reaches 100%, automatically set status to completed
    if (progress === 100) {
      exchange.status = 'completed';
    }

    // Add notification for significant progress updates (every 25%)
    if (Math.floor(progress / 25) > Math.floor((progress - progressDiff) / 25)) {
      const recipientId = exchange.initiator.toString() === req.user.id ? 
        exchange.partner : exchange.initiator;
      
      const milestone = Math.floor(progress / 25) * 25;
      exchange.notifications.push({
        recipient: recipientId,
        type: 'reminder',
        message: `${req.user.name} has reached ${milestone}% progress in the ${exchange.skill} exchange!`,
        read: false
      });
    }

    const updatedExchange = await exchange.save();
    
    // Populate user details before sending response
    await updatedExchange
      .populate('initiator', 'name profilePicture')
      .populate('partner', 'name profilePicture')
      .execPopulate();

    res.json(updatedExchange);
  } catch (error) {
    console.error('Error updating exchange progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = {
  router,
  initializeIO
}; 