import { v4 as uuidv4 } from 'uuid';
import { executeOnChainRecord, generateTxHash } from './txEngine';
import AgentStateModel from '../models/AgentState';
import Transaction from '../models/Transaction';
import { getDeFiAdapter, getDeFiRuntime } from './defiAdapter';

// ─── Agent State ─────────────────────────────────────────────────────────────

export interface VaultPosition {
  id: string;
  protocol: string;
  asset: string;
  provider?: string;
  mode?: 'simulated' | 'live';
  externalPositionId?: string;
  riskTier?: 'low' | 'medium' | 'high';
  deployed: number;
  apy: number;
  yieldAccrued: number;
  stakedAt: string;
  transactionId: string;
  status: 'active' | 'withdrawing' | 'completed';
}

export interface AutoRepayment {
  loanId: string;
  memberId: string;
  memberName: string;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDueDate: string;
  deductionSource: 'future_deposit' | 'yield_share';
  status: 'active' | 'completed' | 'defaulted';
}

export interface AgentLogEntry {
  id: string;
  tag: 'LOAN' | 'VAULT' | 'REPAY' | 'ALERT' | 'SYSTEM';
  message: string;
  detail?: string;
  amount?: number;
  transactionId?: string;
  timestamp: string;
}

export interface AgentState {
  idleFunds: number;
  totalDeployed: number;
  totalYieldHarvested: number;
  lastScanAt: string;
  vaultPositions: VaultPosition[];
  autoRepayments: AutoRepayment[];
  agentLog: AgentLogEntry[];
}

// ─── Initial State ───────────────────────────────────────────────────────────

