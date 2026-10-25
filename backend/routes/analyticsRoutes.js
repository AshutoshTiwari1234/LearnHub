const express = require('express');
const controller = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate, authorize('teacher', 'admin'));

router.get('/enrollments-per-course', controller.enrollmentsPerCourse);
router.get('/courses-per-instructor', controller.coursesPerInstructor);
router.get('/average-progress-per-course', controller.averageProgressPerCourse);
router.get('/courses-by-category', controller.coursesByCategory);
router.get('/platform-stats', authorize('admin'), controller.platformStats);

module.exports = router;
