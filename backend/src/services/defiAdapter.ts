export interface DeFiOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  riskTier: 'low' | 'medium' | 'high';
}

export interface DeFiDeployResponse {
  opportunity: DeFiOpportunity;
  externalPositionId?: string;
  providerTxId?: string;
}

export interface DeFiHarvestResponse {
  harvested: number;
  providerTxId?: string;
}

export interface DeFiPositionRef {
  id: string;
  deployed: number;
  apy: number;
  stakedAt: string;
  externalPositionId?: string;
  protocol: string;
}

export interface DeFiAdapter {
  provider: string;
  mode: 'simulated' | 'live';
  deploy: (amount: number, existingPositions: DeFiPositionRef[]) => Promise<DeFiDeployResponse>;
  harvest: (positions: DeFiPositionRef[], vaultId?: string) => Promise<DeFiHarvestResponse>;
}

const DEFAULT_PROTOCOLS: DeFiOpportunity[] = [
  { protocol: 'Folks Finance', asset: 'USDCa', apy: 6.2, riskTier: 'low' },
  { protocol: 'Tinyman', asset: 'ALGO/USDC LP', apy: 8.1, riskTier: 'medium' },
  { protocol: 'Pact', asset: 'stALGO pool', apy: 5.9, riskTier: 'low' },
];

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = (process.env[name] || '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function getAllowedProtocols(): string[] {
  const raw = (process.env.DEFI_ALLOWED_PROTOCOLS || '').trim();
  if (!raw) return DEFAULT_PROTOCOLS.map((p) => p.protocol.toLowerCase());
  return raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function pickSimulatedOpportunity(existingPositions: DeFiPositionRef[]): DeFiOpportunity {
  const allowed = getAllowedProtocols();
  const candidates = DEFAULT_PROTOCOLS.filter((p) => allowed.includes(p.protocol.toLowerCase()));
  const pool = candidates.length > 0 ? candidates : DEFAULT_PROTOCOLS;

  // Spread across protocols by preferring less-used pools.
  const usage = new Map<string, number>();
  for (const p of existingPositions) {
    usage.set(p.protocol, (usage.get(p.protocol) || 0) + 1);
  }

  return pool.slice().sort((a, b) => (usage.get(a.protocol) || 0) - (usage.get(b.protocol) || 0))[0];
}

function estimateHarvest(positions: DeFiPositionRef[], vaultId?: string): number {
  const target = vaultId ? positions.filter((p) => p.id === vaultId) : positions;
  const harvested = target.reduce((sum, p) => {
    const hoursStaked = Math.max(1, (Date.now() - new Date(p.stakedAt).getTime()) / 3600000);
    const accrued = Math.floor((p.deployed * p.apy / 100 / 8760) * hoursStaked);
    return sum + Math.max(0, accrued);
  }, 0);

  return harvested;
}

class SimulatedAdapter implements DeFiAdapter {
  provider = 'simulated';
  mode: 'simulated' = 'simulated';

  async deploy(_amount: number, existingPositions: DeFiPositionRef[]): Promise<DeFiDeployResponse> {
    const opportunity = pickSimulatedOpportunity(existingPositions);
    return {
      opportunity,
      externalPositionId: `SIM-${Date.now().toString(36).toUpperCase()}`,
      providerTxId: `SIMTX-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  async harvest(positions: DeFiPositionRef[], vaultId?: string): Promise<DeFiHarvestResponse> {
    const harvested = estimateHarvest(positions, vaultId);
    return {
      harvested,
      providerTxId: `SIMHV-${Date.now().toString(36).toUpperCase()}`,
    };
  }
}

class FolksLiveAdapter implements DeFiAdapter {
  provider = 'folks';
  mode: 'live' = 'live';

  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    const configured = (process.env.DEFI_FOLKS_API_URL || '').trim();
    if (!configured) {
      throw new Error('DEFI_FOLKS_API_URL is required for Folks live adapter');
    }
    this.baseUrl = configured.replace(/\/$/, '');
    this.apiKey = (process.env.DEFI_FOLKS_API_KEY || '').trim() || undefined;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async deploy(amount: number): Promise<DeFiDeployResponse> {
    const response = await fetch(`${this.baseUrl}/positions/deploy`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        amount,
        network: process.env.ALGORAND_NETWORK || 'testnet',
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Folks deploy failed: ${text}`);
    }

    const json = await response.json() as {
      protocol?: string;
      asset?: string;
      apy?: number;
      riskTier?: 'low' | 'medium' | 'high';
      externalPositionId?: string;
      providerTxId?: string;
    };

    return {
      opportunity: {
        protocol: json.protocol || 'Folks Finance',
        asset: json.asset || 'USDCa',
        apy: Number(json.apy || 0),
        riskTier: json.riskTier || 'low',
      },
      externalPositionId: json.externalPositionId,
      providerTxId: json.providerTxId,
    };
  }

  async harvest(positions: DeFiPositionRef[], vaultId?: string): Promise<DeFiHarvestResponse> {
    const response = await fetch(`${this.baseUrl}/positions/harvest`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        vaultId,
        externalPositionIds: positions
          .filter((p) => !vaultId || p.id === vaultId)
          .map((p) => p.externalPositionId)
          .filter(Boolean),
        network: process.env.ALGORAND_NETWORK || 'testnet',
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Folks harvest failed: ${text}`);
    }

    const json = await response.json() as {
      harvested?: number;
      providerTxId?: string;
    };

    return {
      harvested: Math.max(0, Number(json.harvested || 0)),
      providerTxId: json.providerTxId,
    };
  }
}

export function getDeFiRuntime() {
  const enabled = envFlag('DEFI_ENABLED', true);
  const liveMode = envFlag('DEFI_LIVE_MODE', false);
  const emergencyStop = envFlag('DEFI_EMERGENCY_STOP', false);
  const provider = (process.env.DEFI_PROVIDER || 'simulated').trim().toLowerCase();
  const maxDeployment = Number(process.env.DEFI_MAX_DEPLOYMENT_RUPEES || 50000);
  const minIdleBuffer = Number(process.env.DEFI_MIN_IDLE_BUFFER_RUPEES || 5000);

  return {
    enabled,
    liveMode,
    emergencyStop,
    provider,
    maxDeployment: Number.isFinite(maxDeployment) && maxDeployment > 0 ? maxDeployment : 50000,
    minIdleBuffer: Number.isFinite(minIdleBuffer) && minIdleBuffer >= 0 ? minIdleBuffer : 5000,
  };
}

export function getDeFiAdapter(): DeFiAdapter {
  const runtime = getDeFiRuntime();
  if (!runtime.enabled || runtime.emergencyStop || !runtime.liveMode) {
    return new SimulatedAdapter();
  }

  if (runtime.provider === 'folks') {
    return new FolksLiveAdapter();
  }

  return new SimulatedAdapter();
}
