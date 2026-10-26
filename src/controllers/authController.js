const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailClient = require('../utils/emailClient');
const { passwordResetTemplate } = require('../templates/emailTemplates');
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

// Password reset time
const RESET_MINUTES = 30;

// Only the SHA-256 hash of the token is stored, so a copy of the database
// cannot be used to reset anybody's password.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Emails a reset link. The answer is always the same, whether or not the
 * email exists, so nobody can use this to find out who has an account.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) {
    throw ApiError.badRequest('email is required');
  }

  const user = await User.findOne({ email });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // The link points at the reset page of this same website.
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const base = (process.env.FRONTEND_URL || `${protocol}://${req.get('host')}`).replace(/\/$/, '');
    const resetUrl = `${base}/reset-password.html?token=${token}`;

    // Not awaited on purpose: the reply is as fast for an unknown email as for
    // a known one, so response time gives nothing away either.
    emailClient
      .sendEmail(
        user.email,
        'Reset your clearance system password',
        `Use this link to choose a new password (valid for ${RESET_MINUTES} minutes): ${resetUrl}`,
        passwordResetTemplate({ name: user.name, resetUrl, minutes: RESET_MINUTES })
      )
      .then((sent) => {
        if (!sent) {
          // No email service is set up (or it failed). For a test project the
          // link can be taken from the server log.
          logger.warn(`Password reset email NOT sent to ${user.email}. Reset link: ${resetUrl}`);
        }
      });
  }

  sendSuccess(res, 200, 'If an account with that email exists, a reset link has been sent.');
});

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw ApiError.badRequest('token and password are required');
  }
  if (String(password).length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters');
  }

  const user = await User.findOne({
    passwordResetToken: hashToken(String(token)),
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  user.password = password; // hashed by the model's pre-save hook
  user.passwordResetToken = undefined; // one use only
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date(); // lets protect() reject older login tokens
  await user.save();

  logger.info(`Password reset completed for ${user.email}`);
  sendSuccess(res, 200, 'Password changed. You can now sign in.');
});

module.exports = { register, login, getMe, forgotPassword, resetPassword };
