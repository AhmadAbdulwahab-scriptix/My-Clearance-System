const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const Certificate = require('../models/Certificate');

/**
 * GET /api/certificates/verify/:code
 * PUBLIC (no login needed). Lets anyone who scans the QR code check that a
 * certificate is genuine, and shows only the minimum details.
 */
const verifyCertificate = asyncHandler(async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();

  // Our codes look like CLR-1792256453780-A1B2C3. Reject anything else early,
  // with the same message as "not found" so nothing is revealed.
    if (!/^CLR-\d+-[A-F0-9]{6,}$/.test(code)) {
        throw ApiError.notFound('Certificate not found');
    }

    const certificate = await Certificate.findOne({ certificateCode: code }).populate(
        'student',
        'name regNumber department'
    );

    if (!certificate || !certificate.student) {
        throw ApiError.notFound('Certificate not found');
    }

    // Send only what a verifier needs: no email, no office details.
    sendSuccess(res, 200, 'Certificate is valid', {
        valid: true,
        certificateCode: certificate.certificateCode,
        issuedAt: certificate.issuedAt,
        student: {
        name: certificate.student.name,
        regNumber: certificate.student.regNumber,
        department: certificate.student.department,
        },
    });
});

module.exports = { verifyCertificate };