const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { httpError, requireObjectId, ensureAllowedKeys, parsePagination, escapeRegex } = require('../utils/http');
const { hashPassword, isValidPasswordLength } = require('../utils/passwords');

const safeFields = 'name email role createdAt updatedAt';
const roles = ['admin', 'teacher', 'student'];

async function listUsers(req, res) {
  const allowed = ['page', 'limit', 'role', 'q', 'sort'];
  ensureAllowedKeys(req.query, allowed);
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.role !== undefined) {
    if (!roles.includes(req.query.role)) throw httpError(400, 'role must be admin, teacher, or student');
    filter.role = req.query.role;
  }
  if (req.query.q !== undefined && String(req.query.q).trim()) {
    const expression = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    filter.$or = [{ name: expression }, { email: expression }];
  }
  const sort = req.query.sort || '-createdAt';
  if (!['name', '-name', 'createdAt', '-createdAt'].includes(sort)) throw httpError(400, 'sort must be name, -name, createdAt, or -createdAt');
  const [data, total] = await Promise.all([
    User.find(filter).select(safeFields).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.status(200).json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function createUser(req, res) {
  ensureAllowedKeys(req.body, ['name', 'email', 'password', 'role']);
  const { name, email, password, role } = req.body;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw httpError(400, 'name must be between 2 and 100 characters');
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw httpError(400, 'A valid email is required');
  if (!isValidPasswordLength(password)) throw httpError(400, 'password must be between 8 and 72 bytes');
  if (!roles.includes(role)) throw httpError(400, 'role must be admin, teacher, or student');
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), role, passwordHash: await hashPassword(password) });
  res.status(201).json({ user: user.toObject({ transform: (_doc, value) => { delete value.passwordHash; delete value.__v; return value; } }) });
}

async function createTeacher(req, res) {
  ensureAllowedKeys(req.body, ['name', 'email', 'password']);
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw httpError(400, 'name must be between 2 and 100 characters');
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw httpError(400, 'A valid email is required');
  if (!isValidPasswordLength(password)) throw httpError(400, 'password must be between 8 and 72 bytes');
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'teacher',
    passwordHash: await hashPassword(password),
  });
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}

async function getUser(req, res) {
  requireObjectId(req.params.id, 'user ID');
  const user = await User.findById(req.params.id).select(safeFields);
  if (!user) throw httpError(404, 'User not found');
  res.status(200).json({ user });
}

async function updateUser(req, res) {
  requireObjectId(req.params.id, 'user ID');
  ensureAllowedKeys(req.body, ['name', 'role']);
  if (!Object.keys(req.body).length) throw httpError(400, 'Provide name or role to update');
  if (req.body.name !== undefined && (typeof req.body.name !== 'string' || req.body.name.trim().length < 2 || req.body.name.trim().length > 100)) throw httpError(400, 'name must be between 2 and 100 characters');
  if (req.body.role !== undefined && !roles.includes(req.body.role)) throw httpError(400, 'role must be admin, teacher, or student');
  const target = await User.findById(req.params.id).select('role');
  if (!target) throw httpError(404, 'User not found');
  if (target.role === 'admin' && req.body.role && req.body.role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
    throw httpError(409, 'Cannot change the role of the last admin account');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { ...req.body, ...(req.body.name ? { name: req.body.name.trim() } : {}) } }, { returnDocument: 'after', runValidators: true }).select(safeFields);
  res.status(200).json({ user });
}

async function deleteUser(req, res) {
  requireObjectId(req.params.id, 'user ID');
  if (req.params.id === req.user.id) throw httpError(409, 'Admins cannot delete their own account');
  const user = await User.findById(req.params.id).select('role');
  if (!user) throw httpError(404, 'User not found');
  if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) throw httpError(409, 'Cannot delete the last admin account');
  const [courses, enrollments] = await Promise.all([
    Course.exists({ instructor: user._id }),
    Enrollment.exists({ $or: [{ student: user._id }, { course: { $in: await Course.find({ instructor: user._id }).distinct('_id') } }] }),
  ]);
  if (courses || enrollments) throw httpError(409, 'User has courses or enrollments; reassign or resolve those records before deleting');
  await user.deleteOne();
  res.status(200).json({ message: 'User deleted' });
}

module.exports = { listUsers, createUser, createTeacher, getUser, updateUser, deleteUser };
