const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const User = require('../models/User');
const logger = require('../utils/logger');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * POST /api/auth/register
 * Student self-registration only.
 * Personnel and admin accounts must be created by an existing admin via /api/admin/personnel.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, regNumber} = req.body;

  if (!name || !email || !password) {
    throw ApiError.badRequest('name, email, and password are required');
  }

  if (!regNumber) {
    throw ApiError.badRequest('regNumber is required for student registration');
  }

  const existing = await User.findOne({ regNumber: regNumber.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('An account with this registration number already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'student',
    regNumber: regNumber.toLowerCase(),
    department: 'Software Engineering',
  });

  logger.info(`New student registered: ${user.email}`);

  const token = signToken(user);
  sendSuccess(res, 201, 'Registration successful', { user: user.toSafeObject(), token });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw ApiError.badRequest('email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken(user);
  sendSuccess(res, 200, 'Login successful', { user: user.toSafeObject(), token });
});

/**
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, 'Current user fetched', { user: req.user.toSafeObject() });
});

module.exports = { register, login, getMe };
