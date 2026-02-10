const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { name, email, password, skills = [], interests = [] } = req.body;

    if (!name || !email || !password) {
      console.log('Registration validation failed:', { name, email, password: !!password });
      return res.status(400).json({ 
        message: 'Please provide all required fields',
        missing: {
          name: !name,
          email: !email,
          password: !password
        }
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      console.log('Registration failed: User already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      skills,
      interests
    });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;

    await user.save();
    console.log('User created successfully:', {
      id: user._id,
      email: user.email,
      hashedPassword: hashedPassword.substring(0, 10) + '...' // Log first 10 chars of hash
    });

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) {
          console.error('JWT signing error:', err);
          return res.status(500).json({ message: 'Error creating token' });
        }
        res.json({ 
          success: true,
          token,
          userId: user.id,
          user: {
            _id: user.id,
            name: user.name,
            email: user.email,
            skills: user.skills || [],
            interests: user.interests || []
          },
          message: 'Registration successful'
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: err.message 
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', {
      email: req.body.email,
      password: req.body.password ? '***' : undefined
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Login validation failed:', { email, password: !!password });
      return res.status(400).json({ 
        message: 'Please provide email and password',
        missing: {
          email: !email,
          password: !password
        }
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login attempt failed: User not found for email:', email);
      return res.status(400).json({ 
        message: 'User not found',
        details: 'No account exists with this email address'
      });
    }
    console.log('Attempting password comparison for user:', user._id);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      console.log('Login attempt failed: Invalid password for user:', user._id);
      return res.status(400).json({ 
        message: 'Invalid password',
        details: 'The password you entered is incorrect'
      });
    }
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) {
          console.error('JWT signing error:', err);
          return res.status(500).json({ message: 'Error creating token' });
        }
        console.log('Login successful for user:', user._id);
        res.json({ 
          success: true,
          token,
          userId: user.id,
          user: {
            _id: user.id,
            name: user.name,
            email: user.email,
            skills: user.skills || [],
            interests: user.interests || []
          },
          message: 'Login successful'
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      message: 'Server error during login',
      error: err.message 
    });
  }
});

module.exports = router; 