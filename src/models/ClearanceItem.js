const mongoose = require('mongoose');

const REJECTION_CATEGORIES = [
  'Missing Document',
  'Unpaid Fee',
  'Disciplinary',
  'Other',
];

const clearanceItemSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClearanceRequest',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    personnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      // 'locked'   = not yet this personnel's turn (waiting on an earlier stage)
      // 'pending'  = actionable now, waiting on this personnel
      // 'approved' / 'rejected' = resolved
      enum: ['locked', 'pending', 'approved', 'rejected'],
      default: 'pending',
    },
    // Approval sequence this item belongs to: 1 = HOD, 2 = other offices, 3 = Bursary.
    // Copied from personnel.stage at creation time.
    stage: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    rejectionCategory: {
      type: String,
      enum: [...REJECTION_CATEGORIES, null],
      default: null,
    },
    // When this item actually became actionable (status moved to 'pending').
    // The 1-week SLA clock is measured from here, not from item creation,
    // since a locked item isn't waiting on this personnel yet.
    unlockedAt: {
      type: Date,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    // How many "you're late" reminders have been sent to this personnel for
    // this item, and when the last one went out - used so the daily sweep
    // sends at most one reminder per day instead of spamming.
    reminderCount: {
      type: Number,
      default: 0,
    },
    lastReminderAt: {
      type: Date,
      default: null,
    },
    // Resubmission support - students can upload documents/explanation after rejection
    resubmissionNote: {
      type: String,
      trim: true,
      default: null,
    },
    resubmissionDocuments: [{
      name: String,
      url: String,
      uploadedAt: { type: Date, default: Date.now },
    }],
    // Track resubmission history for audit trail
    resubmissionHistory: [{
      action: { type: String, enum: ['rejected', 'resubmitted', 'unreject'] },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      timestamp: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

clearanceItemSchema.index({ personnel: 1, status: 1 });
clearanceItemSchema.index({ student: 1 });
// Prevent duplicate items â€” one personnel can only have one item per request.
// Guards against double-submissions from network retries or race conditions.
clearanceItemSchema.index({ request: 1, personnel: 1 }, { unique: true });

module.exports = mongoose.model('ClearanceItem', clearanceItemSchema);
module.exports.REJECTION_CATEGORIES = REJECTION_CATEGORIES;
