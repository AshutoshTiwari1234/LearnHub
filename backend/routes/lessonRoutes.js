const express = require('express');
const controller = require('../controllers/lessonController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/course/:courseId', authenticate, authorize('student', 'teacher', 'admin'), controller.listLessonsByCourse);
router.route('/').post(authenticate, authorize('teacher', 'admin'), controller.createLesson);
router.route('/:id')
  .get(authenticate, authorize('student', 'teacher', 'admin'), controller.getLesson)
  .put(authenticate, authorize('teacher', 'admin'), controller.updateLesson)
  .delete(authenticate, authorize('teacher', 'admin'), controller.deleteLesson);

module.exports = router;
