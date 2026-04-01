import algosdk, { Algodv2, Indexer } from 'algosdk';

export type AlgorandNetwork = 'testnet' | 'mainnet' | 'betanet' | 'localnet';

export type LedgerRecordType =
  | 'deposit'
  | 'withdrawal'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'yield'
  | 'multisig_action'
  | 'grant_disbursement'
  | 'agent_action'
  | 'qr_anchor';

export interface SubmitLedgerRecordParams {
  type: LedgerRecordType;
  amount: number;
  description: string;
  memberId?: string;
  memberName?: string;
  memberWalletAddress?: string | null;
  recipientWalletAddress?: string | null;
  metadata?: Record<string, unknown>;
  forceValueTransfer?: boolean;
}

export interface SubmittedLedgerRecord {
  txId: string;
  confirmedRound: number;
  network: AlgorandNetwork;
  explorerUrl: string;
}

function resolveNetwork(): AlgorandNetwork {
  const value = (process.env.ALGORAND_NETWORK || 'testnet').trim().toLowerCase();
  if (value === 'mainnet' || value === 'betanet' || value === 'localnet') {
    return value;
  }
  return 'testnet';
}

function defaultAlgodServer(network: AlgorandNetwork): string {
  if (network === 'mainnet') return 'https://mainnet-api.algonode.cloud';
  if (network === 'betanet') return 'https://betanet-api.algonode.cloud';
  if (network === 'localnet') return 'http://localhost';
  return 'https://testnet-api.algonode.cloud';
}

