const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - the file data
 * @param {string} fileName - original file name
 * @param {string} folder - cloudinary folder path (e.g., 'clearance/resubmissions')
 * @returns {Promise<Object>} { public_id, secure_url, format, bytes }
 */
async function uploadFile(fileBuffer, fileName, folder = 'clearance/resubmissions') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: `${Date.now()}-${fileName.replace(/[^a-z0-9.-]/gi, '')}`,
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed', error);
          reject(error);
        } else {
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            originalFileName: fileName,
            uploadedAt: new Date(),
          });
        }
      }
    );

    stream.end(fileBuffer);
  });
}

/**
 * Delete a file from Cloudinary
 * @param {string} public_id - the cloudinary public_id
 * @returns {Promise<void>}
 */
async function deleteFile(public_id) {
  try {
    await cloudinary.uploader.destroy(public_id);
    logger.info('Cloudinary file deleted', { public_id });
  } catch (error) {
    logger.warn('Cloudinary delete failed (non-blocking)', { public_id, error: error.message });
  }
}

module.exports = {
  uploadFile,
  deleteFile,
};
