const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  skills: [{
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    category: {
      type: String,
      enum: ['development', 'design', 'business', 'marketing', 'other'],
      required: true
    }
  }],
  interests: [{
    type: String
  }],
  bio: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  availability: {
    type: String,
    enum: ['full-time', 'part-time', 'occasional'],
    default: 'part-time'
  },
  rating: {
    type: Number,
    default: 0
  },
  completedExchanges: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);