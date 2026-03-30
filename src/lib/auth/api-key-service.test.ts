import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateAPIKey,
  hashAPIKey,
  extractKeyPrefix,
  API_KEY_PREFIX,
  API_KEY_BYTE_LENGTH,
  createAPIKey,
  validateAPIKey,
  revokeAPIKey,
  listAPIKeys,
} from './api-key-service';

// ─── Mock Supabase ──────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ select: mockSelect })) }));
const mockEq = vi.fn();
const mockOrder = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    select: vi.fn(() => ({
      eq: mockEq,
    })),
    eq: vi.fn(() => ({
      order: mockOrder,
    })),
    order: mockOrder,
  })),
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}));

// ─── Pure function tests ────────────────────────────────────────────────────

describe('generateAPIKey', () => {
  it('returns a key with the nsk_ prefix', () => {
    const key = generateAPIKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('returns a key of expected length (prefix + 64 hex chars)', () => {
    const key = generateAPIKey();
    expect(key.length).toBe(API_KEY_PREFIX.length + API_KEY_BYTE_LENGTH * 2);
  });

  it('generates unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateAPIKey()));
    expect(keys.size).toBe(10);
  });
});

describe('hashAPIKey', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashAPIKey('nsk_abc123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces the same hash for the same input', () => {
    const key = generateAPIKey();
    expect(hashAPIKey(key)).toBe(hashAPIKey(key));
  });

  it('produces different hashes for different inputs', () => {
    const a = hashAPIKey('nsk_aaa');
    const b = hashAPIKey('nsk_bbb');
    expect(a).not.toBe(b);
  });
});

describe('extractKeyPrefix', () => {
  it('returns the last 8 characters of the key', () => {
    const key = 'nsk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    expect(extractKeyPrefix(key)).toBe('12345678');
  });
});

// ─── Service function tests (with mocked Supabase) ─────────────────────────

describe('createAPIKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if workspace_id is empty', async () => {
    await expect(createAPIKey('', 'user-1', { name: 'test', permissions: ['read'] }))
      .rejects.toThrow('workspace_id is required');
  });

  it('throws if user_id is empty', async () => {
    await expect(createAPIKey('ws-1', '', { name: 'test', permissions: ['read'] }))
      .rejects.toThrow('user_id is required');
  });
});

describe('validateAPIKey', () => {
  it('returns not_found for empty key', async () => {
    const result = await validateAPIKey('');
    expect(result).toEqual({ valid: false, apiKey: null, reason: 'not_found' });
  });
});

describe('revokeAPIKey', () => {
  it('throws if api_key_id is empty', async () => {
    await expect(revokeAPIKey('')).rejects.toThrow('api_key_id is required');
  });
});

describe('listAPIKeys', () => {
  it('throws if workspace_id is empty', async () => {
    await expect(listAPIKeys('')).rejects.toThrow('workspace_id is required');
  });
});
