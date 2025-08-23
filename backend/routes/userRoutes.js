const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/userController');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Connection = require('../models/Connection');

router.post('/signup', signup);
router.post('/login', login);

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('skills')
      .populate('interests');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      skills: user.skills || [],
      interests: user.interests || []
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available partners for skill exchange with filtering
router.get('/available-partners', auth, async (req, res) => {
  try {
    const { search, category, availability, location } = req.query;
    
    // First get connected users
    const connections = await Connection.find({
      $or: [
        { requester: req.user.id, status: 'connected' },
        { recipient: req.user.id, status: 'connected' }
      ]
    });

    // Get IDs of connected users
    const connectedUserIds = connections.map(conn => 
      conn.requester.toString() === req.user.id ? conn.recipient.toString() : conn.requester.toString()
    );

    // If no connections, return empty result
    if (connectedUserIds.length === 0) {
      return res.json({
        success: true,
        partners: [],
        total: 0
      });
    }

    // Build the query - only include connected users
    const query = {
      _id: { $in: connectedUserIds } // Only show connected users
    };

    // Add search condition if search term exists
    if (search) {
      query.$and = [{
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { 'skills.name': { $regex: search, $options: 'i' } }
        ]
      }];
    }

    if (category) {
      query['skills.category'] = category;
    }

    if (availability) {
      query.availability = availability;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Find all matching connected users
    const partners = await User.find(query)
      .select('name skills bio profilePicture location availability rating completedExchanges')
      .sort({ rating: -1, completedExchanges: -1 });

    // Transform the data to match the expected format
    const formattedPartners = partners.map(partner => ({
      _id: partner._id,
      name: partner.name,
      skills: partner.skills || [],
      bio: partner.bio || '',
      profilePicture: partner.profilePicture || '',
      location: partner.location || '',
      availability: partner.availability || '',
      rating: partner.rating || 0,
      completedExchanges: partner.completedExchanges || 0,
      isConnected: true // All users here are connected
    }));

    console.log('Search results:', {
      searchTerm: search,
      totalResults: formattedPartners.length,
      results: formattedPartners.map(p => ({ name: p.name }))
    });

    res.json({
      success: true,
      partners: formattedPartners,
      total: formattedPartners.length
    });
  } catch (error) {
    console.error('Error fetching available partners:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching available partners', 
      error: error.message 
    });
  }
});

// Get partner profile details
router.get('/partner/:id', auth, async (req, res) => {
  try {
    const partner = await User.findById(req.params.id)
      .select('name skills bio profilePicture location availability rating completedExchanges interests');

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    res.json(partner);
  } catch (error) {
    console.error('Error fetching partner profile:', error);
    res.status(500).json({ message: 'Error fetching partner profile', error: error.message });
  }
});

// Get skill categories
router.get('/skill-categories', auth, async (req, res) => {
  try {
    const categories = await User.distinct('skills.category');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching skill categories:', error);
    res.status(500).json({ message: 'Error fetching skill categories', error: error.message });
  }
});

module.exports = router;