const { it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createFirstAdmin } = require('../scripts/createAdmin');
const { verifyPassword } = require('../utils/passwords');

function memoryUsers(initial = []) {
  const rows = [...initial];
  return {
    rows,
    async exists(filter) {
      return rows.some((user) => Object.entries(filter).every(([key, value]) => user[key] === value)) ? { _id: 'fixture' } : null;
    },
    async create(values) {
      const row = { ...values, _id: `user-${rows.length + 1}` };
      rows.push(row);
      return row;
    },
  };
}

it('creates the first admin with the existing bcrypt hasher and does not store a plaintext password', async () => {
  const existingStudent = { name: 'Existing Student', email: 'student@example.test', role: 'student', passwordHash: 'untouched-hash' };
  const UserModel = memoryUsers([existingStudent]);
  const password = crypto.randomBytes(18).toString('base64url');
  await createFirstAdmin({ UserModel, prompt: async () => ({ name: 'First Admin', email: 'admin@example.test', password }) });
  const admin = UserModel.rows.find((row) => row.role === 'admin');
  assert.ok(admin);
  assert.notEqual(admin.passwordHash, password);
  assert.equal(await verifyPassword(password, admin.passwordHash), true);
  assert.equal(Object.hasOwn(admin, 'password'), false);
  assert.equal(UserModel.rows[0], existingStudent);
  assert.equal(UserModel.rows.length, 2);
});

it('refuses to create or overwrite users if an admin or the requested email already exists', async () => {
  const existingAdmin = { name: 'Existing Admin', email: 'admin@example.test', role: 'admin', passwordHash: 'unchanged' };
  const UserModel = memoryUsers([existingAdmin]);
  let prompted = false;
  await assert.rejects(createFirstAdmin({ UserModel, prompt: async () => { prompted = true; return {}; } }), /admin already exists/);
  assert.equal(prompted, false);
  assert.equal(UserModel.rows.length, 1);
  assert.equal(UserModel.rows[0], existingAdmin);

  const existingStudent = { name: 'Existing Student', email: 'taken@example.test', role: 'student', passwordHash: 'unchanged' };
  const anotherCollection = memoryUsers([existingStudent]);
  await assert.rejects(createFirstAdmin({
    UserModel: anotherCollection,
    prompt: async () => ({ name: 'Admin', email: 'taken@example.test', password: crypto.randomBytes(18).toString('base64url') }),
  }), /already assigned/);
  assert.equal(anotherCollection.rows.length, 1);
  assert.equal(anotherCollection.rows[0], existingStudent);
});
