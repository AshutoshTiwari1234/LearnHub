const Course = require('../models/Course');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { ensureAllowedKeys } = require('../utils/http');

function validateAnalyticsRequest(req) {
  ensureAllowedKeys(req.query, []);
}

function courseScope(req) {
  return req.user.role === 'teacher' ? { instructor: req.user._id } : {};
}

async function enrollmentsPerCourse(req, res) {
  validateAnalyticsRequest(req);
  const data = await Course.aggregate([
    { $match: courseScope(req) },
    {
      $lookup: {
        from: 'enrollments',
        let: { courseId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$course', '$$courseId'] } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
        ],
        as: 'counts',
      },
    },
    {
      $project: {
        title: 1,
        category: 1,
        enrollmentCount: { $ifNull: [{ $arrayElemAt: ['$counts.total', 0] }, 0] },
        activeEnrollmentCount: { $ifNull: [{ $arrayElemAt: ['$counts.active', 0] }, 0] },
        completedEnrollmentCount: { $ifNull: [{ $arrayElemAt: ['$counts.completed', 0] }, 0] },
      },
    },
    { $sort: { enrollmentCount: -1, title: 1 } },
  ]);
  res.status(200).json({ data });
}

async function coursesPerInstructor(req, res) {
  validateAnalyticsRequest(req);
  const match = { role: 'teacher' };
  if (req.user.role === 'teacher') match._id = req.user._id;
  const data = await User.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'courses',
        let: { instructorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$instructor', '$$instructorId'] } } },
          { $count: 'count' },
        ],
        as: 'courseCounts',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        courseCount: { $ifNull: [{ $arrayElemAt: ['$courseCounts.count', 0] }, 0] },
      },
    },
    { $sort: { courseCount: -1, name: 1 } },
  ]);
  res.status(200).json({ data });
}

async function averageProgressPerCourse(req, res) {
  validateAnalyticsRequest(req);
  const data = await Course.aggregate([
    { $match: courseScope(req) },
    {
      $lookup: {
        from: 'enrollments',
        let: { courseId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$course', '$$courseId'] } } },
          { $group: { _id: null, averageProgress: { $avg: '$progress' }, enrollmentCount: { $sum: 1 } } },
        ],
        as: 'progressStats',
      },
    },
    {
      $project: {
        title: 1,
        category: 1,
        averageProgress: { $arrayElemAt: ['$progressStats.averageProgress', 0] },
        enrollmentCount: { $ifNull: [{ $arrayElemAt: ['$progressStats.enrollmentCount', 0] }, 0] },
      },
    },
    { $sort: { averageProgress: -1, title: 1 } },
  ]);
  res.status(200).json({ data });
}

async function coursesByCategory(req, res) {
  validateAnalyticsRequest(req);
  const data = await Course.aggregate([
    { $match: courseScope(req) },
    {
      $group: {
        _id: '$category',
        courseCount: { $sum: 1 },
        publishedCount: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        archivedCount: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
      },
    },
    { $sort: { courseCount: -1, _id: 1 } },
    { $project: { _id: 0, category: '$_id', courseCount: 1, publishedCount: 1, draftCount: 1, archivedCount: 1 } },
  ]);
  res.status(200).json({ data });
}

async function platformStats(req, res) {
  validateAnalyticsRequest(req);
  const [users, courses, lessons, enrollments, roles] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Lesson.countDocuments(),
    Enrollment.countDocuments(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  res.status(200).json({ data: { users, courses, lessons, enrollments, usersByRole: Object.fromEntries(roles.map(({ _id, count }) => [_id, count])) } });
}

module.exports = { enrollmentsPerCourse, coursesPerInstructor, averageProgressPerCourse, coursesByCategory, platformStats };
