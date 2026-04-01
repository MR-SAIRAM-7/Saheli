import { Router, Request, Response } from 'express';
import User from '../models/User';
import Transaction from '../models/Transaction';
import { executeOnChainRecord } from '../services/txEngine';
import { protect, authorize } from '../middleware/auth';

const router = Router();

async function getTreasurySnapshot() {
  const [memberCount, txTotals, trustAgg] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    Transaction.aggregate([
      { $match: { status: { $ne: 'failed' } } },
      {
        $group: {
          _id: null,
          totalSavingsInflow: {
            $sum: {
              $cond: [{ $in: ['$type', ['deposit', 'yield', 'loan_repayment']] }, '$amount', 0],
            },
          },
          totalOutflow: {
            $sum: {
              $cond: [{ $in: ['$type', ['withdrawal', 'loan_disbursement']] }, '$amount', 0],
            },
          },
          monthlyYield: {
            $sum: {
              $cond: [{ $eq: ['$type', 'yield'] }, '$amount', 0],
            },
          },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: 'member' } },
      { $group: { _id: null, avgTrustScore: { $avg: '$trustScore' } } },
    ]),
  ]);

  const inflow = txTotals[0]?.totalSavingsInflow || 0;
  const outflow = txTotals[0]?.totalOutflow || 0;
  const trustScore = Math.round(trustAgg[0]?.avgTrustScore || 0);

  return {
    totalLiquidity: Math.max(0, inflow - outflow),
    yieldThisMonth: Number(((txTotals[0]?.monthlyYield || 0) / 10000).toFixed(2)),
    trustScore,
    trustScoreValue: Math.min(100, Math.round((trustScore / 1000) * 100)),
    activeMembers: memberCount,
    totalMembers: memberCount,
  };
}

// GET /api/stats/treasury
router.get('/treasury', protect, authorize('leader', 'bank'), async (_req: Request, res: Response) => {
  const treasury = await getTreasurySnapshot();
  res.json({ success: true, data: treasury });
});

// GET /api/stats/institutional
router.get('/institutional', protect, authorize('bank'), async (_req: Request, res: Response) => {
  const [memberCount, grantTxCount, treasury, repaymentAgg] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    Transaction.countDocuments({
      status: { $ne: 'failed' },
      'metadata.source': 'stats.grants.approve',
    }),
    getTreasurySnapshot(),
    User.aggregate([
      { $match: { role: 'member' } },
      { $group: { _id: null, avgRepaymentRate: { $avg: '$repaymentRate' } } },
    ]),
  ]);

  const repaymentRate = Math.round(repaymentAgg[0]?.avgRepaymentRate || 0);

  res.json({
    success: true,
    data: {
      registeredSHGs: memberCount > 0 ? Math.max(1, Math.ceil(memberCount / 25)) : 0,
      activeGrants: grantTxCount,
      regionalLiquidity: treasury.totalLiquidity,
      trustIndex: treasury.trustScore,
      verifiedMembers: memberCount,
      repaymentRate,
      lockedLiquidity: treasury.totalLiquidity,
      auditFrequency: 'Real-time',
      aggregateTrustIndex: treasury.trustScoreValue,
      shgsMonitored: memberCount > 0 ? Math.max(1, Math.ceil(memberCount / 25)) : 0,
    },
  });
});

// GET /api/stats/shg-directory
router.get('/shg-directory', protect, authorize('bank'), async (_req: Request, res: Response) => {
  const groups = await User.aggregate([
    { $match: { role: 'member' } },
    {
      $group: {
        _id: { $ifNull: ['$shgId', 'unassigned'] },
        memberCount: { $sum: 1 },
        avgTrustScore: { $avg: '$trustScore' },
        totalLiquidity: { $sum: '$totalSavings' },
        activeLoansAmount: { $sum: '$activeLoansAmount' },
      },
    },
    { $sort: { memberCount: -1 } },
  ]);

  const formatted = groups.map((g: any) => ({
    id: g._id,
    name: `SHG ${String(g._id).toUpperCase()}`,
    registrationId: `SHG-${String(g._id).toUpperCase()}`,
    trustScore: Math.round(g.avgTrustScore || 0),
    memberCount: g.memberCount,
    activeLoans: `₹${Math.round(g.activeLoansAmount || 0).toLocaleString('en-IN')}`,
    totalLiquidity: Math.round(g.totalLiquidity || 0),
    yieldThisMonth: 0,
    auditStatus: 'IMMUTABLE_OK',
    region: 'India',
  }));

  res.json({ success: true, data: formatted });
});

// GET /api/stats/ledger
router.get('/ledger', protect, authorize('leader', 'bank'), async (_req: Request, res: Response) => {
  const txs = await Transaction.find({ status: { $ne: 'failed' } })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const ledger = txs.map((tx: any) => ({
    id: String(tx._id),
    event: tx.metadata?.source === 'stats.grants.approve'
      ? `grant_disbursement: ${tx.user?.name || 'Member'}`
      : `${tx.type}: ${tx.user?.name || 'Member'}`,
    txId: tx.transactionId ? `${tx.transactionId.slice(0, 12)}...` : `TX-${String(tx._id).slice(-6)}`,
    amount: ['deposit', 'yield', 'loan_repayment'].includes(tx.type) ? tx.amount : -Math.abs(tx.amount),
    type: ['deposit', 'yield', 'loan_repayment'].includes(tx.type) ? 'credit' : 'debit',
    category: tx.metadata?.source === 'stats.grants.approve' ? 'grant' : 'general',
    description: tx.description,
    timestamp: tx.createdAt,
  }));

  res.json({ success: true, data: ledger });
});

// POST /api/stats/grants/approve
router.post('/grants/approve', protect, authorize('bank'), async (_req: Request, res: Response) => {
  const amount = 75000;
  const member = await User.findOne({ role: 'member' }).sort({ createdAt: 1 });

  if (!member) {
    res.status(400).json({ success: false, error: 'No member available to record grant disbursement' });
    return;
  }

  const chain = await executeOnChainRecord({
    type: 'grant_disbursement',
    amount,
    description: 'Institutional grant approved and disbursed',
    memberId: String(member._id),
    memberName: member.name,
    memberWalletAddress: member.walletAddress,
    recipientWalletAddress: member.walletAddress,
    metadata: {
      source: 'stats.grants.approve',
    },
    forceValueTransfer: true,
  });

  await Transaction.create({
    user: member._id,
    type: 'deposit',
    amount,
    description: 'Institutional grant approved and disbursed',
    transactionId: chain.transactionId,
    status: 'confirmed',
    agentProcessed: false,
    walletAddress: member.walletAddress,
    algorandRound: chain.confirmedRound,
    algorandExplorerUrl: chain.explorerUrl,
    algorandNetwork: chain.network,
    metadata: {
      source: 'stats.grants.approve',
    },
  });

  member.totalSavings = (member.totalSavings || 0) + amount;
  await member.save();

  const treasury = await getTreasurySnapshot();

  res.json({
    success: true,
    data: {
      amount,
      activeGrants: await Transaction.countDocuments({ description: 'Institutional grant approved and disbursed' }),
      regionalLiquidity: treasury.totalLiquidity,
      message: `Grant of ₹${amount.toLocaleString('en-IN')} approved and recorded.`,
    },
  });
});

export default router;
