require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { hashPassword, isValidPasswordLength } = require('../utils/passwords');

const userSpecs = [
  { name: 'Asha Mehta', email: 'asha.instructor@learnhub.local', role: 'teacher' },
  { name: 'Rohan Das', email: 'rohan.instructor@learnhub.local', role: 'teacher' },
  { name: 'Maya Sharma', email: 'maya.student@learnhub.local', role: 'student' },
  { name: 'Kabir Rao', email: 'kabir.student@learnhub.local', role: 'student' },
  { name: 'Ananya Iyer', email: 'ananya.student@learnhub.local', role: 'student' },
  { name: 'Dev Patel', email: 'dev.student@learnhub.local', role: 'student' },
];

const courseSpecs = [
  {
    title: 'MongoDB Fundamentals',
    description: 'Learn documents, collections, indexes, and aggregation with practical examples.',
    instructorEmail: 'asha.instructor@learnhub.local',
    category: 'Databases',
    lessons: [
      { title: 'Documents and Collections', content: 'Compare document data with relational rows and explore nested BSON values.' },
      { title: 'Indexes and Query Plans', content: 'Use indexes to speed up common filters and inspect query execution.' },
      { title: 'Aggregation Pipelines', content: 'Transform and summarize documents with match, group, lookup, and project stages.' },
    ],
  },
  {
    title: 'REST APIs with Express',
    description: 'Build validated REST endpoints with middleware, controllers, and MongoDB models.',
    instructorEmail: 'rohan.instructor@learnhub.local',
    category: 'Backend Development',
    lessons: [
      { title: 'Routing and Middleware', content: 'Structure an Express application using routers and shared middleware.' },
      { title: 'Request Validation', content: 'Validate request bodies and return clear HTTP error responses.' },
      { title: 'Connecting Mongoose Models', content: 'Use Mongoose models and references from route controllers.' },
    ],
  },
  {
    title: 'Data Modeling for Web Apps',
    description: 'Design references, embedded documents, and indexes for common application workflows.',
    instructorEmail: 'asha.instructor@learnhub.local',
    category: 'Databases',
    lessons: [
      { title: 'Choosing References', content: 'Model one-to-many and many-to-many relationships with ObjectId references.' },
      { title: 'Validation and Constraints', content: 'Use schema validation and compound indexes to protect data integrity.' },
    ],
  },
  {
    title: 'Node.js Backend Essentials',
    description: 'Practice asynchronous JavaScript, configuration, and dependable backend structure.',
    instructorEmail: 'rohan.instructor@learnhub.local',
    category: 'Backend Development',
    lessons: [
      { title: 'Async Workflows', content: 'Handle asynchronous database work with promises and async functions.' },
      { title: 'Environment Configuration', content: 'Load local configuration safely without committing credentials.' },
    ],
  },
];

const enrollmentSpecs = [
  ['maya.student@learnhub.local', 'MongoDB Fundamentals', 'active', 25],
  ['kabir.student@learnhub.local', 'MongoDB Fundamentals', 'active', 60],
  ['ananya.student@learnhub.local', 'MongoDB Fundamentals', 'completed', 100],
  ['maya.student@learnhub.local', 'REST APIs with Express', 'active', 40],
  ['dev.student@learnhub.local', 'REST APIs with Express', 'active', 0],
  ['kabir.student@learnhub.local', 'Data Modeling for Web Apps', 'active', 75],
];

async function findOrInsert(Model, lookup, values, counts, kind) {
  const existing = await Model.findOne(lookup);
  if (existing) {
    counts[kind].skipped += 1;
    return existing;
  }
  try {
    const created = await Model.create(values);
    counts[kind].inserted += 1;
    return created;
  } catch (error) {
    if (error.code === 11000) {
      const raced = await Model.findOne(lookup);
      if (raced) {
        counts[kind].skipped += 1;
        return raced;
      }
    }
    throw error;
  }
}