function defaultIndexerServer(network: AlgorandNetwork): string {
  if (network === 'mainnet') return 'https://mainnet-idx.algonode.cloud';
  if (network === 'betanet') return 'https://betanet-idx.algonode.cloud';
  if (network === 'localnet') return 'http://localhost';
  return 'https://testnet-idx.algonode.cloud';
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function strictModeEnabled(): boolean {
  const raw = (process.env.ALGORAND_STRICT_MODE || 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function getAlgodClient(): Algodv2 {
  const network = resolveNetwork();
  const tokenHeader = (process.env.ALGORAND_ALGOD_TOKEN_HEADER || 'X-Algo-API-Token').trim();
  const tokenValue = process.env.ALGORAND_ALGOD_TOKEN?.trim() || '';
  const baseHeaders = parseHeaders(process.env.ALGORAND_ALGOD_HEADERS);

  const token: string | Record<string, string> = tokenValue
    ? { [tokenHeader]: tokenValue, ...baseHeaders }
    : baseHeaders;

  const server = (process.env.ALGORAND_ALGOD_SERVER || defaultAlgodServer(network)).trim();
  const port = Number(process.env.ALGORAND_ALGOD_PORT || 443);

  return new algosdk.Algodv2(token, server, port);
}

function getIndexerClient(): Indexer {
  const network = resolveNetwork();
  const tokenHeader = (process.env.ALGORAND_INDEXER_TOKEN_HEADER || 'X-Algo-API-Token').trim();
  const tokenValue = process.env.ALGORAND_INDEXER_TOKEN?.trim() || process.env.ALGORAND_ALGOD_TOKEN?.trim() || '';
  const baseHeaders = parseHeaders(process.env.ALGORAND_INDEXER_HEADERS) || parseHeaders(process.env.ALGORAND_ALGOD_HEADERS);

  const token: string | Record<string, string> = tokenValue
    ? { [tokenHeader]: tokenValue, ...baseHeaders }
    : baseHeaders;

  const server = (process.env.ALGORAND_INDEXER_SERVER || defaultIndexerServer(network)).trim();
  const port = Number(process.env.ALGORAND_INDEXER_PORT || 443);

  return new algosdk.Indexer(token, server, port);
}

function getTreasuryAccount() {
  const mnemonic = process.env.ALGORAND_TREASURY_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error('ALGORAND_TREASURY_MNEMONIC is missing');
  }
  return algosdk.mnemonicToSecretKey(mnemonic);
}

function toMicroAlgos(rupees: number): number {
  const ratio = Number(process.env.ALGORAND_MICROALGOS_PER_RUPEE || 1000);
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1000;
  const normalizedAmount = Number.isFinite(rupees) ? Math.max(0, rupees) : 0;
  return Math.round(normalizedAmount * safeRatio);
}

function isValidAddress(address?: string | null): boolean {
  if (!address) return false;
  try {
    return algosdk.isValidAddress(address);
  } catch {
    return false;
  }
}

function getExplorerUrl(txId: string): string {
  const network = resolveNetwork();
  if (network === 'mainnet') return `https://allo.info/tx/${txId}`;
  if (network === 'betanet') return `https://betanet.algoexplorer.io/tx/${txId}`;
  if (network === 'localnet') return txId;
  return `https://testnet.algoexplorer.io/tx/${txId}`;
}

function buildNote(params: SubmitLedgerRecordParams) {
  const payload = {
    app: 'SHG_CHAIN',
    version: '2.0',
    type: params.type,
    amount: params.amount,
    description: params.description,
    memberId: params.memberId,
    memberName: params.memberName,
    memberWalletAddress: params.memberWalletAddress,
    timestamp: new Date().toISOString(),
    meta: params.metadata || {},
  };

  const serialized = JSON.stringify(payload);
  return new TextEncoder().encode(serialized);
}

export function getAlgorandRuntimeInfo() {
  const treasuryMnemonic = process.env.ALGORAND_TREASURY_MNEMONIC?.trim();
  return {
    network: resolveNetwork(),
    strictMode: strictModeEnabled(),
    configured: !!treasuryMnemonic,
    treasuryAddress: treasuryMnemonic ? algosdk.mnemonicToSecretKey(treasuryMnemonic).addr : null,
  };
}

export async function submitLedgerRecord(params: SubmitLedgerRecordParams): Promise<SubmittedLedgerRecord> {
  const runtime = getAlgorandRuntimeInfo();
  if (!runtime.configured && runtime.strictMode) {
    throw new Error('Algorand strict mode is enabled, but treasury signer is not configured. Set ALGORAND_TREASURY_MNEMONIC.');
  }

  if (!runtime.configured) {
    throw new Error('Algorand is not configured. Provide ALGORAND_TREASURY_MNEMONIC.');
  }

  const algod = getAlgodClient();
  const treasury = getTreasuryAccount();
  const suggestedParams = await algod.getTransactionParams().do();

  const targetAddress = isValidAddress(params.recipientWalletAddress)
    ? params.recipientWalletAddress!
    : treasury.addr;

  const shouldTransferValue = params.forceValueTransfer || (params.type === 'loan_disbursement' && targetAddress !== treasury.addr);
  const valueMicroAlgos = shouldTransferValue ? Math.max(1000, toMicroAlgos(params.amount)) : 0;

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: treasury.addr,
    receiver: targetAddress,
    amount: valueMicroAlgos,
    suggestedParams: {
      ...suggestedParams,
      flatFee: true,
      fee: 1000,
    },
    note: buildNote(params),
  });

  const signedTxn = txn.signTxn(treasury.sk);
  const submission = await algod.sendRawTransaction(signedTxn).do() as { txid?: string; txId?: string };
  const txId = submission.txid || submission.txId;
  if (!txId) {
    throw new Error('Algorand submission did not return a txId');
  }
  const confirmation = await algosdk.waitForConfirmation(algod, txId, 6);
  const confirmedRound = Number((confirmation as { confirmedRound?: number }).confirmedRound || 0);

  return {
    txId,
    confirmedRound,
    network: resolveNetwork(),
    explorerUrl: getExplorerUrl(txId),
  };
}

function tryDecodeNote(base64Value?: string): Record<string, unknown> | null {
  if (!base64Value) return null;
  try {
    const text = Buffer.from(base64Value, 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function lookupLedgerRecord(txId: string): Promise<{
  exists: boolean;
  confirmedRound?: number;
  note?: Record<string, unknown> | null;
  sender?: string;
  receiver?: string;
  amountMicroAlgos?: number;
  explorerUrl?: string;
}> {
  const runtime = getAlgorandRuntimeInfo();
  if (!runtime.configured) {
    return { exists: false };
  }

  const indexer = getIndexerClient();

  try {
    const result = await indexer.lookupTransactionByID(txId).do() as {
      transaction?: {
        sender?: string;
        note?: string;
        'confirmed-round'?: number;
        'payment-transaction'?: {
          amount?: number;
          receiver?: string;
        };
      };
    };

    const tx = result.transaction;
    if (!tx) {
      return { exists: false };
    }

    return {
      exists: true,
      confirmedRound: tx['confirmed-round'] || 0,
      note: tryDecodeNote(tx.note),
      sender: tx.sender,
      receiver: tx['payment-transaction']?.receiver,
      amountMicroAlgos: tx['payment-transaction']?.amount,
      explorerUrl: getExplorerUrl(txId),
    };
  } catch {
    return { exists: false };
  }
}
