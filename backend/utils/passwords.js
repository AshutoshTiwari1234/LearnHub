const bcrypt = require('bcryptjs');

const PASSWORD_SALT_ROUNDS = 12;

function isValidPasswordLength(password) {
  if (typeof password !== 'string') return false;
  const bytes = Buffer.byteLength(password, 'utf8');
  return bytes >= 8 && bytes <= 72;
}

function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { isValidPasswordLength, hashPassword, verifyPassword };
