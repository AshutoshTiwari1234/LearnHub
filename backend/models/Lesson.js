const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
      minlength: [1, 'Lesson title cannot be empty'],
      maxlength: [200, 'Lesson title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [50000, 'Lesson content cannot exceed 50000 characters'],
    },
    resourceUrl: {
      type: String,
      trim: true,
      maxlength: [2048, 'Resource URL cannot exceed 2048 characters'],
      validate: {
        validator: (value) => !value || /^https?:\/\//i.test(value),
        message: 'Resource URL must start with http:// or https://',
      },
    },
    lessonOrder: {
      type: Number,
      required: [true, 'Lesson order is required'],
      min: [1, 'Lesson order must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Lesson order must be a whole number',
      },
    },
  },
  { timestamps: true },
);

lessonSchema.pre('validate', function validateLessonContent() {
  if (!this.content && !this.resourceUrl) {
    this.invalidate('content', 'Provide lesson content or a resource URL');
    this.invalidate('resourceUrl', 'Provide lesson content or a resource URL');
  }
});

lessonSchema.index({ course: 1, lessonOrder: 1 }, { unique: true });

module.exports = mongoose.model('Lesson', lessonSchema);
