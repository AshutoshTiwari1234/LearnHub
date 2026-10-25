const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Add it to backend/.env before starting the server.');
  }

  const connection = await mongoose.connect(mongoUri, {
    dbName: 'learnhub',
  });

  console.log(`MongoDB connected: ${connection.connection.host}/${connection.connection.name}`);
  return connection;
}

module.exports = connectDB;
