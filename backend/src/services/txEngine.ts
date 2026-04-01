import Transaction from '../models/Transaction';
import {
  lookupLedgerRecord,
  submitLedgerRecord,
  type LedgerRecordType,
} from './algorand';

export function generateTxHash(): string {
  return `PENDING-${Date.now().toString(36).toUpperCase()}`;
}

type TxStatus = 'pending' | 'confirmed' | 'failed';

type LifecycleRecord = {
  transactionId: string;
  status: TxStatus;
  type: string;
  amount: number;
  createdAt: string;
  confirmedAt?: string;
};

const txLifecycleStore = new Map<string, LifecycleRecord>();

function shouldUseDemoChainFallback(): boolean {
  const raw = (process.env.DEMO_CHAIN_FALLBACK || '').trim().toLowerCase();
  if (raw) {
    return ['1', 'true', 'yes', 'on'].includes(raw);
  }
  return process.env.NODE_ENV !== 'production';
}

function normalizeType(type?: string): LedgerRecordType {
  if (type === 'deposit') return 'deposit';
  if (type === 'withdrawal') return 'withdrawal';
  if (type === 'loan_disbursement') return 'loan_disbursement';
  if (type === 'loan_repayment') return 'loan_repayment';
  if (type === 'yield') return 'yield';
  if (type === 'grant_disbursement') return 'grant_disbursement';
  if (type === 'multisig_action') return 'multisig_action';
  if (type === 'qr_anchor') return 'qr_anchor';
  return 'agent_action';
}

export async function executeOnChainRecord(params: {
  type: string;
  amount: number;
  description: string;
  memberId?: string;
  memberName?: string;
  memberWalletAddress?: string | null;
  recipientWalletAddress?: string | null;
  metadata?: Record<string, unknown>;
  forceValueTransfer?: boolean;
}) {
  let submitted:
    | {
        txId: string;
        explorerUrl: string;
        confirmedRound: number;
        network: 'testnet' | 'mainnet' | 'betanet' | 'localnet';
      }
    | undefined;

  try {
    submitted = await submitLedgerRecord({
      type: normalizeType(params.type),
      amount: params.amount,
      description: params.description,
      memberId: params.memberId,
      memberName: params.memberName,
      memberWalletAddress: params.memberWalletAddress,
      recipientWalletAddress: params.recipientWalletAddress,
      metadata: params.metadata,
      forceValueTransfer: params.forceValueTransfer,
    });
  } catch (error) {
    if (!shouldUseDemoChainFallback()) {
      throw error;
    }

    const txId = generateTxHash();
    submitted = {
      txId,
      explorerUrl: '',
      confirmedRound: 0,
      network: 'testnet',
    };
  }

  txLifecycleStore.set(submitted.txId, {
    transactionId: submitted.txId,
    status: 'confirmed',
    type: params.type,
    amount: params.amount,
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  });

  return {
    transactionId: submitted.txId,
    explorerUrl: submitted.explorerUrl,
    confirmedRound: submitted.confirmedRound,
    network: submitted.network,
    status: 'confirmed' as const,
  };
}

export function registerTransactionLifecycle(params: {
  transactionId: string;
  type?: string;
  amount?: number;
  initialStatus?: TxStatus;
  autoConfirm?: boolean;
  autoConfirmDelayMs?: number;
}): LifecycleRecord {
  const existing = txLifecycleStore.get(params.transactionId);
  if (existing) {
    return existing;
  }

  const record: LifecycleRecord = {
    transactionId: params.transactionId,
    status: params.initialStatus || 'pending',
    type: params.type || 'standard',
    amount: params.amount || 0,
    createdAt: new Date().toISOString(),
  };

  txLifecycleStore.set(params.transactionId, record);
  return record;
}

export function setTransactionLifecycleStatus(transactionId: string, status: TxStatus): void {
  const existing = txLifecycleStore.get(transactionId);
  if (!existing) {
    txLifecycleStore.set(transactionId, {
      transactionId,
      status,
      type: 'standard',
      amount: 0,
      createdAt: new Date().toISOString(),
      confirmedAt: status === 'confirmed' ? new Date().toISOString() : undefined,
    });
    return;
  }

  existing.status = status;
  if (status === 'confirmed') {
    existing.confirmedAt = existing.confirmedAt || new Date().toISOString();
  }
  txLifecycleStore.set(transactionId, existing);
}

export async function verifyTransaction(transactionId: string): Promise<{
  valid: boolean;
  status: TxStatus | 'not_found';
  confirmedAt?: string;
  type?: string;
  amount?: number;
  explorerUrl?: string;
  chainRecord?: Record<string, unknown> | null;
}> {
  const chain = await lookupLedgerRecord(transactionId);
  if (chain.exists) {
    return {
      valid: true,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      type: String(chain.note?.type || 'unknown'),
      amount: Number(chain.note?.amount || 0),
      explorerUrl: chain.explorerUrl,
      chainRecord: chain.note || null,
    };
  }

  const dbTx = await Transaction.findOne({ transactionId }).lean();
  if (dbTx) {
    const normalizedStatus: TxStatus = (dbTx.status as TxStatus) || 'pending';
    return {
      valid: normalizedStatus !== 'failed',
      status: normalizedStatus,
      confirmedAt: normalizedStatus === 'confirmed' ? new Date().toISOString() : undefined,
      type: dbTx.type,
      amount: dbTx.amount,
    };
  }

  const lifecycleTx = txLifecycleStore.get(transactionId);
  if (lifecycleTx) {
    return {
      valid: lifecycleTx.status !== 'failed',
      status: lifecycleTx.status,
      confirmedAt: lifecycleTx.confirmedAt,
      type: lifecycleTx.type,
      amount: lifecycleTx.amount,
    };
  }

  return {
    valid: false,
    status: 'not_found',
  };
}
