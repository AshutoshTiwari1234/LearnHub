const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Course = require('../models/Course');
const { httpError, requireObjectId, pick, ensureAllowedKeys, parsePagination } = require('../utils/http');

const safeStudent = 'name email role';
const safeCourse = 'title category status instructor';
const safeInstructor = 'name email role';

async function populateEnrollment(enrollment) {
  await enrollment.populate([
    { path: 'student', select: safeStudent },
    { path: 'course', select: safeCourse, populate: { path: 'instructor', select: safeInstructor } },
  ]);
  return enrollment;
}

async function createEnrollment(req, res) {
  const fields = ['course'];
  ensureAllowedKeys(req.body, fields);
  const values = pick(req.body, fields);
  if (!values.course) throw httpError(400, 'course is required');
  values.student = req.user.id;
  requireObjectId(values.student, 'student ID');
  requireObjectId(values.course, 'course ID');
  const [student, course] = await Promise.all([
    User.findOne({ _id: values.student, role: 'student' }).select('_id'),
    Course.findOne({ _id: values.course, status: 'published' }).select('_id'),
  ]);
  if (!student) throw httpError(400, 'student must reference an existing student account');
  if (!course) throw httpError(400, 'course must reference an existing published course');

  const enrollment = await Enrollment.create(values);
  await populateEnrollment(enrollment);
  res.status(201).json(enrollment);
}

async function listEnrollments(req, res) {
  const allowedQuery = ['page', 'limit', 'student', 'course', 'status'];
  ensureAllowedKeys(req.query, allowedQuery);
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.user.role === 'student') {
    if (req.query.student && req.query.student !== req.user.id) {
      throw httpError(403, 'Students can only view their own enrollments');
    }
    filter.student = req.user.id;
  } else if (req.query.student !== undefined) {
    requireObjectId(req.query.student, 'student ID');
    filter.student = req.query.student;
  }

  if (req.query.course !== undefined) {
    const field = 'course';
    const value = req.query[field];
    requireObjectId(value, `${field} ID`);
    if (req.user.role === 'teacher' && !(await Course.exists({ _id: value, instructor: req.user._id }))) {
      throw httpError(403, 'Instructors can only view enrollments for their own courses');
    }
    filter.course = value;
  } else if (req.user.role === 'teacher') {
    const ownCourseIds = await Course.find({ instructor: req.user._id }).distinct('_id');
    filter.course = { $in: ownCourseIds };
  }

  if (req.query.status !== undefined) {
    if (!['active', 'completed', 'dropped'].includes(req.query.status)) {
      throw httpError(400, 'status must be active, completed, or dropped');
    }
    filter.status = req.query.status;
  }

  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ enrollmentDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('student', safeStudent)
      .populate({ path: 'course', select: safeCourse, populate: { path: 'instructor', select: safeInstructor } }),
    Enrollment.countDocuments(filter),
  ]);

  res.status(200).json({
    data: enrollments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

async function getEnrollment(req, res) {
  requireObjectId(req.params.id, 'enrollment ID');
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) throw httpError(404, 'Enrollment not found');
  await requireEnrollmentAccess(enrollment, req.user);
  res.status(200).json(await populateEnrollment(enrollment));
}

async function requireEnrollmentAccess(enrollment, user) {
  if (user.role === 'admin') return;
  if (user.role === 'student' && enrollment.student.toString() === user.id) return;
  if (user.role === 'teacher' && await Course.exists({ _id: enrollment.course, instructor: user._id })) return;
  throw httpError(403, 'You can only access enrollments assigned to you');
}

async function updateEnrollment(req, res) {
  requireObjectId(req.params.id, 'enrollment ID');
  const fields = ['progress', 'status'];
  ensureAllowedKeys(req.body, fields);
  const values = pick(req.body, fields);
  if (!Object.keys(values).length) throw httpError(400, 'Provide progress or status to update');
  const existingEnrollment = await Enrollment.findById(req.params.id);
  if (!existingEnrollment) throw httpError(404, 'Enrollment not found');
  await requireEnrollmentAccess(existingEnrollment, req.user);
  if (req.user.role === 'student' && Object.hasOwn(values, 'status')) {
    throw httpError(403, 'Students may update progress only');
  }
  const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, values, {
    returnDocument: 'after',
    runValidators: true,
    context: 'query',
  });
  if (!enrollment) throw httpError(404, 'Enrollment not found');
  res.status(200).json(await populateEnrollment(enrollment));
}

async function cancelEnrollment(req, res) {
  requireObjectId(req.params.id, 'enrollment ID');
  const existingEnrollment = await Enrollment.findById(req.params.id);
  if (!existingEnrollment) throw httpError(404, 'Enrollment not found');
  await requireEnrollmentAccess(existingEnrollment, req.user);
  const enrollment = await Enrollment.findByIdAndUpdate(
    req.params.id,
    { status: 'dropped' },
    { returnDocument: 'after', runValidators: true },
  );
  if (!enrollment) throw httpError(404, 'Enrollment not found');
  res.status(200).json(await populateEnrollment(enrollment));
}

module.exports = { createEnrollment, listEnrollments, getEnrollment, updateEnrollment, cancelEnrollment };
