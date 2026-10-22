const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['student', 'personnel', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never returned by default in queries
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      default: 'student',
    },

    // --- Student-specific fields ---
    regNumber: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },

    // --- Personnel-specific fields ---
    officeName: {
      type: String,
      trim: true,
      // e.g. "Library", "Bursary", "Hostel", "Head of Department", "Sports Office", "Faculty Dean", "Director of Health", etc.
    },

    // Where this personnel sits in the approval sequence:
    //   1 = Head of Department (must approve first)
    //   2 = every other office (act in any order, once HOD has approved)
    //   3 = Bursary (must be last)
    // Auto-derived from officeName below; only meaningful when role === 'personnel'.
    stage: {
      type: Number,
      enum: [1, 2, 3]
    },

    // Personnel status - used when office personnel changes
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    department: {
      type: String,
      trim: true,
      default: 'Software Engineering',
    },
  },
  { timestamps: true }
);

function stageFromOfficeName(officeName) {
  if (!officeName) return 2;
  const normalized = officeName.trim().toLowerCase();
  if (normalized.includes('head of department') || normalized === 'hod') return 1;
  if (normalized.includes('bursary')) return 3;
  return 2;
}

// Keep stage in sync with officeName whenever either is set/changed
userSchema.pre('save', function deriveStage() {
  if (this.role === 'personnel' && (this.isModified('officeName') || this.isNew)) {
    this.stage = stageFromOfficeName(this.officeName);
  }
});

// Hash password before saving, only if it was modified
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;