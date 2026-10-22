const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);  // /api/auth/register
router.post('/login', login);  // /api/auth/login
router.get('/me', protect, getMe); // /api/auth/me

module.exports = router;
