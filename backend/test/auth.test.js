const { after, before, it } = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { app } = require('../server');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { createAccessToken } = require('../utils/tokens');
const { hashPassword } = require('../utils/passwords');

let server;
let baseUrl;
let registeredUser;
let instructor;
let course;
let lesson;
let enrollment;
let instructorToken;
let teacherTestPassword;

async function request(path, { token, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  await connectDB();
  await Promise.all([User.init(), Course.init(), Lesson.init(), Enrollment.init()]);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  teacherTestPassword = crypto.randomBytes(18).toString('base64url');
  [instructor] = await User.create([{
    name: 'Auth Flow Instructor',
    email: `flow-instructor-${suffix}@example.test`,
    passwordHash: await hashPassword(teacherTestPassword),
    role: 'teacher',
  }]);
  instructorToken = createAccessToken(instructor);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (enrollment) await Enrollment.deleteOne({ _id: enrollment._id });
  if (lesson) await Lesson.deleteOne({ _id: lesson._id });
  if (course) await Course.deleteOne({ _id: course._id });
  if (registeredUser) await User.deleteOne({ _id: registeredUser._id });
  if (instructor) await User.deleteOne({ _id: instructor._id });
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

it('registers students, hashes passwords, issues JWTs, and rejects invalid or elevated access', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let teacherLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: instructor.email, password: teacherTestPassword },
  });
  assert.equal(teacherLogin.status, 200);
  assert.equal(teacherLogin.body.user.role, 'teacher');
  assert.equal(JSON.stringify(teacherLogin.body).includes('passwordHash'), false);
  const teacherLoginToken = teacherLogin.body.accessToken;
  const email = `auth-${suffix}@example.test`;
  const title = `Full Flow Course ${suffix}`;
  let result = await request('/api/courses', {
    method: 'POST',
    token: instructorToken,
    body: { title, description: 'Course used to verify the complete learner journey.', category: `Flow-${suffix}`, status: 'published' },
  });
  assert.equal(result.status, 201);
  course = await Course.findById(result.body._id);
  assert.equal((await request(`/api/courses?q=${encodeURIComponent(title)}&status=published`)).body.pagination.total, 1);
  assert.equal((await request(`/api/courses/${course.id}`)).status, 200);

  result = await request('/api/lessons', {
    method: 'POST',
    token: instructorToken,
    body: { course: course.id, title: 'First flow lesson', content: 'A sample lesson in the integration flow.', lessonOrder: 1 },
  });
  assert.equal(result.status, 201);
  lesson = await Lesson.findById(result.body._id);
  assert.equal((await request(`/api/lessons/course/${course.id}`, { token: instructorToken })).body.total, 1);
  assert.equal((await request(`/api/lessons/${lesson.id}`, { token: instructorToken })).status, 200);

  const [teacherCourses, teacherEnrollmentStats, teacherProgressStats, teacherEnrollments] = await Promise.all([
    request(`/api/courses?instructor=${instructor.id}&page=1&limit=100&sort=-createdAt`),
    request('/api/analytics/enrollments-per-course', { token: teacherLoginToken }),
    request('/api/analytics/average-progress-per-course', { token: teacherLoginToken }),
    request('/api/enrollments?page=1&limit=100', { token: teacherLoginToken }),
  ]);
  assert.equal(teacherCourses.status, 200);
  assert.ok(teacherCourses.body.data.some((item) => item._id === course.id));
  assert.equal(teacherEnrollmentStats.status, 200);
  assert.equal(teacherProgressStats.status, 200);
  assert.equal(teacherEnrollments.status, 200);

  result = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Auth Test Student', email, password: 'correct-horse-92' },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.user.role, 'student');
  assert.equal(result.body.tokenType, 'Bearer');
  assert.equal(typeof result.body.accessToken, 'string');
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(result.body).includes(process.env.JWT_SECRET), false);

  registeredUser = await User.findById(result.body.user.id).select('+passwordHash');
  assert.ok(registeredUser.passwordHash.startsWith('$2'));
  assert.equal(await bcrypt.compare('correct-horse-92', registeredUser.passwordHash), true);
  assert.equal(await bcrypt.compare('wrong-password', registeredUser.passwordHash), false);

  const accessToken = result.body.accessToken;
  result = await request('/api/auth/me', { token: accessToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, registeredUser.id);
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);

  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/auth/me', { token: 'not-a-jwt' })).status, 401);
  const expiredToken = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: registeredUser.id,
    issuer: 'learnhub-api',
    audience: 'learnhub-client',
    expiresIn: -1,
  });
  assert.equal((await request('/api/auth/me', { token: expiredToken })).status, 401);

  result = await request('/api/auth/login', {
    method: 'POST',
    body: { email: email.toUpperCase(), password: 'correct-horse-92' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, registeredUser.id);
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  const loginToken = result.body.accessToken;
  result = await request('/api/enrollments', {
    method: 'POST', token: loginToken, body: { course: course.id },
  });
  assert.equal(result.status, 201);
  enrollment = await Enrollment.findById(result.body._id);
  assert.equal(result.body.student._id, registeredUser.id);
  assert.equal(result.body.course._id, course.id);
  result = await request(`/api/enrollments/${enrollment.id}`, {
    method: 'PATCH', token: loginToken, body: { progress: 35 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.progress, 35);
  result = await request(`/api/courses/${course.id}`, {
    method: 'PUT', token: instructorToken, body: { description: 'Instructor successfully updated this course.' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.description, 'Instructor successfully updated this course.');
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: { email, password: 'incorrect-password' },
  })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email } })).status, 400);

  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { name: 'Elevated User', email: `admin-${suffix}@example.test`, password: 'correct-horse-92', role: 'admin' },
  })).status, 400);
  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { name: 'Teacher User', email: `teacher-${suffix}@example.test`, password: 'correct-horse-92', role: 'teacher' },
  })).status, 400);
  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { name: 'Instructor User', email: `instructor-${suffix}@example.test`, password: 'correct-horse-92', role: 'instructor' },
  })).status, 400);
  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { name: 'Short', email: `short-${suffix}@example.test`, password: 'short' },
  })).status, 400);
  assert.equal((await request('/api/auth/register', {
    method: 'POST', body: { name: 'Duplicate User', email, password: 'correct-horse-92' },
  })).status, 409);
  assert.equal((await request('/api/courses', {
    method: 'POST', token: accessToken, body: {},
  })).status, 403);
});
