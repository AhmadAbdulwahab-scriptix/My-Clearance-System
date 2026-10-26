const express = require('express');
const {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const rateLimit = require('../middlewares/rateLimiter');

const router = express.Router();

// At most 5 reset emails per IP address every 15 minutes, and 10 reset attempts.
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/register', register); // /api/auth/register
router.post('/login', login); // /api/auth/login
router.get('/me', protect, getMe); // /api/auth/me
router.post('/forgot-password', forgotLimiter, forgotPassword); // /api/auth/forgot-password
router.post('/reset-password', resetLimiter, resetPassword); // /api/auth/reset-password

module.exports = router;