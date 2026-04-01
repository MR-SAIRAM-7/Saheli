// ─── API Client for Saheli Saheli ─────────────────────────────────────────
// All backend calls go through this typed client.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function clearStoredAuthAndNotify() {
  localStorage.removeItem('saheli-token');
  localStorage.removeItem('saheli-user');
  localStorage.removeItem('shg-role');
  localStorage.removeItem('saheli-wallet-address');
  window.dispatchEvent(new CustomEvent('saheli-auth-invalid'));
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('saheli-token');
  
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error', code: 'NETWORK_ERROR' }));
    const code = String((err as any)?.code || '');
    if (res.status === 401 && (code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED')) {
      clearStoredAuthAndNotify();
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (phone: string, password: string) =>
    apiFetch<any>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  register: (body: { name: string; phone?: string; password: string; role: string; shgId?: string; walletAddress?: string }) =>
    apiFetch<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  linkWallet: (walletAddress: string) =>
    apiFetch<any>('/auth/wallet/link', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
  peraLogin: (body: { walletAddress: string; role?: string; name?: string; phone?: string; shgId?: string }) =>
    apiFetch<any>('/auth/pera-login', { method: 'POST', body: JSON.stringify(body) }),
  profile: () => apiFetch<any>('/auth/profile'),
};

// ─── Members ──────────────────────────────────────────────────────────────────

export const membersApi = {
  getAll: () => apiFetch<any[]>('/members'),
  getById: (id: string) => apiFetch<any>(`/members/${id}`),
  getTransactions: (id: string) => apiFetch<any[]>(`/members/${id}/transactions`),
  getPassport: (id: string) => apiFetch<any | null>(`/members/${id}/passport`),
  mintPassport: (id: string) => apiFetch<any>(`/members/${id}/passport/mint`, { method: 'POST', body: JSON.stringify({}) }),
  refreshPassport: (id: string, reason = 'manual_refresh') =>
    apiFetch<any>(`/members/${id}/passport/refresh`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
};

// ─── Transactions ──────────────────────────────────────────────────────────────

export const transactionsApi = {
  getAll: () => apiFetch<any[]>('/transactions'),
  getLedger: () => apiFetch<any[]>('/transactions/ledger'),
  create: (body: { memberId: string; type: string; amount: number; description?: string }) =>
    apiFetch<any>('/transactions', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── Loans ────────────────────────────────────────────────────────────────────

export const loansApi = {
  getAll: () => apiFetch<any[]>('/loans'),
  getById: (id: string) => apiFetch<any>(`/loans/${id}`),
  getBankQueue: () => apiFetch<any[]>('/loans/bank-queue/list'),
  processBankQueue: (id: string, processedBy?: string) =>
    apiFetch<any>(`/loans/bank-queue/${id}/process`, { method: 'POST', body: JSON.stringify({ processedBy }) }),
  request: (body: { memberId: string; amount: number; purpose: string }) =>
    apiFetch<any>('/loans/request', { method: 'POST', body: JSON.stringify(body) }),
  approve: (id: string) =>
    apiFetch<any>(`/loans/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
};

// ─── Multi-Sig ────────────────────────────────────────────────────────────────

export const multisigApi = {
  getPending: () => apiFetch<any[]>('/multisig/pending'),
  getAll: () => apiFetch<any[]>('/multisig'),
  sign: (id: string, signerId?: string) =>
    apiFetch<any>(`/multisig/${id}/sign`, { method: 'POST', body: JSON.stringify({ signerId }) }),
  reject: (id: string) =>
    apiFetch<any>(`/multisig/${id}/reject`, { method: 'POST', body: JSON.stringify({}) }),
};

// ─── AI Agent ─────────────────────────────────────────────────────────────────

export const aiAgentApi = {
  getLog: () => apiFetch<any[]>('/ai-agent/log'),
  getInsights: () => apiFetch<any>('/ai-agent/insights'),
  getSuggestions: (memberId?: string) =>
    apiFetch<any[]>(`/ai-agent/suggestions${memberId ? `?memberId=${memberId}` : ''}`),
  chat: (body: { message: string; memberId?: string; memberName?: string }) =>
    apiFetch<any>('/ai-agent/chat', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── QR Code ──────────────────────────────────────────────────────────────────

export const qrApi = {
  generate: (body: {
    transactionId?: string;
    txHash?: string;
    memberId?: string;
    memberName?: string;
    memberPhone?: string;
    amount?: number;
    type?: string;
    // walletAddress?: string; - removed for MERN
    autoSendWhatsApp?: boolean;
  }) => {
    const payload = {
      ...body,
      transactionId: body.transactionId || body.txHash,
    };

    return apiFetch<any>('/qr/generate', { method: 'POST', body: JSON.stringify(payload) });
  },
  verify: (transactionId: string) => apiFetch<any>(`/qr/verify/${transactionId}`),
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export const statsApi = {
  getTreasury: () => apiFetch<any>('/stats/treasury'),
  getInstitutional: () => apiFetch<any>('/stats/institutional'),
  getSHGDirectory: () => apiFetch<any[]>('/stats/shg-directory'),
  getLedger: () => apiFetch<any[]>('/stats/ledger'),
  approveGrant: () => apiFetch<any>('/stats/grants/approve', { method: 'POST', body: JSON.stringify({}) }),
};

// ─── Autonomous Agent ─────────────────────────────────────────────────────────

export const agentApi = {
  getStatus: () => apiFetch<any>('/agent/status'),
  getLog: () => apiFetch<any[]>('/agent/log'),
  getVaults: () => apiFetch<any>('/agent/vaults'),
  invest: (amount?: number) =>
    apiFetch<any>('/agent/invest', { method: 'POST', body: JSON.stringify({ amount }) }),
  harvest: (vaultId?: string) =>
    apiFetch<any>('/agent/harvest', { method: 'POST', body: JSON.stringify({ vaultId }) }),
  emergencyLoan: (body: { memberId?: string; amount: number; purpose?: string }) =>
    apiFetch<any>('/agent/emergency-loan', { method: 'POST', body: JSON.stringify(body) }),
  getRepayments: () => apiFetch<any[]>('/agent/repayments'),
};

