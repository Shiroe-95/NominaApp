import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDataRegion,
  setDataRegion,
  verifyResidency,
  confirmTransfer,
  VALID_REGIONS,
  REGION_INFO,
} from './data-residency-service';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function createChain(terminal?: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(terminal ?? { data: null, error: null });
  return chain;
}

let mockFromResults: Record<string, ReturnType<typeof createChain>>;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      return mockFromResults[table] ?? createChain();
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFromResults = {};
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe('VALID_REGIONS', () => {
  it('should contain na, sa, eu, ap', () => {
    expect(VALID_REGIONS).toEqual(['na', 'sa', 'eu', 'ap']);
  });
});

describe('REGION_INFO', () => {
  it('should have metadata for all valid regions', () => {
    for (const region of VALID_REGIONS) {
      expect(REGION_INFO[region]).toBeDefined();
      expect(REGION_INFO[region].name).toBeTruthy();
      expect(REGION_INFO[region].location).toBeTruthy();
      expect(REGION_INFO[region].certifications.length).toBeGreaterThan(0);
    }
  });

  it('eu region should include GDPR certification', () => {
    expect(REGION_INFO.eu.certifications).toContain('GDPR Compliant');
  });

  it('sa region should include LGPD certification', () => {
    expect(REGION_INFO.sa.certifications).toContain('LGPD Compliant');
  });
});

// ─── getDataRegion ──────────────────────────────────────────────────────────

describe('getDataRegion', () => {
  it('should return residency info for a workspace', async () => {
    const chain = createChain({
      data: { id: 'ws-1', data_region: 'eu' },
      error: null,
    });
    mockFromResults['workspaces'] = chain;

    const result = await getDataRegion('ws-1');

    expect(result.workspace_id).toBe('ws-1');
    expect(result.data_region).toBe('eu');
    expect(result.region_name).toBe('Europe');
    expect(result.region_location).toBe('Frankfurt, Germany');
    expect(result.certifications).toContain('GDPR Compliant');
  });

  it('should throw when workspace_id is empty', async () => {
    await expect(getDataRegion('')).rejects.toThrow('workspace_id is required');
  });

  it('should throw on Supabase error', async () => {
    const chain = createChain({ data: null, error: { message: 'not found' } });
    mockFromResults['workspaces'] = chain;

    await expect(getDataRegion('ws-bad')).rejects.toThrow('Failed to get data region');
  });
});

// ─── setDataRegion ──────────────────────────────────────────────────────────

describe('setDataRegion', () => {
  it('should update workspace region and return info', async () => {
    const chain = createChain({
      data: { id: 'ws-1', data_region: 'ap' },
      error: null,
    });
    mockFromResults['workspaces'] = chain;

    const result = await setDataRegion('ws-1', 'ap');

    expect(result.data_region).toBe('ap');
    expect(result.region_name).toBe('Asia-Pacific');
    expect(chain.update).toHaveBeenCalledWith({ data_region: 'ap' });
  });

  it('should throw for invalid region', async () => {
    await expect(
      setDataRegion('ws-1', 'xx' as never),
    ).rejects.toThrow('Invalid region');
  });

  it('should throw when workspace_id is empty', async () => {
    await expect(setDataRegion('', 'na')).rejects.toThrow('workspace_id is required');
  });
});

// ─── verifyResidency ────────────────────────────────────────────────────────

describe('verifyResidency', () => {
  it('should return true when region matches', async () => {
    const chain = createChain({
      data: { id: 'ws-1', data_region: 'sa' },
      error: null,
    });
    mockFromResults['workspaces'] = chain;

    const result = await verifyResidency('ws-1', 'sa');
    expect(result).toBe(true);
  });

  it('should return false when region does not match', async () => {
    const chain = createChain({
      data: { id: 'ws-1', data_region: 'eu' },
      error: null,
    });
    mockFromResults['workspaces'] = chain;

    const result = await verifyResidency('ws-1', 'na');
    expect(result).toBe(false);
  });

  it('should throw for invalid expected region', async () => {
    await expect(
      verifyResidency('ws-1', 'zz' as never),
    ).rejects.toThrow('Invalid region');
  });
});

// ─── confirmTransfer ────────────────────────────────────────────────────────

describe('confirmTransfer', () => {
  it('should transfer region and return confirmation with regulatory notice', async () => {
    // getDataRegion call
    const wsChain = createChain({
      data: { id: 'ws-1', data_region: 'sa' },
      error: null,
    });
    // setDataRegion call (update)
    const updateChain = createChain({
      data: { id: 'ws-1', data_region: 'eu' },
      error: null,
    });
    const auditChain = createChain();
    (auditChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    // The function calls from('workspaces') twice (get + set) and from('audit_trail_extended') once
    let wsCallCount = 0;
    vi.clearAllMocks();
    mockFromResults = {};

    // We need to handle multiple calls to the same table
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'workspaces') {
        wsCallCount++;
        // First call is getDataRegion (select), second is setDataRegion (update)
        return wsCallCount === 1 ? wsChain : updateChain;
      }
      if (table === 'audit_trail_extended') {
        return auditChain;
      }
      return createChain();
    });

    vi.mocked(vi.fn()).mockClear();
    // Re-mock with custom from
    const { createAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const result = await confirmTransfer('ws-1', 'eu');

    expect(result.from_region).toBe('sa');
    expect(result.to_region).toBe('eu');
    expect(result.regulatory_notice).toContain('South America');
    expect(result.regulatory_notice).toContain('Europe');
    expect(result.confirmed_at).toBeDefined();
  });

  it('should throw when source and target regions are the same', async () => {
    const chain = createChain({
      data: { id: 'ws-1', data_region: 'eu' },
      error: null,
    });
    mockFromResults['workspaces'] = chain;

    await expect(confirmTransfer('ws-1', 'eu')).rejects.toThrow(
      'Source and target regions are the same',
    );
  });

  it('should throw for invalid target region', async () => {
    await expect(
      confirmTransfer('ws-1', 'xx' as never),
    ).rejects.toThrow('Invalid target region');
  });

  it('should throw when workspace_id is empty', async () => {
    await expect(confirmTransfer('', 'eu')).rejects.toThrow('workspace_id is required');
  });
});
