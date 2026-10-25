const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: 'Bearer access token required' });

  let claims;
  try {
    claims = verifyAccessToken(match[1]);
  } catch (error) {
    if (error.status === 500) return next(error);
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }

  if (!mongoose.isValidObjectId(claims.sub)) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
  const user = await User.findById(claims.sub).select('name email role');
  if (!user) return res.status(401).json({ message: 'Invalid or expired access token' });
  req.user = user;
  return next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
