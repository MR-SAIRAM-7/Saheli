import { v4 as uuidv4 } from 'uuid';

// ─── Members ────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  phone: string;
  did: string;
  trustScore: number;
  trustGrade: string;
  totalSavings: number;
  activeLoans: number;
  activeLoansAmount: number;
  yieldEarned: number;
  repaymentRate: number;
  joinedAt: string;
  shgId: string;
  badges: string[];
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'loan_disbursement' | 'loan_repayment' | 'yield';
  amount: number;
  description: string;
  timestamp: string;
  transactionId: string;
  status: 'confirmed' | 'pending' | 'failed';
  agentProcessed: boolean;
}

export interface Loan {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'repaying' | 'repaid';
  trustScoreAtApplication: number;
  aiRecommendation: 'approve' | 'review' | 'reject';
  aiReason: string;
  approvals: number;
  approvalsRequired: number;
  disbursedAt?: string;
  dueDate?: string;
  repaidAmount: number;
  createdAt: string;
  transactionId?: string;
}

export interface MultiSigAction {
  id: string;
  type: 'loan_approval' | 'fund_deployment' | 'yield_rebalance' | 'grant_disbursement';
  description: string;
  amount: number;
  requestedBy: string;
  signatures: string[];
  signaturesRequired: number;
  status: 'pending' | 'executed' | 'rejected';
  createdAt: string;
  transactionId?: string;
}

export interface SHGGroup {
  id: string;
  name: string;
  registrationId: string;
  trustScore: number;
  memberCount: number;
  activeLoans: string;
  totalLiquidity: number;
  yieldThisMonth: number;
  auditStatus: 'VERIFIED' | 'PENDING_AUDIT' | 'FLAGGED';
  region: string;
}

export interface AILogEntry {
  id: string;
  type: 'yield_deploy' | 'loan_auto_approve' | 'yield_alert' | 'sync' | 'rebalance' | 'notification';
  icon: string;
  title: string;
  highlight: string;
  timestamp: string;
  amount?: number;
}

// ─── Data ────────────────────────────────────────────────────────────────────

export const members: Member[] = [
  {
    id: 'm1',
    name: 'Lakshmi Devi',
    phone: '+91-9876543210',
    did: 'saheli/m/8821...4a',
    trustScore: 850,
    trustGrade: 'EXCELLENT',
    totalSavings: 42500,
    activeLoans: 3,
    activeLoansAmount: 12000,
    yieldEarned: 1840,
    repaymentRate: 99.2,
    joinedAt: '2022-04-15',
    shgId: 'shg1',
    badges: ['Green Farmer', 'Leader Mentor', 'Early Adopter'],
    transactions: [
      {
        id: 't1',
        type: 'deposit',
        amount: 500,
        description: 'WhatsApp Voice Deposit',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        transactionId: 'TXN_' + uuidv4().slice(0, 16).toUpperCase(),
        status: 'confirmed',
        agentProcessed: true,
      },
      {
        id: 't2',
        type: 'loan_disbursement',
        amount: 5000,
        description: 'Loan Auto-Approved — Inventory Financing (Seed Bank)',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        transactionId: 'TXN_' + uuidv4().slice(0, 16).toUpperCase(),
        status: 'confirmed',
        agentProcessed: true,
      },
      {
        id: 't3',
        type: 'loan_repayment',
        amount: -1200,
        description: 'Loan Repayment — Batch 14 Installment',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        transactionId: 'TXN_' + uuidv4().slice(0, 16).toUpperCase(),
        status: 'confirmed',
        agentProcessed: false,
      },
      {
        id: 't4',
        type: 'yield',
        amount: 340,
        description: 'Yield earned from Fixed Deposit Pool',
        timestamp: new Date(Date.now() - 604800000).toISOString(),
        transactionId: 'TXN_' + uuidv4().slice(0, 16).toUpperCase(),
        status: 'confirmed',
        agentProcessed: true,
      },
    ],
  },
  {
    id: 'm2',
    name: 'Sita Ramaiah',
    phone: '+91-9812345678',
    did: 'saheli/m/9022...7b',
    trustScore: 780,
    trustGrade: 'GOOD',
    totalSavings: 28000,
    activeLoans: 1,
    activeLoansAmount: 5000,
    yieldEarned: 980,
    repaymentRate: 97.5,
    joinedAt: '2022-09-12',
    shgId: 'shg1',
    badges: ['Consistent Saver'],
    transactions: [],
  },
  {
    id: 'm3',
    name: 'Priya Sharma',
    phone: '+91-9834567890',
    did: 'saheli/m/4451...2c',
    trustScore: 920,
    trustGrade: 'EXCELLENT',
    totalSavings: 65000,
    activeLoans: 0,
    activeLoansAmount: 0,
    yieldEarned: 3200,
    repaymentRate: 100,
    joinedAt: '2021-11-05',
    shgId: 'shg2',
    badges: ['Green Farmer', 'Zero Default', 'Community Pillar'],
    transactions: [],
  },
];

export const loans: Loan[] = [
  {
    id: 'loan1',
    memberId: 'm1',
    memberName: 'Lakshmi Devi',
    amount: 15000,
    purpose: 'Hospital Expenses',
    status: 'pending',
    trustScoreAtApplication: 850,
    aiRecommendation: 'approve',
    aiReason: 'Excellent trust score of 850. 99.2% repayment history. Emergency medical loan qualifies for fast-track approval.',
    approvals: 1,
    approvalsRequired: 3,
    repaidAmount: 0,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'loan2',
    memberId: 'm2',
    memberName: 'Sita Ramaiah',
    amount: 5000,
    purpose: 'Seed purchase for Kharif season',
    status: 'repaying',
    trustScoreAtApplication: 780,
    aiRecommendation: 'approve',
    aiReason: 'Good trust score. Agricultural loan with seasonal repayment pattern. Recommend approval.',
    approvals: 3,
    approvalsRequired: 3,
    disbursedAt: new Date(Date.now() - 2592000000).toISOString(),
    dueDate: new Date(Date.now() + 2592000000).toISOString(),
    repaidAmount: 3250,
    createdAt: new Date(Date.now() - 2592000000).toISOString(),
    transactionId: 'TXN_4F8A2B1C9D3E',
  },
];

