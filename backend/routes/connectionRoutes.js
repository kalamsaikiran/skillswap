const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Connection = require('../models/Connection');
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

router.get('/members', auth, async (req, res) => {
  try {
    console.log('Fetching members for user:', req.user.id);
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      console.log('Current user not found');
      return res.status(404).json({ message: 'User not found' });
    }

    const userInterests = currentUser.interests || [];
    console.log('User interests:', userInterests);
    const query = {
      _id: { $ne: req.user.id }
    };
    const users = await User.find(query).select('-password');
    console.log('Found users:', users.length);
    const connections = await Connection.find({
      $or: [
        { requester: req.user.id },
        { recipient: req.user.id }
      ]
    });
    console.log('Found connections:', connections.length);

    const members = users.map(user => {
      const connection = connections.find(conn => 
        conn.requester.equals(user._id) || conn.recipient.equals(user._id)
      );
      const userSkillNames = user.skills.map(skill => skill.name);
      const matchingSkills = userSkillNames.filter(skillName => 
        userInterests.includes(skillName)
      );

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        skills: userSkillNames,
        skillDetails: user.skills,
        interests: user.interests || [],
        status: connection ? (connection.status === 'pending' ? 'pending' : 'connected') : 'none',
        connectionId: connection ? connection._id : undefined,
        matchingSkills: matchingSkills,
        bio: user.bio,
        location: user.location,
        availability: user.availability,
        rating: user.rating,
        completedExchanges: user.completedExchanges
      };
    });

    members.sort((a, b) => b.matchingSkills.length - a.matchingSkills.length);

    console.log('Returning members:', members.length);
    return res.json({ 
      success: true,
      members: members || []
    });
  } catch (err) {
    console.error('Error fetching members:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Get incoming connection requests
router.get('/incoming-requests', auth, async (req, res) => {
  try {
    // Find all pending connections where the current user is the recipient
    const pendingConnections = await Connection.find({
      recipient: req.user.id,
      status: 'pending'
    }).populate('requester', 'name email skills interests bio location availability rating completedExchanges');

    const requests = pendingConnections.map(conn => {
      const requesterSkillNames = conn.requester.skills.map(skill => skill.name);
      
      return {
        connectionId: conn._id,
        requesterId: conn.requester._id,
        requesterName: conn.requester.name,
        requesterEmail: conn.requester.email,
        requesterSkills: requesterSkillNames,
        requesterSkillDetails: conn.requester.skills,
        requesterInterests: conn.requester.interests,
        requesterBio: conn.requester.bio,
        requesterLocation: conn.requester.location,
        requesterAvailability: conn.requester.availability,
        requesterRating: conn.requester.rating,
        requesterCompletedExchanges: conn.requester.completedExchanges,
        status: conn.status,
        createdAt: conn.createdAt
      };
    });

    res.json({ success: true, requests });
  } catch (err) {
    console.error('Error fetching incoming requests:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch incoming requests',
      error: err.message
    });
  }
});

// Send connection request
router.post('/request', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: req.user.id, recipient: recipientId },
        { requester: recipientId, recipient: req.user.id }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ message: 'Connection already exists' });
    }

    // Get the requester's details
    const requester = await User.findById(req.user.id).select('name');
    if (!requester) {
      return res.status(404).json({ message: 'Requester not found' });
    }

    console.log('Creating connection request from:', requester.name);

    // Create new connection request
    const connection = new Connection({
      requester: req.user.id,
      recipient: recipientId,
      status: 'pending'
    });

    await connection.save();

    // Create notification for the recipient
    const notification = new Notification({
      recipient: recipientId,
      sender: req.user.id,
      senderName: requester.name,
      type: 'connection',
      message: `${requester.name} wants to connect with you`
    });

    await notification.save();

    // Populate the connection with user details before sending response
    const populatedConnection = await Connection.findById(connection._id)
      .populate('requester', 'name')
      .populate('recipient', 'name');

    res.status(201).json({
      success: true,
      connection: populatedConnection,
      message: `Connection request sent to ${populatedConnection.recipient.name}`
    });
  } catch (error) {
    console.error('Error creating connection request:', error);
    res.status(500).json({ message: 'Error creating connection request', error: error.message });
  }
});

// Accept connection request
router.post('/accept-request/:connectionId', auth, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    if (!connection.recipient.equals(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    connection.status = 'connected';
    await connection.save();

    res.json({ success: true, message: 'Connection request accepted' });
  } catch (err) {
    console.error('Error accepting connection request:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get connected users
router.get('/connected', auth, async (req, res) => {
  try {
    // Find all connections where the user is either requester or recipient and status is 'connected'
    const connections = await Connection.find({
      $or: [
        { requester: req.user.id, status: 'connected' },
        { recipient: req.user.id, status: 'connected' }
      ]
    }).populate('requester recipient', 'name email profilePicture skills');

    // Map connections to a list of connected users
    const connectedUsers = connections.map(conn => {
      // Determine which user in the connection is the other user (not the current user)
      const otherUser = conn.requester._id.toString() === req.user.id ? conn.recipient : conn.requester;
      
      return {
        _id: otherUser._id,
        name: otherUser.name,
        profilePicture: otherUser.profilePicture,
        skills: otherUser.skills || []
      };
    });

    res.json({ success: true, connections: connectedUsers });
  } catch (err) {
    console.error('Error fetching connected users:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch connected users',
      error: err.message 
    });
  }
});

module.exports = router;