const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { httpError, requireObjectId, pick, ensureAllowedKeys } = require('../utils/http');

const lessonFields = ['course', 'title', 'content', 'resourceUrl', 'lessonOrder'];

async function validateCourse(courseId, user) {
  requireObjectId(courseId, 'course ID');
  const course = await Course.findById(courseId).select('instructor');
  if (!course) throw httpError(400, 'Course does not exist');
  if (user.role !== 'admin' && course.instructor.toString() !== user.id) {
    throw httpError(403, 'Teachers can only manage lessons in their own courses');
  }
  return course;
}

async function requireLessonReadAccess(courseId, user) {
  if (user.role === 'admin') return;
  const course = await Course.findById(courseId).select('instructor');
  if (!course) throw httpError(404, 'Course not found');
  if (user.role === 'teacher') {
    if (course.instructor.toString() !== user.id) throw httpError(403, 'Teachers can only view lessons in their own courses');
    return;
  }
  const enrollment = await Enrollment.exists({
    student: user._id,
    course: courseId,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw httpError(403, 'Enroll in this course to access its lessons');
}

async function createLesson(req, res) {
  ensureAllowedKeys(req.body, lessonFields);
  const values = pick(req.body, lessonFields);
  if (!values.course) throw httpError(400, 'course is required');
  await validateCourse(values.course, req.user);
  const lesson = await Lesson.create(values);
  await lesson.populate('course', 'title category status');
  res.status(201).json(lesson);
}

async function listLessonsByCourse(req, res) {
  requireObjectId(req.params.courseId, 'course ID');
  if (!(await Course.exists({ _id: req.params.courseId }))) throw httpError(404, 'Course not found');
  await requireLessonReadAccess(req.params.courseId, req.user);
  const lessons = await Lesson.find({ course: req.params.courseId })
    .sort({ lessonOrder: 1 })
    .populate('course', 'title category status');
  res.status(200).json({ data: lessons, total: lessons.length });
}

async function getLesson(req, res) {
  requireObjectId(req.params.id, 'lesson ID');
  const lesson = await Lesson.findById(req.params.id).populate('course', 'title category status');
  if (!lesson) throw httpError(404, 'Lesson not found');
  await requireLessonReadAccess(lesson.course._id, req.user);
  res.status(200).json(lesson);
}

async function updateLesson(req, res) {
  requireObjectId(req.params.id, 'lesson ID');
  ensureAllowedKeys(req.body, lessonFields);
  const values = pick(req.body, lessonFields);
  if (!Object.keys(values).length) throw httpError(400, 'Provide at least one lesson field to update');
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw httpError(404, 'Lesson not found');
  await validateCourse(lesson.course, req.user);
  if (values.course) await validateCourse(values.course, req.user);
  Object.assign(lesson, values);
  await lesson.save();
  await lesson.populate('course', 'title category status');
  res.status(200).json(lesson);
}

async function deleteLesson(req, res) {
  requireObjectId(req.params.id, 'lesson ID');
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw httpError(404, 'Lesson not found');
  await validateCourse(lesson.course, req.user);
  await lesson.deleteOne();
  res.status(200).json({ message: 'Lesson deleted' });
}

module.exports = { createLesson, listLessonsByCourse, getLesson, updateLesson, deleteLesson };
