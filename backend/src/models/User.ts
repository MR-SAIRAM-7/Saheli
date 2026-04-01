import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String },
    walletAddress: { type: String, index: true, sparse: true, unique: true },
    peraConnectedAt: { type: Date },
    sbtAssetId: { type: Number },
    passportMetadata: { type: mongoose.Schema.Types.Mixed },
    passportVersion: { type: Number, default: 0 },
    passportMintedAt: { type: Date },
    passportUpdatedAt: { type: Date },
    role: { type: String, enum: ['member', 'leader', 'bank'], default: 'member' },
    shgId: { type: String },
    
    // Stats (from previous mock data compatibility)
    trustScore: { type: Number, default: 750 },
    trustGrade: { type: String, default: 'GOOD' },
    totalSavings: { type: Number, default: 0 },
    activeLoans: { type: Number, default: 0 },
    activeLoansAmount: { type: Number, default: 0 },
    yieldEarned: { type: Number, default: 0 },
    repaymentRate: { type: Number, default: 100 },
    badges: [{ type: String }],
  },
  { timestamps: true }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword: string) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