const initialAgentState: AgentState = {
  idleFunds: 345800,
  totalDeployed: 900000,
  totalYieldHarvested: 52400,
  lastScanAt: new Date(Date.now() - 120000).toISOString(),
  vaultPositions: [
    {
      id: 'vault1',
      protocol: 'Fixed Deposit Pool',
      asset: 'INR Fixed',
      deployed: 500000,
      apy: 4.2,
      yieldAccrued: 4200,
      stakedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      transactionId: generateTxHash(),
      status: 'active',
    },
    {
      id: 'vault2',
      protocol: 'Mutual Fund Pool',
      asset: 'INR Balanced',
      deployed: 250000,
      apy: 6.8,
      yieldAccrued: 2380,
      stakedAt: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
      transactionId: generateTxHash(),
      status: 'active',
    },
    {
      id: 'vault3',
      protocol: 'Treasury Bond Pool',
      asset: 'INR Growth',
      deployed: 150000,
      apy: 5.1,
      yieldAccrued: 1020,
      stakedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
      transactionId: generateTxHash(),
      status: 'active',
    },
  ],
  autoRepayments: [
    {
      loanId: 'loan2',
      memberId: 'm2',
      memberName: 'Sita Ramaiah',
      installmentAmount: 1083,
      totalInstallments: 6,
      paidInstallments: 3,
      nextDueDate: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      deductionSource: 'future_deposit',
      status: 'active',
    },
  ],
  agentLog: [
    {
      id: 'al1',
      tag: 'VAULT',
      message: 'Deployed ₹5,00,000 → Fixed Deposit Pool (INR Fixed)',
      detail: '4.2% APY confirmed. Ref #FDP-001',
      amount: 500000,
      transactionId: generateTxHash(),
      timestamp: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    },
    {
      id: 'al2',
      tag: 'VAULT',
      message: 'Invested ₹2,50,000 → Mutual Fund Pool (INR Balanced)',
      detail: '6.8% APY. Diversified investment allocation.',
      amount: 250000,
      transactionId: generateTxHash(),
      timestamp: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
    },
    {
      id: 'al3',
      tag: 'LOAN',
      message: 'Emergency loan auto-approved for Lakshmi Devi',
      detail: 'Trust Score 850/1000 cleared. 1-of-3 threshold. ₹5,000 disbursed.',
      amount: 5000,
      transactionId: generateTxHash(),
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'al4',
      tag: 'REPAY',
      message: 'Auto-deducted ₹1,083 from Sita Ramaiah deposit',
      detail: 'Installment 3/6. Loan loan2 on track.',
      amount: 1083,
      timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    {
      id: 'al5',
      tag: 'ALERT',
      message: 'Idle funds detected: ₹3,45,800 uninvested',
      detail: 'Scanning for optimal yield opportunities...',
      amount: 345800,
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: 'al6',
      tag: 'SYSTEM',
      message: 'Agent sweep complete — 3 pools healthy',
      detail: 'Total AUM: ₹9,00,000 | Avg APY: 5.2%',
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
  ],
};

export let agentState: AgentState = JSON.parse(JSON.stringify(initialAgentState));

function cloneState(state: AgentState): AgentState {
  return JSON.parse(JSON.stringify(state));
}

async function persistAgentState(): Promise<void> {
  await AgentStateModel.findOneAndUpdate(
    { key: 'singleton' },
    { key: 'singleton', ...agentState },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function initializeAgentState(): Promise<void> {
  const existing = await AgentStateModel.findOne({ key: 'singleton' }).lean<AgentState & { key: string }>();

  if (existing) {
    const { key: _key, ...persisted } = existing;
    agentState = cloneState(persisted as AgentState);
    return;
  }

  agentState = cloneState(initialAgentState);
  await persistAgentState();
}

export async function recalculateIdleFunds(): Promise<number> {
  const inflowTypes = ['deposit', 'yield', 'loan_repayment'];
  const outflowTypes = ['withdrawal', 'loan_disbursement'];

  const [inflows, outflows] = await Promise.all([
    Transaction.aggregate([{ $match: { type: { $in: inflowTypes }, status: { $ne: 'failed' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { type: { $in: outflowTypes }, status: { $ne: 'failed' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  const totalInflow = inflows[0]?.total || 0;
  const totalOutflow = outflows[0]?.total || 0;
  const vaultAum = agentState.vaultPositions.reduce((sum, v) => sum + v.deployed, 0);
  const netTreasury = Math.max(0, totalInflow - totalOutflow);

  agentState.idleFunds = Math.max(0, netTreasury - vaultAum);
  agentState.lastScanAt = new Date().toISOString();
  await persistAgentState();

  return agentState.idleFunds;
}

// ─── Agent Actions ────────────────────────────────────────────────────────────

export async function deployIdleFunds(amount?: number): Promise<{
  vault: VaultPosition;
  logEntry: AgentLogEntry;
  newIdleFunds: number;
}> {
  const runtime = getDeFiRuntime();
  if (!runtime.enabled || runtime.emergencyStop) {
    throw new Error('DeFi deployment is disabled by runtime safety toggle');
  }

  // In hackathon/demo simulated mode, allow full idle deployment to avoid dead-ends from safety buffer math.
  const effectiveMinBuffer = runtime.liveMode ? runtime.minIdleBuffer : 0;
  const maxDeployable = Math.max(0, agentState.idleFunds - effectiveMinBuffer);
  const requested = amount || Math.min(maxDeployable, runtime.maxDeployment);
  const deployAmount = Math.max(0, Math.min(requested, maxDeployable, runtime.maxDeployment));
  if (deployAmount < 1000) {
    throw new Error('Insufficient deployable idle funds after safety buffer');
  }

  const adapter = getDeFiAdapter();
  const deployed = await adapter.deploy(
    deployAmount,
    agentState.vaultPositions.map((p) => ({
      id: p.id,
      deployed: p.deployed,
      apy: p.apy,
      stakedAt: p.stakedAt,
      externalPositionId: p.externalPositionId,
      protocol: p.protocol,
    })),
  );

  const chain = await executeOnChainRecord({
    type: 'agent_action',
    amount: deployAmount,
    description: `Idle fund deployment to ${deployed.opportunity.protocol}`,
    metadata: {
      source: 'agent.deployIdleFunds',
      protocol: deployed.opportunity.protocol,
      asset: deployed.opportunity.asset,
      apy: deployed.opportunity.apy,
      provider: adapter.provider,
      mode: adapter.mode,
      providerTxId: deployed.providerTxId,
    },
    forceValueTransfer: false,
  });
  const transactionId = chain.transactionId;

  const vault: VaultPosition = {
    id: uuidv4(),
    protocol: deployed.opportunity.protocol,
    asset: deployed.opportunity.asset,
    provider: adapter.provider,
    mode: adapter.mode,
    externalPositionId: deployed.externalPositionId,
    riskTier: deployed.opportunity.riskTier,
    deployed: deployAmount,
    apy: deployed.opportunity.apy,
    yieldAccrued: 0,
    stakedAt: new Date().toISOString(),
    transactionId,
    status: 'active',
  };

  agentState.vaultPositions.push(vault);
  agentState.idleFunds = Math.max(0, agentState.idleFunds - deployAmount);
  agentState.totalDeployed += deployAmount;
  agentState.lastScanAt = new Date().toISOString();

  const logEntry: AgentLogEntry = {
    id: uuidv4(),
    tag: 'VAULT',
    message: `Deployed ₹${deployAmount.toLocaleString('en-IN')} → ${deployed.opportunity.protocol} (${deployed.opportunity.asset})`,
    detail: `${deployed.opportunity.apy}% APY | ${adapter.provider.toUpperCase()} ${adapter.mode}. Ref: ${transactionId.slice(0, 16)}...`,
    amount: deployAmount,
    transactionId,
    timestamp: new Date().toISOString(),
  };
  agentState.agentLog.unshift(logEntry);
  await persistAgentState();

  return { vault, logEntry, newIdleFunds: agentState.idleFunds };
}

export async function harvestYield(vaultId?: string): Promise<{
  harvested: number;
  logEntry: AgentLogEntry;
}> {
  const runtime = getDeFiRuntime();
  if (!runtime.enabled || runtime.emergencyStop) {
    throw new Error('DeFi harvest is disabled by runtime safety toggle');
  }

  const targetVaults = vaultId
    ? agentState.vaultPositions.filter(v => v.id === vaultId)
    : agentState.vaultPositions.filter(v => v.status === 'active');

  if (targetVaults.length === 0) {
    throw new Error('No eligible vault positions found for harvest');
  }

  const adapter = getDeFiAdapter();
  const harvest = await adapter.harvest(
    targetVaults.map((v) => ({
      id: v.id,
      deployed: v.deployed,
      apy: v.apy,
      stakedAt: v.stakedAt,
      externalPositionId: v.externalPositionId,
      protocol: v.protocol,
    })),
    vaultId,
  );

  targetVaults.forEach((v) => {
    v.yieldAccrued = 0;
  });

  const harvestedAmount = Math.max(0, Math.floor(harvest.harvested));
  agentState.totalYieldHarvested += harvestedAmount;
  agentState.idleFunds += harvestedAmount;

  const logEntry: AgentLogEntry = {
    id: uuidv4(),
    tag: 'VAULT',
    message: `Harvested ₹${harvestedAmount.toLocaleString('en-IN')} yield from ${targetVaults.length} pools`,
    detail: `Yield redistributed to SHG treasury. ${adapter.provider.toUpperCase()} ${adapter.mode}${harvest.providerTxId ? ` | Provider Ref: ${harvest.providerTxId}` : ''}`,
    amount: harvestedAmount,
    transactionId: (await executeOnChainRecord({
      type: 'yield',
      amount: harvestedAmount,
      description: 'Yield harvested by autonomous treasury agent',
      metadata: {
        source: 'agent.harvestYield',
        vaultCount: targetVaults.length,
      },
      forceValueTransfer: false,
    })).transactionId,
    timestamp: new Date().toISOString(),
  };
  agentState.agentLog.unshift(logEntry);
  await persistAgentState();

  return { harvested: harvestedAmount, logEntry };
}

export async function processEmergencyLoan(params: {
  memberId: string;
  memberName: string;
  trustScore: number;
  amount: number;
  purpose: string;
}): Promise<{
  approved: boolean;
  autoApproved: boolean;
  threshold: number;
  transactionId?: string;
  autoRepayment?: AutoRepayment;
  logEntry: AgentLogEntry;
  reason: string;
}> {
  const { memberId, memberName, trustScore, amount, purpose } = params;
  const isEmergency = /medical|hospital|emergency|health|urgent|accident/i.test(purpose);
  const isMicroLoan = amount <= 5000;
  const isHighScore = trustScore >= 750;

  let approved = false;
  let autoApproved = false;
  let threshold = 3;
  let reason = '';
  let transactionId: string | undefined;
  let autoRepayment: AutoRepayment | undefined;

  if (isMicroLoan && trustScore >= 800) {
    approved = true;
    autoApproved = true;
    threshold = 1;
    reason = `✅ Trust Score ${trustScore}/1000 exceeds micro-loan auto-approval threshold. Funds disbursed instantly.`;
  } else if (isEmergency && isHighScore) {
    approved = true;
    autoApproved = true;
    threshold = 1;
    reason = `🚨 Emergency override activated. Trust Score ${trustScore}/1000. Approval threshold lowered to 1-of-3. Disbursed in <3s.`;
  } else if (trustScore >= 700) {
    approved = false;
    autoApproved = false;
    threshold = 3;
    reason = `📋 Routed to standard 3-of-3 approval. Trust Score ${trustScore}/1000 qualifies for approval.`;
  } else {
    approved = false;
    autoApproved = false;
    threshold = 3;
    reason = `⚠️ Trust Score ${trustScore}/1000 below emergency threshold (750). Standard review required.`;
  }

  if (autoApproved) {
    const chain = await executeOnChainRecord({
      type: 'loan_disbursement',
      amount,
      description: `Emergency loan auto-approved for ${memberName}`,
      memberId,
      memberName,
      metadata: {
        source: 'agent.processEmergencyLoan',
        trustScore,
        purpose,
      },
      forceValueTransfer: true,
    });
    transactionId = chain.transactionId;
    const installmentAmount = Math.ceil(amount / 6);
    autoRepayment = {
      loanId: uuidv4(),
      memberId,
      memberName,
      installmentAmount,
      totalInstallments: 6,
      paidInstallments: 0,
      nextDueDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      deductionSource: 'future_deposit',
      status: 'active',
    };
    agentState.autoRepayments.push(autoRepayment);
    agentState.idleFunds = Math.max(0, agentState.idleFunds - amount);
  }

  const logEntry: AgentLogEntry = {
    id: uuidv4(),
    tag: 'LOAN',
    message: autoApproved
      ? `Emergency loan disbursed for ${memberName} — ₹${amount.toLocaleString('en-IN')}`
      : `Loan request routed to approval workflow for ${memberName} — ₹${amount.toLocaleString('en-IN')}`,
    detail: reason,
    amount,
    transactionId,
    timestamp: new Date().toISOString(),
  };
  agentState.agentLog.unshift(logEntry);
  agentState.lastScanAt = new Date().toISOString();
  await persistAgentState();

  return { approved, autoApproved, threshold, transactionId, autoRepayment, logEntry, reason };
}

export function getAgentStatus() {
  // Tick yield accruals
  agentState.vaultPositions.forEach(v => {
    if (v.status === 'active') {
      const hoursStaked = (Date.now() - new Date(v.stakedAt).getTime()) / 3600000;
      v.yieldAccrued = Math.floor((v.deployed * v.apy / 100 / 8760) * hoursStaked);
    }
  });

  return {
    ...agentState,
    totalVaultAUM: agentState.vaultPositions.reduce((s, v) => s + v.deployed, 0),
    pendingYield: agentState.vaultPositions.reduce((s, v) => s + v.yieldAccrued, 0),
    averageAPY: agentState.vaultPositions.length
      ? agentState.vaultPositions.reduce((s, v) => s + v.apy, 0) / agentState.vaultPositions.length
      : 0,
  };
}
