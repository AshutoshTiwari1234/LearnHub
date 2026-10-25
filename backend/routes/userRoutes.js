const express = require('express');
const controller = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate, authorize('admin'));
router.post('/teachers', controller.createTeacher);
router.route('/').get(controller.listUsers).post(controller.createUser);
router.route('/:id').get(controller.getUser).patch(controller.updateUser).delete(controller.deleteUser);
module.exports = router;
