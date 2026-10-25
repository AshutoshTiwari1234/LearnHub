const jwt = require('jsonwebtoken');

const ISSUER = 'learnhub-api';
const AUDIENCE = 'learnhub-client';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error('JWT_SECRET must be configured with at least 32 bytes');
    error.status = 500;
    throw error;
  }
  return secret;
}

function createAccessToken(user) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

module.exports = { getJwtSecret, createAccessToken, verifyAccessToken };