async function seedDatabase(seedPassword, models = { User, Course, Lesson, Enrollment }) {
  if (!isValidPasswordLength(seedPassword)) {
    throw new Error('Set SEED_PASSWORD to a temporary password of 8–72 UTF-8 bytes before seeding.');
  }

  const { User: UserModel, Course: CourseModel, Lesson: LessonModel, Enrollment: EnrollmentModel } = models;

  const counts = Object.fromEntries(['users', 'courses', 'lessons', 'enrollments'].map((key) => [key, { inserted: 0, skipped: 0 }]));
  const users = new Map();

  for (const spec of userSpecs) {
    const existing = await UserModel.findOne({ email: spec.email });
    if (existing) {
      if (existing.role !== spec.role) {
        throw new Error(`Seed email ${spec.email} already exists with a different role; no record was changed.`);
      }
      counts.users.skipped += 1;
      users.set(spec.email, existing);
      continue;
    }
    const user = await findOrInsert(
      UserModel,
      { email: spec.email },
      { ...spec, passwordHash: await hashPassword(seedPassword) },
      counts,
      'users',
    );
    if (user.role !== spec.role) {
      throw new Error(`Seed email ${spec.email} already exists with a different role; no record was changed.`);
    }
    users.set(spec.email, user);
  }

  const courses = new Map();
  for (const spec of courseSpecs) {
    const instructor = users.get(spec.instructorEmail);
    const existing = await CourseModel.findOne({ title: spec.title });
    if (existing) {
      if (existing.instructor.toString() !== instructor._id.toString() || existing.category !== spec.category) {
        throw new Error(`Seed course title ${spec.title} is already in use by another record; no record was changed.`);
      }
      counts.courses.skipped += 1;
      courses.set(spec.title, existing);
      continue;
    }
    const course = await findOrInsert(
      CourseModel,
      { title: spec.title },
      { title: spec.title, description: spec.description, instructor: instructor._id, category: spec.category, status: 'published' },
      counts,
      'courses',
    );
    if (course.instructor.toString() !== instructor._id.toString() || course.category !== spec.category) {
      throw new Error(`Seed course title ${spec.title} is already in use by another record; no record was changed.`);
    }
    courses.set(spec.title, course);
  }

  for (const spec of courseSpecs) {
    const course = courses.get(spec.title);
    for (let index = 0; index < spec.lessons.length; index += 1) {
      const lesson = spec.lessons[index];
      await findOrInsert(
        LessonModel,
        { course: course._id, lessonOrder: index + 1 },
        { course: course._id, title: lesson.title, content: lesson.content, lessonOrder: index + 1 },
        counts,
        'lessons',
      );
    }
  }

  for (const [studentEmail, courseTitle, status, progress] of enrollmentSpecs) {
    const student = users.get(studentEmail);
    const course = courses.get(courseTitle);
    await findOrInsert(
      EnrollmentModel,
      { student: student._id, course: course._id },
      { student: student._id, course: course._id, status, progress },
      counts,
      'enrollments',
    );
  }

  return counts;
}

async function main() {
  if (typeof process.env.SEED_PASSWORD !== 'string' || !process.env.SEED_PASSWORD) {
    throw new Error('SEED_PASSWORD is required. Supply it temporarily in the environment; it is never saved by this script.');
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is not configured.');
  let mongoHost;
  try {
    mongoHost = new URL(mongoUri).hostname;
  } catch {
    throw new Error('MONGO_URI is invalid.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(mongoHost)) {
    throw new Error('Refusing to seed: MONGO_URI must point to a local MongoDB server.');
  }
  const seedPassword = process.env.SEED_PASSWORD;
  delete process.env.SEED_PASSWORD;
  await connectDB();
  if (mongoose.connection.name !== 'learnhub' || !['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host)) {
    throw new Error('Refusing to seed: this script only writes to the local learnhub database.');
  }
  const counts = await seedDatabase(seedPassword);
  console.log('LearnHub demo seed complete (no existing records were updated or deleted):');
  for (const [kind, result] of Object.entries(counts)) {
    console.log(`  ${kind}: ${result.inserted} inserted, ${result.skipped} already present`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Seed failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { seedDatabase };
