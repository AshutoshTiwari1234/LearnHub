const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const {
  httpError,
  requireObjectId,
  pick,
  ensureAllowedKeys,
  parsePagination,
  escapeRegex,
} = require('../utils/http');

const courseFields = ['title', 'description', 'instructor', 'category', 'status'];
const safeInstructor = 'name email role';

async function validateInstructor(instructorId) {
  requireObjectId(instructorId, 'instructor ID');
  const instructor = await User.findOne({ _id: instructorId, role: 'teacher' }).select('_id');
  if (!instructor) throw httpError(400, 'instructor must reference an existing teacher account');
}

async function requireCourseManagementAccess(course, user) {
  if (!course) throw httpError(404, 'Course not found');
  if (user.role !== 'admin' && course.instructor.toString() !== user._id.toString()) {
    throw httpError(403, 'Instructors can only manage their own courses');
  }
}

async function createCourse(req, res) {
  ensureAllowedKeys(req.body, courseFields);
  const values = pick(req.body, courseFields);
  if (req.user.role === 'teacher') {
    if (values.instructor && values.instructor.toString() !== req.user.id) {
      throw httpError(403, 'Instructors can only create courses under their own account');
    }
    values.instructor = req.user.id;
  }
  if (!values.instructor) throw httpError(400, 'instructor is required');
  await validateInstructor(values.instructor);

  const course = await Course.create(values);
  await course.populate('instructor', safeInstructor);
  res.status(201).json(course);
}

async function listCourses(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const allowedQuery = ['page', 'limit', 'sort', 'q', 'text', 'category', 'status', 'instructor'];
  ensureAllowedKeys(req.query, allowedQuery);

  const filter = {};
  if (req.query.category !== undefined) filter.category = String(req.query.category).trim();
  if (req.query.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(req.query.status)) {
      throw httpError(400, 'status must be draft, published, or archived');
    }
    filter.status = req.query.status;
  }
  if (req.query.instructor !== undefined) {
    requireObjectId(req.query.instructor, 'instructor ID');
    filter.instructor = req.query.instructor;
  }
  if (req.query.q !== undefined) {
    const search = String(req.query.q).trim();
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: expression }, { description: expression }, { category: expression }];
    }
  }
  if (req.query.text !== undefined) {
    const search = String(req.query.text).trim();
    if (search) filter.$text = { $search: search };
  }

  const sortOptions = {
    title: { title: 1 },
    '-title': { title: -1 },
    createdAt: { createdAt: 1 },
    '-createdAt': { createdAt: -1 },
    updatedAt: { updatedAt: 1 },
    '-updatedAt': { updatedAt: -1 },
  };
  const sort = req.query.sort || '-createdAt';
  if (!sortOptions[sort]) {
    throw httpError(400, `sort must be one of: ${Object.keys(sortOptions).join(', ')}`);
  }

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .sort(sortOptions[sort])
      .skip(skip)
      .limit(limit)
      .populate('instructor', safeInstructor),
    Course.countDocuments(filter),
  ]);

  res.status(200).json({
    data: courses,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

async function getCourse(req, res) {
  requireObjectId(req.params.id, 'course ID');
  const course = await Course.findById(req.params.id).populate('instructor', safeInstructor);
  if (!course) throw httpError(404, 'Course not found');
  res.status(200).json(course);
}

async function updateCourse(req, res) {
  requireObjectId(req.params.id, 'course ID');
  ensureAllowedKeys(req.body, courseFields);
  const values = pick(req.body, courseFields);
  if (!Object.keys(values).length) throw httpError(400, 'Provide at least one course field to update');
  const existingCourse = await Course.findById(req.params.id);
  await requireCourseManagementAccess(existingCourse, req.user);
  if (req.user.role === 'teacher' && values.instructor && values.instructor.toString() !== req.user.id) {
    throw httpError(403, 'Instructors cannot reassign their courses');
  }
  if (values.instructor) await validateInstructor(values.instructor);

  const course = await Course.findByIdAndUpdate(req.params.id, values, {
    returnDocument: 'after',
    runValidators: true,
    context: 'query',
  }).populate('instructor', safeInstructor);
  if (!course) throw httpError(404, 'Course not found');
  res.status(200).json(course);
}

async function deleteCourse(req, res) {
  requireObjectId(req.params.id, 'course ID');
  const existingCourse = await Course.findById(req.params.id);
  await requireCourseManagementAccess(existingCourse, req.user);
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) throw httpError(404, 'Course not found');
  const [lessonsDeleted, enrollmentsDeleted] = await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }),
  ]);
  res.status(200).json({
    message: 'Course and its related lessons and enrollments were deleted',
    deleted: { lessons: lessonsDeleted.deletedCount, enrollments: enrollmentsDeleted.deletedCount },
  });
}

async function enrollmentCountsByCourse(req, res) {
  const counts = await Course.aggregate([
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
        as: 'enrollmentCounts',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'instructor',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        as: 'instructor',
      },
    },
    { $unwind: { path: '$instructor', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        category: 1,
        status: 1,
        instructor: 1,
        enrollmentCount: { $ifNull: [{ $arrayElemAt: ['$enrollmentCounts.total', 0] }, 0] },
        activeEnrollmentCount: { $ifNull: [{ $arrayElemAt: ['$enrollmentCounts.active', 0] }, 0] },
        completedEnrollmentCount: { $ifNull: [{ $arrayElemAt: ['$enrollmentCounts.completed', 0] }, 0] },
      },
    },
    { $sort: { enrollmentCount: -1, title: 1 } },
  ]);
  res.status(200).json({ data: counts });
}

module.exports = { createCourse, listCourses, getCourse, updateCourse, deleteCourse, enrollmentCountsByCourse };
