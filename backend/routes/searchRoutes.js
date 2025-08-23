const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/skills/:skill', async (req, res) => {
  try {
    const users = await User.find({ skills: req.params.skill });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;