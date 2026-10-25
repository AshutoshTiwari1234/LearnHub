const User = require('../models/User');
const { httpError, ensureAllowedKeys } = require('../utils/http');
const { createAccessToken } = require('../utils/tokens');
const { isValidPasswordLength, hashPassword, verifyPassword } = require('../utils/passwords');

function validateCredentials(name, email, password) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw httpError(400, 'name must be between 2 and 100 characters');
  }
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw httpError(400, 'A valid email is required');
  }
  if (typeof password !== 'string') throw httpError(400, 'password is required');
  if (!isValidPasswordLength(password)) {
    throw httpError(400, 'password must be between 8 and 72 bytes');
  }
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

function authResponse(user) {
  return { accessToken: createAccessToken(user), tokenType: 'Bearer', user: publicUser(user) };
}

async function register(req, res) {
  ensureAllowedKeys(req.body, ['name', 'email', 'password']);
  const { name, email, password } = req.body;
  validateCredentials(name, email, password);

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role: 'student' });
  res.status(201).json(authResponse(user));
}

async function login(req, res) {
  ensureAllowedKeys(req.body, ['email', 'password']);
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw httpError(400, 'email and password are required');
  }
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw httpError(400, 'A valid email is required');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) throw httpError(400, 'password must not exceed 72 bytes');

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const validPassword = user && await verifyPassword(password, user.passwordHash);
  if (!validPassword) throw httpError(401, 'Invalid email or password');
  res.status(200).json(authResponse(user));
}
async function getCurrentUser(req, res) {
  res.status(200).json({ user: publicUser(req.user) });
}

module.exports = { register, login, getCurrentUser };
