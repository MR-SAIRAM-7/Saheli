import crypto from 'crypto';
import User from '../models/User';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import { executeOnChainRecord } from './txEngine';

export interface PassportMetadata {
  version: number;
  score: number;
  grade: string;
  repaymentRate: number;
  savingsDiscipline: number;
  activeLoanRisk: number;
  badges: string[];
  visualTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  mintedAt: string;
  lastUpdatedAt: string;
  lastAnchorTxId?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gradeFromScore(score: number): string {
  if (score >= 900) return 'PLATINUM';
  if (score >= 820) return 'EXCELLENT';
  if (score >= 740) return 'GOOD';
  if (score >= 650) return 'STABLE';
  return 'BUILDING';
}

function visualTierFromScore(score: number): PassportMetadata['visualTier'] {
  if (score >= 900) return 'platinum';
  if (score >= 820) return 'gold';
  if (score >= 740) return 'silver';
  return 'bronze';
}

function buildBadges(args: { score: number; repaymentRate: number; savingsDiscipline: number; activeLoanRisk: number }) {
  const badges: string[] = [];
  if (args.repaymentRate >= 98) badges.push('On-Time Champion');
  if (args.savingsDiscipline >= 75) badges.push('Consistent Saver');
  if (args.score >= 850) badges.push('Trusted Borrower');
  if (args.activeLoanRisk <= 30) badges.push('Low Risk');
  return badges.length > 0 ? badges : ['New Member'];
}

async function computePassportSignals(memberId: string) {
  const user = await User.findById(memberId).lean();
  const [txSummary, recentDeposits, activeLoans] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: user?._id || memberId, status: { $ne: 'failed' } } },
      {
        $group: {
          _id: null,
          deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, 1, 0] } },
          repayments: { $sum: { $cond: [{ $eq: ['$type', 'loan_repayment'] }, 1, 0] } },
          withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, 1, 0] } },
        },
      },
    ]),
    Transaction.countDocuments({
      user: memberId,
      type: 'deposit',
      status: { $ne: 'failed' },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    }),
    Loan.countDocuments({ user: memberId, status: { $in: ['pending', 'bank_pending', 'repaying'] } }),
  ]);

  if (!user) {
    throw new Error('Member not found');
  }

  const tx = txSummary[0] || { deposits: 0, repayments: 0, withdrawals: 0 };
  const baseTrust = Number(user.trustScore || 700);
  const repaymentRate = clamp(Number(user.repaymentRate || 0), 0, 100);
  const savingsDiscipline = clamp(Math.round((recentDeposits / 12) * 100), 0, 100);
  const activeLoanRisk = clamp(activeLoans * 18 + (tx.withdrawals > tx.deposits ? 20 : 0), 0, 100);

  const score = clamp(
    Math.round(
      baseTrust * 0.45 +
      repaymentRate * 4.2 +
      savingsDiscipline * 2.2 -
      activeLoanRisk * 1.8,
    ),
    300,
    980,
  );

  return {
    user,
    score,
    repaymentRate,
    savingsDiscipline,
    activeLoanRisk,
  };
}

function deriveAssetId(memberId: string): number {
  const hash = crypto.createHash('sha256').update(`passport:${memberId}`).digest('hex');
  return Number.parseInt(hash.slice(0, 8), 16);
}

async function buildMetadata(memberId: string, currentVersion = 0, mintedAt?: Date, reason = 'refresh') {
  const { user, score, repaymentRate, savingsDiscipline, activeLoanRisk } = await computePassportSignals(memberId);

  const now = new Date();
  const metadata: PassportMetadata = {
    version: currentVersion + 1,
    score,
    grade: gradeFromScore(score),
    repaymentRate,
    savingsDiscipline,
    activeLoanRisk,
    badges: buildBadges({ score, repaymentRate, savingsDiscipline, activeLoanRisk }),
    visualTier: visualTierFromScore(score),
    mintedAt: (mintedAt || now).toISOString(),
    lastUpdatedAt: now.toISOString(),
  };

  const chain = await executeOnChainRecord({
    type: 'agent_action',
    amount: 0,
    description: `d-SBT passport ${reason}`,
    memberId: String(user._id),
    memberName: user.name,
    memberWalletAddress: user.walletAddress,
    recipientWalletAddress: user.walletAddress,
    metadata: {
      source: 'passport.lifecycle',
      reason,
      passportVersion: metadata.version,
      score: metadata.score,
      grade: metadata.grade,
      tier: metadata.visualTier,
    },
    forceValueTransfer: false,
  });

  metadata.lastAnchorTxId = chain.transactionId;
  return metadata;
}

export async function mintPassport(memberId: string) {
  const user = await User.findById(memberId);
  if (!user || user.role !== 'member') {
    throw new Error('Member not found');
  }

  if (!user.sbtAssetId) {
    user.sbtAssetId = deriveAssetId(memberId);
  }

  const metadata = await buildMetadata(memberId, 0, new Date(), 'mint');
  user.passportMetadata = metadata;
  user.passportVersion = metadata.version;
  user.passportMintedAt = new Date(metadata.mintedAt);
  user.passportUpdatedAt = new Date(metadata.lastUpdatedAt);
  user.trustScore = metadata.score;
  user.trustGrade = metadata.grade;
  user.badges = metadata.badges;
  await user.save();

  return {
    memberId: String(user._id),
    sbtAssetId: user.sbtAssetId,
    metadata,
  };
}

export async function refreshPassport(memberId: string, reason = 'manual_refresh') {
  const user = await User.findById(memberId);
  if (!user || user.role !== 'member') {
    throw new Error('Member not found');
  }

  if (!user.sbtAssetId) {
    return mintPassport(memberId);
  }

  const currentVersion = Number(user.passportVersion || (user.passportMetadata as any)?.version || 0);
  const mintedAt = user.passportMintedAt || user.createdAt;
  const metadata = await buildMetadata(memberId, currentVersion, mintedAt, reason);
  user.passportMetadata = metadata;
  user.passportVersion = metadata.version;
  user.passportUpdatedAt = new Date(metadata.lastUpdatedAt);
  user.trustScore = metadata.score;
  user.trustGrade = metadata.grade;
  user.badges = metadata.badges;
  await user.save();

  return {
    memberId: String(user._id),
    sbtAssetId: user.sbtAssetId,
    metadata,
  };
}

export async function getPassport(memberId: string) {
  const user = await User.findById(memberId).lean();
  if (!user || user.role !== 'member') {
    throw new Error('Member not found');
  }

  if (!user.sbtAssetId || !user.passportMetadata) {
    return null;
  }

  return {
    memberId: String(user._id),
    sbtAssetId: user.sbtAssetId,
    metadata: user.passportMetadata as PassportMetadata,
    mintedAt: user.passportMintedAt,
    updatedAt: user.passportUpdatedAt,
  };
}
