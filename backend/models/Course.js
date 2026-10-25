const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [3, 'Course title must be at least 3 characters'],
      maxlength: [200, 'Course title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
      trim: true,
      maxlength: [5000, 'Course description cannot exceed 5000 characters'],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Instructor is required'],
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Course category is required'],
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters'],
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

courseSchema.index({ status: 1, category: 1 });
courseSchema.index({ instructor: 1, status: 1, createdAt: -1 });
courseSchema.index({ title: 'text', description: 'text', category: 'text' }, {
  weights: { title: 5, category: 3, description: 1 },
  name: 'course_text_search',
});

module.exports = mongoose.model('Course', courseSchema);
