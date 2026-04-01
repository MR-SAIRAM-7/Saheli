import { Router, Request, Response } from 'express';
import User from '../models/User';
import Transaction from '../models/Transaction';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { getPassport, mintPassport, refreshPassport } from '../services/passport';

const router = Router();

function canAccessMember(req: AuthRequest, memberId: string): boolean {
  if (!req.user) return false;
  if (req.user.role === 'leader' || req.user.role === 'bank') return true;
  return String(req.user._id) === String(memberId);
}

// GET /api/members/:id/passport
router.get('/:id/passport', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessMember(req, req.params.id)) {
      res.status(403).json({ success: false, error: 'Not authorized to view this passport' });
      return;
    }

    const passport = await getPassport(req.params.id);
    if (!passport) {
      res.json({ success: true, data: null });
      return;
    }

    res.json({ success: true, data: passport });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/members/:id/passport/mint
router.post('/:id/passport/mint', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessMember(req, req.params.id)) {
      res.status(403).json({ success: false, error: 'Not authorized to mint this passport' });
      return;
    }

    const minted = await mintPassport(req.params.id);
    res.status(201).json({
      success: true,
      data: {
        ...minted,
        message: 'd-SBT minted and passport anchored on-chain.',
      },
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/members/:id/passport/refresh
router.patch('/:id/passport/refresh', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessMember(req, req.params.id)) {
      res.status(403).json({ success: false, error: 'Not authorized to refresh this passport' });
      return;
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'manual_refresh';
    const refreshed = await refreshPassport(req.params.id, reason);
    res.json({
      success: true,
      data: {
        ...refreshed,
        message: 'Passport metadata refreshed and anchored on-chain.',
      },
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/members — Public (Leaders & Banks see all)
router.get('/', protect, authorize('leader', 'bank'), async (_req: Request, res: Response) => {
  try {
    const members = await User.find({ role: 'member' }).select('-password');
    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/members/:id — Public
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.role === 'member' && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this member profile' });
    }

    const member = await User.findById(req.params.id).select('-password');
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const transactions = await Transaction.find({ user: member._id, status: { $ne: 'failed' } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const mappedTransactions = transactions.map((tx: any) => ({
      id: String(tx._id),
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      timestamp: tx.createdAt,
      transactionId: tx.transactionId,
      txHash: tx.transactionId,
      explorerUrl: tx.algorandExplorerUrl,
      network: tx.algorandNetwork,
      status: tx.status,
      agentProcessed: tx.agentProcessed,
    }));

    res.json({
      success: true,
      data: {
        ...member.toObject(),
        transactions: mappedTransactions,
      },
    });
  } catch (error: any) {
    // CastError = invalid ObjectId, fall back to mock
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/members/:id/transactions — Public
router.get('/:id/transactions', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.role === 'member' && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to view these transactions' });
    }

    const transactions = await Transaction.find({ user: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

