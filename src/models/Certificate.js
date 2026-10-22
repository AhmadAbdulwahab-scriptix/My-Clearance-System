const mongoose = require('mongoose');
const crypto = require('crypto');

const certificateSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClearanceRequest',
      required: true,
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    certificateCode: {
      type: String,
      required: true,
      unique: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

certificateSchema.statics.generateCode = function generateCode() {
  return `CLR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

module.exports = mongoose.model('Certificate', certificateSchema);
