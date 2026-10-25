function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireObjectId(value, fieldName = 'id') {
  const mongoose = require('mongoose');
  if (!mongoose.isValidObjectId(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
}

function pick(source, allowedFields) {
  const result = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
  }
  return result;
}

function ensureAllowedKeys(source, allowedFields) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw httpError(400, 'Request data must be a JSON object');
  }
  const extraKeys = Object.keys(source).filter((key) => !allowedFields.includes(key));
  if (extraKeys.length) {
    throw httpError(400, `Unsupported field(s): ${extraKeys.join(', ')}`);
  }
}

function parsePagination(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) throw httpError(400, 'page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError(400, 'limit must be an integer between 1 and 100');
  }
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { httpError, requireObjectId, pick, ensureAllowedKeys, parsePagination, escapeRegex };
