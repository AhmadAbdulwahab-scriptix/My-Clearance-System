const express = require('express');

const { verifyCertificate } = require('../controllers/certificateController');
const rateLimit = require('../middlewares/rateLimiter.js');

const router = express.Router();

// At most 30 checks per IP address every 10 minutes.
const verifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });

// PUBLIC route: there is no protect/authorize here on purpose,
// because people who scan the QR code do not have an account.
router.get('/verify/:code', verifyLimiter, verifyCertificate); // /api/certificates/verify/:code

module.exports = router;