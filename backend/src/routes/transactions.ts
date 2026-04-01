import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { executeOnChainRecord } from '../services/txEngine';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { recalculateIdleFunds } from '../services/agentEngine';
import { protect, authorize } from '../middleware/auth';
import { refreshPassport } from '../services/passport';

const router = Router();

function mapTxForLedger(tx: any) {
  const isCredit = ['deposit', 'yield', 'loan_repayment'].includes(tx.type);
  return {
    id: String(tx._id),
    event: `${tx.type}: ${tx.user?.name || 'Member'}`,
    txId: tx.transactionId ? `${tx.transactionId.slice(0, 12)}...` : `TX-${String(tx._id).slice(-6)}`,
    amount: isCredit ? tx.amount : -Math.abs(tx.amount),
    type: isCredit ? 'credit' : 'debit',
    timestamp: tx.createdAt,
  };
}

// GET /api/transactions
router.get('/', protect, authorize('leader', 'bank'), async (_req: Request, res: Response) => {
  const txs = await Transaction.find({ status: { $ne: 'failed' } })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  const mapped = txs.map(mapTxForLedger);

  res.json({ success: true, data: mapped });
});

// POST /api/transactions (create deposit/withdrawal/yield)
router.post('/', protect, authorize('leader'), async (req: Request, res: Response) => {
  const { memberId, type, amount, description } = req.body;

  if (!memberId || !type || !amount) {
    res.status(400).json({ success: false, error: 'memberId, type, amount required' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    res.status(400).json({ success: false, error: 'memberId must be a valid Mongo ObjectId' });
    return;
  }

  const user = await User.findById(memberId);
  if (!user || user.role !== 'member') {
    res.status(404).json({ success: false, error: 'Member not found' });
    return;
  }

  const chain = await executeOnChainRecord({
    type,
    amount,
    description: description || `${type} via WhatsApp`,
    memberId: String(user._id),
    memberName: user.name,
    memberWalletAddress: user.walletAddress,
    recipientWalletAddress: user.walletAddress,
    metadata: {
      source: 'transactions.route',
      role: user.role,
    },
    forceValueTransfer: type === 'loan_disbursement' || type === 'withdrawal',
  });

  const newTx = {
    type,
    amount,
    description: description || `${type} via WhatsApp`,
    timestamp: new Date().toISOString(),
    transactionId: chain.transactionId,
    status: 'confirmed' as const,
    agentProcessed: true,
    explorerUrl: chain.explorerUrl,
  };

  await Transaction.create({
    user: user._id,
    type,
    amount,
    description: description || `${type} via WhatsApp`,
    transactionId: chain.transactionId,
    status: 'confirmed',
    agentProcessed: true,
    walletAddress: user.walletAddress,
    algorandRound: chain.confirmedRound,
    algorandExplorerUrl: chain.explorerUrl,
    algorandNetwork: chain.network,
    metadata: {
      source: 'transactions.route',
    },
  });

  if (type === 'deposit') user.totalSavings += amount;
  if (type === 'withdrawal') user.totalSavings = Math.max(0, user.totalSavings - amount);
  if (type === 'yield') user.yieldEarned = (user.yieldEarned || 0) + amount;
  await user.save();

  // Keep financial passport metadata in sync with treasury events.
  await refreshPassport(String(user._id), `transaction_${type}`);

  await recalculateIdleFunds();

  res.status(201).json({
    success: true,
    data: {
      transaction: {
        ...newTx,
        memberName: user.name,
      },
      transactionId: chain.transactionId,
      message: 'Transaction confirmed on Algorand.',
    },
  });
});

// GET /api/transactions/ledger (raw ledger stream)
router.get('/ledger', protect, authorize('leader', 'bank'), async (_req: Request, res: Response) => {
  const ledger = await Transaction.find({ status: { $ne: 'failed' } })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: ledger.map(mapTxForLedger) });
});

export default router;
