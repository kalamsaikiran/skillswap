const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    console.log('No Authorization header found');
    return res.status(401).json({ 
      success: false,
      message: 'No token, authorization denied',
      error: 'Missing Authorization header'
    });
  }
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    console.log('No token found in Authorization header');
    return res.status(401).json({ 
      success: false,
      message: 'No token, authorization denied',
      error: 'Invalid token format'
    });
  }

  try {
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.user || !decoded.user.id) {
      console.log('Invalid token payload');
      return res.status(401).json({ 
        success: false,
        message: 'Token is not valid',
        error: 'Invalid token payload'
      });
    }

    console.log('Token verified for user:', decoded.user.id);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid',
      error: err.message
    });
  }
}; 