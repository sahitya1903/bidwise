const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { registerSchema, loginSchema, parseOrThrow } = require('../utils/validation');

// Fewer hashing rounds in tests keeps the suite fast; production uses 10.
const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

// FR-01
async function register(input) {
  const { name, email, password } = parseOrThrow(registerSchema, input);
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    // Two sign-ups with the same email at once: the unique index catches the second.
    if (err.code === 11000) throw new AppError(409, 'EMAIL_TAKEN');
    throw err;
  }
  return { user, token: signToken(user) };
}

// FR-02
async function login(input) {
  const { email, password } = parseOrThrow(loginSchema, input);
  const user = await User.findOne({ email });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS');
  return { user, token: signToken(user) };
}

// Returns the user the token belongs to, or throws 401.
async function verifyToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError(401, 'INVALID_TOKEN');
  }
  if (!mongoose.isValidObjectId(payload.sub)) throw new AppError(401, 'INVALID_TOKEN');
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'INVALID_TOKEN');
  return user;
}

async function listUsers() {
  return User.find().sort({ createdAt: -1 });
}

module.exports = { register, login, verifyToken, listUsers, signToken };
