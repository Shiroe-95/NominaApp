import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordConsent,
  getConsents,
  exportUserData,
  requestDeletion,
  cancelDeletion,
  processDeletion,
  getROPA,
  notifyBreach,
  DELETION_GRACE_PERIOD_DAYS,
  BREACH_NOTIFICATION_HOURS,
} from './gdpr-service';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

function createChain(terminal?: Record<string, unknown>) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(terminal ?? { data: null, error: null });
  // For non-single calls, resolve the chain itself
  (chain as Record<string, unknown>).then = undefined;
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

describe('GDPR constants', () => {
  it('should have 30-day grace period', () => {
    expect(DELETION_GRACE_PERIOD_DAYS).toBe(30);
  });

  it('should have 72-hour breach notification window', () => {
    expect(BREACH_NOTIFICATION_HOURS).toBe(72);
  });
});

// ─── recordConsent ──────────────────────────────────────────────────────────

describe('recordConsent', () => {
  it('should record consent and return id', async () => {
    const chain = createChain({ data: { id: 'consent-1' }, error: null });
    mockFromResults['gdpr_consent_log'] = chain;

    const id = await recordConsent('user-1', {
      consent_type: 'data_processing',
      policy_version: 'v2.0',
      granted: true,
    });

    expect(id).toBe('consent-1');
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      consent_type: 'data_processing',
      policy_version: 'v2.0',
      method: 'explicit_click',
      granted: true,
    });
  });

  it('should use custom method when provided', async () => {
    const chain = createChain({ data: { id: 'consent-2' }, error: null });
    mockFromResults['gdpr_consent_log'] = chain;

    await recordConsent(
      'user-1',
      { consent_type: 'analytics', policy_version: 'v1.0', granted: false },
      'sso_acceptance',
    );

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'sso_acceptance' }),
    );
  });

  it('should throw when user_id is empty', async () => {
    await expect(
      recordConsent('', { consent_type: 'data_processing', policy_version: 'v1', granted: true }),
    ).rejects.toThrow('user_id is required');
  });

  it('should throw on Supabase error', async () => {
    const chain = createChain({ data: null, error: { message: 'db error' } });
    mockFromResults['gdpr_consent_log'] = chain;

    await expect(
      recordConsent('user-1', { consent_type: 'marketing', policy_version: 'v1', granted: true }),
    ).rejects.toThrow('Failed to record consent');
  });
});

// ─── getConsents ────────────────────────────────────────────────────────────

describe('getConsents', () => {
  it('should return consent records ordered by most recent', async () => {
    const records = [
      { id: 'c2', user_id: 'u1', consent_type: 'analytics', created_at: '2024-02-01' },
      { id: 'c1', user_id: 'u1', consent_type: 'data_processing', created_at: '2024-01-01' },
    ];
    const chain = createChain();
    // Override order to resolve with data
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: records, error: null });
    mockFromResults['gdpr_consent_log'] = chain;

    const result = await getConsents('u1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c2');
  });

  it('should throw when user_id is empty', async () => {
    await expect(getConsents('')).rejects.toThrow('user_id is required');
  });
});

// ─── exportUserData ─────────────────────────────────────────────────────────

describe('exportUserData', () => {
  it('should export user profile, consents, and deletion requests', async () => {
    const profileChain = createChain({ data: { id: 'u1', email: 'test@example.com' }, error: null });
    const consentChain = createChain();
    (consentChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'c1' }],
      error: null,
    });
    const deletionChain = createChain();
    (deletionChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      error: null,
    });

    // The function calls from() three times for different tables
    let callCount = 0;
    vi.mocked(vi.fn()).mockClear();

    mockFromResults['user_profiles'] = profileChain;
    mockFromResults['gdpr_consent_log'] = consentChain;
    mockFromResults['gdpr_deletion_requests'] = deletionChain;

    const result = await exportUserData('u1');

    expect(result).toHaveProperty('exported_at');
    expect(result).toHaveProperty('user_profile');
    expect(result).toHaveProperty('consent_history');
    expect(result).toHaveProperty('deletion_requests');
  });

  it('should throw when user_id is empty', async () => {
    await expect(exportUserData('')).rejects.toThrow('user_id is required');
  });
});

// ─── requestDeletion ────────────────────────────────────────────────────────

