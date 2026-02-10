const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { name, email, password, skills = [], interests = [] } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      skills,
      interests,
      connections: [],
      reviews: []
    });
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      skills: newUser.skills,
      interests: newUser.interests,
      connections: newUser.connections,
      reviews: newUser.reviews
    };

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userResponse
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

  
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      skills: user.skills || [],
      interests: user.interests || [],
      connections: user.connections || [],
      reviews: user.reviews || []
    };

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
};