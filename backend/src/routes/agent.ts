import { Router, Request, Response } from 'express';
import {
  deployIdleFunds,
  harvestYield,
  processEmergencyLoan,
  getAgentStatus,
} from '../services/agentEngine';
import User from '../models/User';
import mongoose from 'mongoose';
import { protect, authorize } from '../middleware/auth';
import { getDeFiRuntime, getDeFiAdapter } from '../services/defiAdapter';

const router = Router();

// GET /api/agent/status — full agent state
router.get('/status', protect, authorize('leader', 'bank'), (_req: Request, res: Response) => {
  res.json({ success: true, data: getAgentStatus() });
});

// GET /api/agent/log — recent agent activity log
router.get('/log', protect, authorize('leader', 'bank'), (_req: Request, res: Response) => {
  const status = getAgentStatus();
  res.json({ success: true, data: status.agentLog.slice(0, 20) });
});

// GET /api/agent/vaults — investment pool positions only
router.get('/vaults', protect, authorize('leader', 'bank'), (_req: Request, res: Response) => {
  const status = getAgentStatus();
  const runtime = getDeFiRuntime();
  const adapter = getDeFiAdapter();
  res.json({
    success: true,
    data: {
      positions: status.vaultPositions,
      totalAUM: status.totalVaultAUM,
      pendingYield: status.pendingYield,
      averageAPY: Math.round(status.averageAPY * 10) / 10,
      idleFunds: status.idleFunds,
      totalYieldHarvested: status.totalYieldHarvested,
      runtime: {
        ...runtime,
        activeProvider: adapter.provider,
        activeMode: adapter.mode,
      },
    },
  });
});

// POST /api/agent/invest — trigger idle fund deployment
router.post('/invest', protect, authorize('leader'), async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const status = getAgentStatus();

    if (status.idleFunds < 1000) {
      res.status(400).json({
        success: false,
        error: 'Insufficient idle funds to deploy (minimum ₹1,000)',
      });
      return;
    }

    const deployAmount = amount ? Math.min(amount, status.idleFunds) : status.idleFunds;
    const result = await deployIdleFunds(deployAmount);

    console.log(`[Agent] Deployed ₹${deployAmount.toLocaleString('en-IN')} to ${result.vault.protocol}`);

    res.json({
      success: true,
      data: {
        vault: result.vault,
        logEntry: result.logEntry,
        newIdleFunds: result.newIdleFunds,
        message: `🤖 Agent deployed ₹${deployAmount.toLocaleString('en-IN')} to ${result.vault.protocol} at ${result.vault.apy}% APY`,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to deploy idle funds',
    });
  }
});

// POST /api/agent/harvest — harvest accumulated yield
router.post('/harvest', protect, authorize('leader'), async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.body;
    const result = await harvestYield(vaultId);

    console.log(`[Agent] Harvested ₹${result.harvested.toLocaleString('en-IN')} yield`);

    res.json({
      success: true,
      data: {
        harvested: result.harvested,
        logEntry: result.logEntry,
        newIdleFunds: getAgentStatus().idleFunds,
        message: `✅ Harvested ₹${result.harvested.toLocaleString('en-IN')} yield. Added to treasury.`,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to harvest yield',
    });
  }
});

// POST /api/agent/emergency-loan — agentic emergency loan flow
router.post('/emergency-loan', protect, authorize('leader', 'member'), async (req: Request, res: Response) => {
  const { memberId, amount, purpose = 'emergency medical' } = req.body;

  if (!amount) {
    res.status(400).json({ success: false, error: 'amount is required' });
    return;
  }

  let memberName = 'SHG Member';
  let trustScore = 750;
  let resolvedMemberId = memberId;

  if (memberId && mongoose.Types.ObjectId.isValid(memberId)) {
    const dbMember = await User.findById(memberId).select('name trustScore');
    if (dbMember) {
      memberName = dbMember.name;
      trustScore = dbMember.trustScore || trustScore;
      resolvedMemberId = String(dbMember._id);
    }
  }

  if (!resolvedMemberId) {
    const firstMember = await User.findOne({ role: 'member' }).sort({ createdAt: 1 }).select('_id name trustScore');
    if (firstMember) {
      resolvedMemberId = String(firstMember._id);
      memberName = firstMember.name;
      trustScore = firstMember.trustScore || trustScore;
    }
  }

  const result = await processEmergencyLoan({
    memberId: resolvedMemberId || 'unknown-member',
    memberName,
    trustScore,
    amount,
    purpose,
  });

  const statusCode = result.approved ? 201 : 202;
  res.status(statusCode).json({
    success: true,
    data: {
      ...result,
      memberName,
      trustScore,
      signaturesRequired: result.threshold,
      message: result.autoApproved
        ? `🚨 EMERGENCY LOAN DISBURSED in <3s — ₹${amount.toLocaleString('en-IN')} sent to ${memberName}`
        : `📋 Loan queued for ${result.threshold}-of-3 approval`,
    },
  });
});

// GET /api/agent/repayments — auto-repayment schedules
router.get('/repayments', protect, (_req: Request, res: Response) => {
  res.json({ success: true, data: getAgentStatus().autoRepayments });
});

export default router;
