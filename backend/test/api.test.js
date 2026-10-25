const { after, before, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/learnhub';

const mongoose = require('mongoose');
const { app } = require('../server');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { createAccessToken } = require('../utils/tokens');

let server;
let baseUrl;
let instructor;
let student;
let admin;
let otherInstructor;
let otherStudent;
let course;
let secondCourse;
let otherCourse;
let lessonToDelete;
let enrollment;
let testCategory;
let dedicatedTeacher;
let instructorToken;
let studentToken;
let adminToken;
let otherInstructorToken;
let otherStudentToken;

async function request(path, { token, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  return { status: response.status, body };
}

before(async () => {
  await connectDB();
  await Promise.all([User.init(), Course.init(), Lesson.init(), Enrollment.init()]);
  assert.deepEqual(User.schema.path('role').enumValues.sort(), ['admin', 'student', 'teacher']);
  const courseIndexes = Course.schema.indexes();
  const enrollmentIndexes = Enrollment.schema.indexes();
  const lessonIndexes = Lesson.schema.indexes();
  assert.ok(courseIndexes.some(([keys]) => keys.title === 'text' && keys.description === 'text' && keys.category === 'text'));
  assert.ok(courseIndexes.some(([keys]) => keys.instructor === 1 && keys.status === 1 && keys.createdAt === -1));
  assert.ok(enrollmentIndexes.some(([keys, options]) => keys.student === 1 && keys.course === 1 && options.unique));
  assert.ok(enrollmentIndexes.some(([keys]) => keys.student === 1 && keys.enrollmentDate === -1));
  assert.ok(lessonIndexes.some(([keys, options]) => keys.course === 1 && keys.lessonOrder === 1 && options.unique));
  const storedCourseIndexes = await Course.collection.indexes();
  const storedEnrollmentIndexes = await Enrollment.collection.indexes();
  assert.ok(storedCourseIndexes.some((index) => index.name === 'course_text_search'));
  assert.ok(storedEnrollmentIndexes.some((index) => index.unique && index.key.student === 1 && index.key.course === 1));
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  testCategory = `API-${suffix}`;
  [instructor, student, admin, otherInstructor, otherStudent] = await User.create([
    { name: 'API Test Teacher', email: `teacher-${suffix}@example.test`, passwordHash: 'test-hash', role: 'teacher' },
    { name: 'API Test Student', email: `student-${suffix}@example.test`, passwordHash: 'test-hash', role: 'student' },
    { name: 'API Test Admin', email: `admin-${suffix}@example.test`, passwordHash: 'test-hash', role: 'admin' },
    { name: 'API Test Other Teacher', email: `other-teacher-${suffix}@example.test`, passwordHash: 'test-hash', role: 'teacher' },
    { name: 'API Test Other Student', email: `other-student-${suffix}@example.test`, passwordHash: 'test-hash', role: 'student' },
  ]);
  instructorToken = createAccessToken(instructor);
  studentToken = createAccessToken(student);
  adminToken = createAccessToken(admin);
  otherInstructorToken = createAccessToken(otherInstructor);
  otherStudentToken = createAccessToken(otherStudent);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const testCourse of [course, secondCourse, otherCourse].filter(Boolean)) {
    await Promise.all([
      Lesson.deleteMany({ course: testCourse._id }),
      Enrollment.deleteMany({ course: testCourse._id }),
      Course.deleteOne({ _id: testCourse._id }),
    ]);
  }
  if (instructor || student) {
    await User.deleteMany({
      _id: { $in: [instructor?._id, student?._id, admin?._id, otherInstructor?._id, otherStudent?._id].filter(Boolean) },
    });
  }
  if (dedicatedTeacher) await User.deleteOne({ _id: dedicatedTeacher });
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

it('supports course, lesson, enrollment, and aggregation APIs with validation and safe population', async () => {
  let result = await request('/api/courses', {
    method: 'POST',
    token: instructorToken,
    body: { title: `MongoDB API Test Course ${testCategory}`, description: 'Temporary API test course', instructor: instructor.id, category: testCategory, status: 'published' },
  });
  assert.equal(result.status, 201);
  course = await Course.findById(result.body._id);
  assert.equal(result.body.instructor.name, instructor.name);
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  assert.equal((await request('/api/courses', { method: 'POST', token: instructorToken, body: {} })).status, 400);
  assert.equal((await request('/api/courses', { method: 'POST', token: studentToken, body: {} })).status, 403);

  result = await request('/api/courses', {
    method: 'POST',
    token: instructorToken,
    body: { title: `AAA API Test Course ${testCategory}`, description: 'Temporary sorting fixture', instructor: instructor.id, category: testCategory, status: 'published' },
  });
  assert.equal(result.status, 201);
  secondCourse = await Course.findById(result.body._id);

  result = await request('/api/courses', {
    method: 'POST',
    token: adminToken,
    body: { title: `Other Owner Course ${testCategory}`, description: 'Ownership fixture', instructor: otherInstructor.id, category: `Other-${testCategory}`, status: 'published' },
  });
  assert.equal(result.status, 201);
  otherCourse = await Course.findById(result.body._id);
  result = await request(`/api/courses/${otherCourse.id}`, { method: 'PUT', token: adminToken, body: { description: 'Admin can manage all courses.' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.description, 'Admin can manage all courses.');
  assert.equal((await request(`/api/courses/${otherCourse.id}`, {
    method: 'PUT', token: instructorToken, body: { title: 'Unauthorized edit' },
  })).status, 403);
  assert.equal((await request(`/api/courses/${otherCourse.id}`, {
    method: 'DELETE', token: instructorToken,
  })).status, 403);
  assert.equal((await request('/api/lessons', {
    method: 'POST', token: instructorToken,
    body: { course: otherCourse.id, title: 'Unauthorized lesson', content: 'Nope', lessonOrder: 1 },
  })).status, 403);

  result = await request(`/api/courses?q=MongoDB&category=${testCategory}&status=published&page=1&limit=1&sort=title`);
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.data[0]._id, course.id);
  result = await request(`/api/courses?text=MongoDB&category=${testCategory}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  result = await request(`/api/courses?category=${testCategory}&page=1&limit=1&sort=title`);
  assert.equal(result.body.pagination.total, 2);
  assert.equal(result.body.pagination.pages, 2);
  assert.equal(result.body.data[0]._id, secondCourse.id);
  result = await request(`/api/courses?category=${testCategory}&page=2&limit=1&sort=title`);
  assert.equal(result.body.data[0]._id, course.id);
  assert.equal((await request('/api/courses?sort=unsupported')).status, 400);
  assert.equal((await request('/api/courses?page=0')).status, 400);
  assert.equal((await request('/api/courses/not-an-id')).status, 400);
  assert.equal((await request('/api/courses/000000000000000000000001')).status, 404);

  result = await request(`/api/courses/${course.id}`);
  assert.equal(result.status, 200);
  result = await request(`/api/courses/${course.id}`, {
    method: 'PUT', token: instructorToken, body: { description: 'Updated API test description' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.description, 'Updated API test description');

  result = await request('/api/lessons', {
    method: 'POST',
    token: instructorToken,
    body: { course: course.id, title: 'First temporary lesson', content: 'Sample lesson content', lessonOrder: 1 },
  });
  assert.equal(result.status, 201);
  lessonToDelete = result.body._id;
  assert.equal(result.body.course.title, course.title);
  assert.equal((await request(`/api/lessons/course/${course.id}`)).status, 401);
  assert.equal((await request(`/api/lessons/${lessonToDelete}`)).status, 401);
  assert.equal((await request(`/api/lessons/course/${course.id}`, { token: instructorToken })).body.total, 1);
  assert.equal((await request(`/api/lessons/${lessonToDelete}`, { token: instructorToken })).status, 200);
  assert.equal((await request(`/api/lessons/course/${course.id}`, { token: otherStudentToken })).status, 403);
  assert.equal((await request(`/api/lessons/course/${course.id}`, { token: otherInstructorToken })).status, 403);
  assert.equal((await request('/api/lessons', {
    method: 'POST',
    token: instructorToken,
    body: { course: course.id, title: 'Invalid lesson', lessonOrder: 2 },
  })).status, 400);
  assert.equal((await request('/api/lessons/not-an-id', { token: instructorToken })).status, 400);
  assert.equal((await request('/api/lessons/course/not-an-id', { token: instructorToken })).status, 400);
  assert.equal((await request('/api/lessons', { method: 'POST', token: instructorToken, body: {} })).status, 400);
  result = await request(`/api/lessons/${lessonToDelete}`, {
    method: 'PUT',
    token: instructorToken,
    body: { title: 'Updated first lesson' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.title, 'Updated first lesson');
  assert.equal((await request(`/api/lessons/${lessonToDelete}`, {
    method: 'PUT',
    token: instructorToken,
    body: { content: null, resourceUrl: null },
  })).status, 400);
  assert.equal((await request(`/api/lessons/${lessonToDelete}`, { method: 'DELETE', token: instructorToken })).status, 200);

  const cascadeLesson = await Lesson.create({ course: course.id, title: 'Cascade lesson', content: 'Temporary', lessonOrder: 2 });
  result = await request('/api/enrollments', {
    method: 'POST',
    token: studentToken,
    body: { course: course.id },
  });
  assert.equal(result.status, 201);
  enrollment = result.body._id;
  assert.equal((await request(`/api/lessons/course/${course.id}`, { token: studentToken })).body.total, 1);
  assert.equal((await request(`/api/lessons/${cascadeLesson.id}`, { token: studentToken })).status, 200);
  assert.equal((await request(`/api/lessons/${cascadeLesson.id}`, { token: adminToken })).status, 200);
  assert.equal(result.body.student.name, student.name);
  assert.equal(result.body.course.instructor.name, instructor.name);
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  assert.equal((await request('/api/enrollments', { method: 'POST', token: studentToken, body: {} })).status, 400);
  assert.equal((await request('/api/enrollments', { method: 'POST', token: studentToken, body: { course: course.id } })).status, 409);
  assert.equal((await request('/api/enrollments', { method: 'POST', token: instructorToken, body: { course: course.id } })).status, 403);
  const teacherEnrollments = await request(`/api/enrollments?course=${course.id}`, { token: instructorToken });
  assert.equal(teacherEnrollments.status, 200);
  assert.equal(teacherEnrollments.body.data[0].student.email, student.email);
  assert.equal((await request(`/api/enrollments?course=${course.id}`, { token: otherInstructorToken })).status, 403);
  assert.equal((await request('/api/enrollments?limit=100', { token: adminToken })).body.data.some((item) => item._id === enrollment), true);
  assert.equal((await request('/api/enrollments/not-an-id', { token: studentToken })).status, 400);
  assert.equal((await request('/api/enrollments/000000000000000000000001', { token: studentToken })).status, 404);
  assert.equal((await request(`/api/enrollments/${enrollment}`, { token: studentToken })).status, 200);
  assert.equal((await request(`/api/enrollments/${enrollment}`, { token: otherStudentToken })).status, 403);
  assert.equal((await request(`/api/enrollments?student=${student.id}&status=active`, { token: studentToken })).body.pagination.total, 1);
  assert.equal((await request(`/api/enrollments?student=${student.id}`, { token: otherStudentToken })).status, 403);
  result = await request(`/api/enrollments/${enrollment}`, { method: 'PATCH', token: studentToken, body: { progress: 40 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.progress, 40);
  assert.equal((await request(`/api/enrollments/${enrollment}`, { method: 'PATCH', token: studentToken, body: { progress: 101 } })).status, 400);
  assert.equal((await request(`/api/enrollments/${enrollment}`, { method: 'PATCH', token: studentToken, body: { status: 'completed' } })).status, 403);
  assert.equal((await request(`/api/enrollments/${enrollment}/cancel`, { method: 'PATCH', token: studentToken })).body.status, 'dropped');
  result = await request('/api/enrollments/stats/courses');
  const aggregate = result.body.data.find((item) => item._id === course.id);
  const zeroAggregate = result.body.data.find((item) => item._id === secondCourse.id);
  assert.equal(result.status, 200);
  assert.equal(aggregate.enrollmentCount, 1);
  assert.equal(aggregate.activeEnrollmentCount, 0);
  assert.equal(zeroAggregate.enrollmentCount, 0);

  assert.equal((await request('/api/analytics/enrollments-per-course')).status, 401);
  assert.equal((await request('/api/analytics/enrollments-per-course', { token: studentToken })).status, 403);
  assert.equal((await request('/api/analytics/courses-per-instructor?unknown=true', { token: adminToken })).status, 400);
  assert.equal((await request('/api/analytics/platform-stats', { token: instructorToken })).status, 403);
  result = await request('/api/analytics/platform-stats', { token: adminToken });
  assert.equal(result.status, 200);
  assert.ok(result.body.data.usersByRole.teacher >= 2);
  assert.ok(result.body.data.courses >= 2);
  assert.equal((await request('/api/users', { token: studentToken })).status, 403);
  assert.equal((await request('/api/users', { token: instructorToken })).status, 403);
  assert.equal((await request('/api/users/teachers', { method: 'POST', body: {} })).status, 401);
  assert.equal((await request('/api/users/teachers', { token: studentToken, method: 'POST', body: {} })).status, 403);
  assert.equal((await request('/api/users/teachers', { token: instructorToken, method: 'POST', body: {} })).status, 403);
  const teacherTestPassword = require('node:crypto').randomBytes(18).toString('base64url');
  result = await request('/api/users/teachers', { token: adminToken, method: 'POST', body: { name: 'Dedicated Teacher', email: `dedicated-${testCategory}@example.test`, password: teacherTestPassword } });
  assert.equal(result.status, 201);
  dedicatedTeacher = result.body.user.id;
  assert.equal(result.body.user.role, 'teacher');
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  const storedTeacher = await User.findById(dedicatedTeacher).select('+passwordHash');
  assert.ok(storedTeacher.passwordHash.startsWith('$2'));
  assert.equal((await request('/api/users/teachers', { token: adminToken, method: 'POST', body: { name: 'Duplicate Teacher', email: `dedicated-${testCategory}@example.test`, password: teacherTestPassword } })).status, 409);
  assert.equal((await request('/api/users/teachers', { token: adminToken, method: 'POST', body: { name: 'Invalid Role', email: `invalid-role-${testCategory}@example.test`, password: teacherTestPassword, role: 'admin' } })).status, 400);
  const adminUsers = await request('/api/users?role=teacher', { token: adminToken });
  assert.equal(adminUsers.status, 200);
  assert.ok(adminUsers.body.data.every((user) => user.role === 'teacher' && !Object.hasOwn(user, 'passwordHash')));
  result = await request('/api/users', { token: adminToken, method: 'POST', body: { name: 'Managed Teacher', email: `managed-${testCategory}@example.test`, password: 'temporary-pass-92', role: 'teacher' } });
  assert.equal(result.status, 201);
  assert.equal(result.body.user.role, 'teacher');
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  assert.equal((await request(`/api/users/${result.body.user._id}`, { token: adminToken })).status, 200);
  assert.equal((await request(`/api/users/${result.body.user._id}`, { token: studentToken })).status, 403);
  result = await request(`/api/users/${result.body.user._id}`, { token: adminToken, method: 'PATCH', body: { role: 'student' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.role, 'student');
  assert.equal((await request(`/api/users/${result.body.user._id}`, { token: adminToken, method: 'PATCH', body: { role: 'instructor' } })).status, 400);
  assert.equal((await request(`/api/users/${result.body.user._id}`, { token: adminToken, method: 'DELETE' })).status, 200);
  result = await request('/api/analytics/enrollments-per-course', { token: instructorToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 2);
  assert.equal(result.body.data.find((item) => item.title === course.title).enrollmentCount, 1);

  result = await request('/api/analytics/courses-per-instructor', { token: adminToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.find((item) => item.email === instructor.email).courseCount, 2);
  assert.equal(result.body.data.find((item) => item.email === otherInstructor.email).courseCount, 1);
  result = await request('/api/analytics/courses-per-instructor', { token: instructorToken });
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].email, instructor.email);

  result = await request('/api/analytics/average-progress-per-course', { token: instructorToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.find((item) => item.title === course.title).averageProgress, 40);
  assert.equal(result.body.data.find((item) => item.title === secondCourse.title).averageProgress ?? null, null);

  result = await request('/api/analytics/courses-by-category', { token: instructorToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.find((item) => item.category === testCategory).courseCount, 2);

  result = await request(`/api/courses/${course.id}`, { method: 'DELETE', token: instructorToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.deleted.lessons, 1);
  assert.equal(result.body.deleted.enrollments, 1);
  assert.equal(await Lesson.exists({ _id: cascadeLesson._id }), null);
  assert.equal(await Enrollment.exists({ _id: enrollment }), null);
  course = null;

  result = await request(`/api/courses/${secondCourse.id}`, { method: 'DELETE' });
  assert.equal(result.status, 401);
  result = await request(`/api/courses/${secondCourse.id}`, { method: 'DELETE', token: adminToken });
  assert.equal(result.status, 200);
  secondCourse = null;
  assert.equal((await request('/not-a-route')).status, 404);
});