export const multiSigActions: MultiSigAction[] = [
  {
    id: 'ms1',
    type: 'loan_approval',
    description: 'Emergency Medical Loan',
    amount: 15000,
    requestedBy: 'Lakshmi Devi',
    signatures: ['leader1'],
    signaturesRequired: 3,
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ms2',
    type: 'yield_rebalance',
    description: 'Fixed Deposit Pool Yield Rebalance — Move to higher yield pool (5.2% APY)',
    amount: 120000,
    requestedBy: 'AI Agent',
    signatures: ['leader1', 'leader2'],
    signaturesRequired: 3,
    status: 'pending',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const shgGroups: SHGGroup[] = [
  {
    id: 'shg1',
    name: 'Lakshmi Mahila Mandal',
    registrationId: 'SHG-8821-KA',
    trustScore: 942,
    memberCount: 28,
    activeLoans: '₹8.40 Lakh',
    totalLiquidity: 840000,
    yieldThisMonth: 4.2,
    auditStatus: 'VERIFIED',
    region: 'Karnataka',
  },
  {
    id: 'shg2',
    name: 'Saraswati Mahila SHG',
    registrationId: 'SHG-9022-KA',
    trustScore: 884,
    memberCount: 34,
    activeLoans: '₹12.2 Lakh',
    totalLiquidity: 1220000,
    yieldThisMonth: 3.9,
    auditStatus: 'VERIFIED',
    region: 'Karnataka',
  },
  {
    id: 'shg3',
    name: 'Deepa Raitha Sangha',
    registrationId: 'SHG-4451-KA',
    trustScore: 721,
    memberCount: 22,
    activeLoans: '₹3.15 Lakh',
    totalLiquidity: 315000,
    yieldThisMonth: 2.1,
    auditStatus: 'PENDING_AUDIT',
    region: 'Karnataka',
  },
  {
    id: 'shg4',
    name: 'Durga Swayam Sahayata',
    registrationId: 'SHG-3317-MH',
    trustScore: 810,
    memberCount: 18,
    activeLoans: '₹5.80 Lakh',
    totalLiquidity: 580000,
    yieldThisMonth: 3.4,
    auditStatus: 'VERIFIED',
    region: 'Maharashtra',
  },
];

export const aiLog: AILogEntry[] = [
  {
    id: 'ai1',
    type: 'yield_deploy',
    icon: 'CheckCircle2',
    title: 'Deployed ₹50,000 to Fixed Deposit Pool',
    highlight: '4.2% yield',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    amount: 50000,
  },
  {
    id: 'ai2',
    type: 'loan_auto_approve',
    icon: 'Zap',
    title: 'Auto-approved ₹500 loan for Sita',
    highlight: 'Score: 98/100',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    amount: 500,
  },
  {
    id: 'ai3',
    type: 'yield_alert',
    icon: 'AlertTriangle',
    title: 'Yield Alert: Liquidity dipped below 20%',
    highlight: 'Moving ₹10k from reserve',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    amount: 10000,
  },
  {
    id: 'ai4',
    type: 'sync',
    icon: 'CheckCircle2',
    title: 'Sync complete — Village node #02 validated',
    highlight: 'All offline txns verified',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'ai5',
    type: 'rebalance',
    icon: 'TrendingUp',
    title: 'Rebalanced portfolio across 3 pools',
    highlight: 'Est. return +0.3% APY',
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    amount: 200000,
  },
];

export const ledgerStream = [
  {
    id: 'ls1',
    event: 'Repayment Confirmed: LM Mandal',
    txId: 'TXN-82FA231',
    amount: 12400,
    type: 'credit',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'ls2',
    event: 'Loan Disbursal: Saraswati Group',
    txId: 'TXN-C19F842',
    amount: -50000,
    type: 'debit',
    timestamp: new Date(Date.now() - 2700000).toISOString(),
  },
  {
    id: 'ls3',
    event: 'Trust Score Updated: Member #4421',
    txId: 'TXN-D447E01',
    amount: 0,
    type: 'update',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'ls4',
    event: 'Grant Disbursed: Rural Development Fund',
    txId: 'TXN-F77B399',
    amount: 200000,
    type: 'credit',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: 'ls5',
    event: 'Yield Harvested: Fixed Deposit Pool',
    txId: 'TXN-A22C810',
    amount: 4200,
    type: 'credit',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
  },
];

// Treasury stats for leader dashboard
export const treasuryStats = {
  totalLiquidity: 1245800,
  yieldThisMonth: 4.2,
  trustScore: 'A+',
  trustScoreValue: 92,
  activeMembers: 24,
  totalMembers: 28,
  idleFundsDeployed: 500000,
  idleFundsAPY: 4.2,
  totalYieldGenerated: 52400,
};

// Bank/NGO stats
export const institutionalStats = {
  regionalLiquidity: 42000000,
  activeGrants: 128,
  shgsMonitored: 47,
  aggregateTrustIndex: 92,
  repaymentRate: 99.2,
  lockedLiquidity: 18400000,
  auditFrequency: 'Real-time',
};