describe('requestDeletion', () => {
  it('should create a pending deletion request with grace period', async () => {
    const now = new Date();
    const chain = createChain({
      data: {
        id: 'del-1',
        user_id: 'u1',
        status: 'pending',
        requested_at: now.toISOString(),
        grace_period_ends_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: null,
      },
      error: null,
    });
    mockFromResults['gdpr_deletion_requests'] = chain;

    const result = await requestDeletion('u1');

    expect(result.status).toBe('pending');
    expect(result.user_id).toBe('u1');
    expect(result.completed_at).toBeNull();
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        status: 'pending',
      }),
    );
  });

  it('should throw when user_id is empty', async () => {
    await expect(requestDeletion('')).rejects.toThrow('user_id is required');
  });
});

// ─── cancelDeletion ─────────────────────────────────────────────────────────

describe('cancelDeletion', () => {
  it('should cancel a pending deletion request', async () => {
    const chain = createChain({
      data: { id: 'del-1', status: 'cancelled', user_id: 'u1' },
      error: null,
    });
    mockFromResults['gdpr_deletion_requests'] = chain;

    const result = await cancelDeletion('del-1');
    expect(result.status).toBe('cancelled');
  });

  it('should throw when request_id is empty', async () => {
    await expect(cancelDeletion('')).rejects.toThrow('request_id is required');
  });
});

// ─── processDeletion ────────────────────────────────────────────────────────

describe('processDeletion', () => {
  it('should process expired pending requests', async () => {
    const pendingData = [
      { id: 'del-1', user_id: 'u1', status: 'pending', grace_period_ends_at: '2020-01-01' },
    ];

    // For gdpr_deletion_requests: first call is select (pending), then updates, then consent delete
    const deletionChain = createChain();
    (deletionChain.lte as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: pendingData,
      error: null,
    });
    // For update calls (processing, completed)
    (deletionChain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const consentChain = createChain();
    (consentChain.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFromResults['gdpr_deletion_requests'] = deletionChain;
    mockFromResults['gdpr_consent_log'] = consentChain;

    const count = await processDeletion();
    expect(count).toBe(1);
  });
});

// ─── getROPA ────────────────────────────────────────────────────────────────

describe('getROPA', () => {
  it('should return ROPA entries', () => {
    const ropa = getROPA();
    expect(ropa.length).toBeGreaterThan(0);
    for (const entry of ropa) {
      expect(entry).toHaveProperty('purpose');
      expect(entry).toHaveProperty('data_categories');
      expect(entry).toHaveProperty('recipients');
      expect(entry).toHaveProperty('international_transfers');
      expect(entry).toHaveProperty('retention_period');
      expect(entry.data_categories.length).toBeGreaterThan(0);
    }
  });

  it('should include payroll auditing purpose', () => {
    const ropa = getROPA();
    const payrollEntry = ropa.find((e) => e.purpose.includes('Payroll'));
    expect(payrollEntry).toBeDefined();
  });
});

// ─── notifyBreach ───────────────────────────────────────────────────────────

describe('notifyBreach', () => {
  it('should create a breach notification and log to audit trail', async () => {
    const auditChain = createChain();
    (auditChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    mockFromResults['audit_trail_extended'] = auditChain;

    const result = await notifyBreach({
      description: 'Unauthorized access detected',
      affected_data: ['employee_identification', 'salary_data'],
      affected_users_count: 50,
      measures_taken: ['Revoked compromised tokens', 'Notified affected users'],
    });

    expect(result.breach_id).toBeDefined();
    expect(result.description).toBe('Unauthorized access detected');
    expect(result.affected_data).toHaveLength(2);
    expect(result.affected_users_count).toBe(50);
    expect(result.notified_at).toBeDefined();
  });

  it('should throw when description is empty', async () => {
    await expect(
      notifyBreach({
        description: '',
        affected_data: ['email'],
        affected_users_count: 1,
        measures_taken: [],
      }),
    ).rejects.toThrow('description is required');
  });

  it('should throw when affected_data is empty', async () => {
    await expect(
      notifyBreach({
        description: 'Breach',
        affected_data: [],
        affected_users_count: 1,
        measures_taken: [],
      }),
    ).rejects.toThrow('affected_data must list at least one');
  });

  it('should throw when affected_users_count is negative', async () => {
    await expect(
      notifyBreach({
        description: 'Breach',
        affected_data: ['email'],
        affected_users_count: -1,
        measures_taken: [],
      }),
    ).rejects.toThrow('affected_users_count must be non-negative');
  });
});
