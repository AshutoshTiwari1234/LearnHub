require('dotenv').config();

const mongoose = require('mongoose');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const connectDB = require('../config/db');
const User = require('../models/User');
const { hashPassword, isValidPasswordLength } = require('../utils/passwords');

function promptSecret(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive PowerShell or terminal window.'));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Admin setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= ' ') value += character;
      }
    };
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function promptAdminDetails() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  let name;
  let email;
  try {
    name = await prompt.question('Admin name: ');
    email = await prompt.question('Admin email: ');
  } finally {
    prompt.close();
  }
  const password = await promptSecret('Admin password (input hidden): ');
  const confirmation = await promptSecret('Confirm password (input hidden): ');
  if (password !== confirmation) throw new Error('Passwords did not match; no user was created.');
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

async function createFirstAdmin({ UserModel = User, prompt = promptAdminDetails } = {}) {
  if (await UserModel.exists({ role: 'admin' })) {
    throw new Error('An admin already exists; no user was changed. Use the existing login instead.');
  }
  const { name, email, password } = await prompt();
  if (typeof name !== 'string' || name.length < 2 || name.length > 100) throw new Error('Name must be between 2 and 100 characters.');
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!isValidPasswordLength(password)) throw new Error('Password must be 8–72 UTF-8 bytes.');
  if (await UserModel.exists({ email })) throw new Error('That email is already assigned to an account; no user was changed.');
  await UserModel.create({ name, email, role: 'admin', passwordHash: await hashPassword(password) });
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');
  let mongoHost;
  try {
    mongoHost = new URL(process.env.MONGO_URI).hostname;
  } catch {
    throw new Error('MONGO_URI is invalid.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(mongoHost)) {
    throw new Error('Refusing to bootstrap: MONGO_URI must point to local MongoDB.');
  }

  await connectDB();
  if (mongoose.connection.name !== 'learnhub' || !['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host)) {
    throw new Error('Refusing to bootstrap: target must be the local learnhub database.');
  }
  await createFirstAdmin();
  console.log('Initial LearnHub admin created. The password was hashed and was not displayed.');
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Admin bootstrap failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { createFirstAdmin, promptAdminDetails, promptSecret, main };
