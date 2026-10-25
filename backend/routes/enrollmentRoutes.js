const express = require('express');
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/stats/courses', courseController.enrollmentCountsByCourse);
router.route('/')
  .post(authenticate, authorize('student'), enrollmentController.createEnrollment)
  .get(authenticate, authorize('student', 'teacher', 'admin'), enrollmentController.listEnrollments);
router.patch('/:id/cancel', authenticate, authorize('student', 'teacher', 'admin'), enrollmentController.cancelEnrollment);
router.route('/:id')
  .get(authenticate, authorize('student', 'teacher', 'admin'), enrollmentController.getEnrollment)
  .patch(authenticate, authorize('student', 'teacher', 'admin'), enrollmentController.updateEnrollment);

module.exports = router;
