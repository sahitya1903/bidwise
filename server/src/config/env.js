// Reads settings from .env once, with safe defaults for local development and tests.
require('dotenv').config({ quiet: true });

const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/auction',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  closerIntervalMs: Number(process.env.CLOSER_INTERVAL_MS) || 15000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

module.exports = env;
