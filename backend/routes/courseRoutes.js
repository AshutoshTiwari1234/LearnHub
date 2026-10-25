const express = require('express');
const controller = require('../controllers/courseController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(authenticate, authorize('teacher', 'admin'), controller.createCourse).get(controller.listCourses);
router.route('/:id')
  .get(controller.getCourse)
  .put(authenticate, authorize('teacher', 'admin'), controller.updateCourse)
  .delete(authenticate, authorize('teacher', 'admin'), controller.deleteCourse);

module.exports = router;
