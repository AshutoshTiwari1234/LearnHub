const { it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { verifyPassword } = require('../utils/passwords');
const { seedDatabase } = require('../scripts/seed');

function memoryModel() {
  const rows = [];
  return {
    rows,
    async findOne(filter) {
      return rows.find((row) => Object.entries(filter).every(([key, value]) => {
        const actual = row[key];
        return actual && value && typeof actual.toString === 'function'
          ? actual.toString() === value.toString()
          : actual === value;
      })) || null;
    },
    async create(values) {
      const duplicate = rows.some((row) => Object.entries(values).some(([key, value]) => {
        if (key !== 'email' && key !== 'title') return false;
        return row[key] === value;
      }));
      if (duplicate) {
        const error = new Error('Duplicate key');
        error.code = 11000;
        throw error;
      }
      const row = { ...values, _id: new mongoose.Types.ObjectId() };
      rows.push(row);
      return row;
    },
  };
}

it('seeds realistic linked data insert-only, hashes passwords, and skips existing records on rerun', async () => {
  const models = {
    User: memoryModel(),
    Course: memoryModel(),
    Lesson: memoryModel(),
    Enrollment: memoryModel(),
  };
  const password = 'temporary-seed-pass-92';

  await assert.rejects(seedDatabase('short', models), /8–72 UTF-8 bytes/);
  const firstRun = await seedDatabase(password, models);
  assert.deepEqual(firstRun, {
    users: { inserted: 6, skipped: 0 },
    courses: { inserted: 4, skipped: 0 },
    lessons: { inserted: 10, skipped: 0 },
    enrollments: { inserted: 6, skipped: 0 },
  });
  assert.ok(models.User.rows.every((user) => user.passwordHash.startsWith('$2')));
  assert.equal(new Set(models.User.rows.map((user) => user.passwordHash)).size, 6);
  assert.equal(await verifyPassword(password, models.User.rows[0].passwordHash), true);
  assert.equal(models.Enrollment.rows.every((item) => models.User.rows.some((user) => user._id.equals(item.student))), true);
  assert.equal(models.Enrollment.rows.every((item) => models.Course.rows.some((course) => course._id.equals(item.course))), true);

  const hashesBeforeRerun = models.User.rows.map((user) => user.passwordHash);
  const secondRun = await seedDatabase('a-different-password-38', models);
  assert.deepEqual(secondRun, {
    users: { inserted: 0, skipped: 6 },
    courses: { inserted: 0, skipped: 4 },
    lessons: { inserted: 0, skipped: 10 },
    enrollments: { inserted: 0, skipped: 6 },
  });
  assert.deepEqual(models.User.rows.map((user) => user.passwordHash), hashesBeforeRerun);
});
