const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'clearance_pending',   // personnel: an item is now waiting on you
        'clearance_approved',  // student: an item was approved
        'clearance_rejected',  // student: an item was rejected
        'clearance_completed', // student: full clearance done, certificate issued
        'delay_reminder',      // personnel: you personally are past the 1-week SLA on an item
      ],
      required: true,
    },
    relatedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClearanceItem',
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);