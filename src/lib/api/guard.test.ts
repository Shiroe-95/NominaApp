/**
 * Unit tests for API guard functions.
 *
 * Validates: Requirements 16.1, 16.7
 *
 * Tests verify:
 * - requireAuth() returns 401 without valid Supabase session
 * - requireAuth() returns { userId } with valid session
 * - requireAuthWithRole() returns AuthContext with role from user_profiles
 * - requireAdmin() returns 403 if role is not admin
 * - requireAnalystOrAdmin() returns 403 if role is client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock Supabase server client (createClient from @/lib/supabase/server)
const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock Supabase admin client
const mockAdminSelect = vi.fn();
const mockAdminEq = vi.fn();
const mockAdminSingle = vi.fn();

const mockAdminClient = {
  from: vi.fn(() => ({
    select: mockAdminSelect,
  })),
};

mockAdminSelect.mockReturnValue({ eq: mockAdminEq });
mockAdminEq.mockReturnValue({ single: mockAdminSingle });

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// Mock rate-limit module
vi.mock('./rate-limit', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, resetAt: 0 })),
  checkRateLimitSync: vi.fn(() => ({ allowed: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  RATE_LIMITS: {
    read: { limit: 60, windowSeconds: 60 },
    write: { limit: 40, windowSeconds: 60 },
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  requireAuth,
  requireAuthWithRole,
  requireAdmin,
  requireAnalystOrAdmin,
} from './guard';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

async function getResponseStatus(value: unknown): Promise<number | null> {
  if (isNextResponse(value)) return value.status;
  return null;
}

function setupAuthenticatedUser(userId: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function setupUnauthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'No session' },
  });
}

function setupUserProfile(role: 'admin' | 'analyst' | 'client') {
  mockAdminSingle.mockResolvedValue({
    data: { role },
    error: null,
  });
}

function setupNoProfile() {
  mockAdminSingle.mockResolvedValue({
    data: null,
    error: { message: 'Not found' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSelect.mockReturnValue({ eq: mockAdminEq });
    mockAdminEq.mockReturnValue({ single: mockAdminSingle });
  });

  it('should return 401 when no session exists', async () => {
    setupUnauthenticatedUser();

    const result = await requireAuth();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(401);
  });

  it('should return 401 when getUser throws an error', async () => {
    mockGetUser.mockRejectedValue(new Error('Network error'));

    const result = await requireAuth();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(401);
  });

  it('should return { userId } when session is valid', async () => {
    setupAuthenticatedUser('user-123');

    const result = await requireAuth();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-123' });
  });
});

describe('requireAuthWithRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSelect.mockReturnValue({ eq: mockAdminEq });
    mockAdminEq.mockReturnValue({ single: mockAdminSingle });
  });

  it('should return 401 when no session exists', async () => {
    setupUnauthenticatedUser();

    const result = await requireAuthWithRole();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(401);
  });

  it('should return AuthContext with role from user_profiles', async () => {
    setupAuthenticatedUser('user-456');
    setupUserProfile('analyst');

    const result = await requireAuthWithRole();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-456', role: 'analyst' });
  });

  it('should default to client role when no profile exists', async () => {
    setupAuthenticatedUser('user-789');
    setupNoProfile();

    const result = await requireAuthWithRole();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-789', role: 'client' });
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSelect.mockReturnValue({ eq: mockAdminEq });
    mockAdminEq.mockReturnValue({ single: mockAdminSingle });
  });

  it('should return 401 when no session exists', async () => {
    setupUnauthenticatedUser();

    const result = await requireAdmin();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(401);
  });

  it('should return 403 when role is analyst', async () => {
    setupAuthenticatedUser('user-100');
    setupUserProfile('analyst');

    const result = await requireAdmin();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(403);
  });

  it('should return 403 when role is client', async () => {
    setupAuthenticatedUser('user-101');
    setupUserProfile('client');

    const result = await requireAdmin();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(403);
  });

  it('should return AuthContext when role is admin', async () => {
    setupAuthenticatedUser('user-102');
    setupUserProfile('admin');

    const result = await requireAdmin();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-102', role: 'admin' });
  });
});

describe('requireAnalystOrAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSelect.mockReturnValue({ eq: mockAdminEq });
    mockAdminEq.mockReturnValue({ single: mockAdminSingle });
  });

  it('should return 401 when no session exists', async () => {
    setupUnauthenticatedUser();

    const result = await requireAnalystOrAdmin();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(401);
  });

  it('should return 403 when role is client', async () => {
    setupAuthenticatedUser('user-200');
    setupUserProfile('client');

    const result = await requireAnalystOrAdmin();

    expect(isNextResponse(result)).toBe(true);
    expect(await getResponseStatus(result)).toBe(403);
  });

  it('should return AuthContext when role is analyst', async () => {
    setupAuthenticatedUser('user-201');
    setupUserProfile('analyst');

    const result = await requireAnalystOrAdmin();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-201', role: 'analyst' });
  });

  it('should return AuthContext when role is admin', async () => {
    setupAuthenticatedUser('user-202');
    setupUserProfile('admin');

    const result = await requireAnalystOrAdmin();

    expect(isNextResponse(result)).toBe(false);
    expect(result).toEqual({ userId: 'user-202', role: 'admin' });
  });
});


// ─── Sanitization function tests ────────────────────────────────────────────
// Validates: Requirements 16.6

import {
  isValidUuid,
  isValidCountryCode,
  sanitizeString,
  sanitizeEmail,
  sanitizeNumber,
  sanitizeStringArray,
  UuidSchema,
  EmailSchema,
  CountryCodeSchema,
} from './guard';

describe('isValidUuid', () => {
  it('should accept valid UUID v4', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    expect(isValidUuid('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});

describe('isValidCountryCode', () => {
  it('should accept valid ISO 3166-1 alpha-2 codes', () => {
    expect(isValidCountryCode('CO')).toBe(true);
    expect(isValidCountryCode('US')).toBe(true);
    expect(isValidCountryCode('MX')).toBe(true);
  });

  it('should accept lowercase (converts to uppercase internally)', () => {
    expect(isValidCountryCode('co')).toBe(true);
    expect(isValidCountryCode('us')).toBe(true);
  });

  it('should reject invalid country codes', () => {
    expect(isValidCountryCode('')).toBe(false);
    expect(isValidCountryCode('A')).toBe(false);
    expect(isValidCountryCode('ABC')).toBe(false);
    expect(isValidCountryCode('12')).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should limit length to maxLength', () => {
    expect(sanitizeString('abcdef', 3)).toBe('abc');
  });

  it('should use default maxLength of 500', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeString(long)).toHaveLength(500);
  });

  it('should remove control characters but keep newlines and tabs', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
    expect(sanitizeString('hello\nworld')).toBe('hello\nworld');
    expect(sanitizeString('hello\tworld')).toBe('hello\tworld');
  });

  it('should return empty string for non-string values', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(123)).toBe('');
    expect(sanitizeString({})).toBe('');
  });
});

describe('sanitizeEmail', () => {
  it('should accept valid emails and lowercase them', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should reject emails without TLD >= 2 chars', () => {
    expect(sanitizeEmail('user@example.c')).toBeNull();
  });

  it('should reject invalid email formats', () => {
    expect(sanitizeEmail('')).toBeNull();
    expect(sanitizeEmail('not-an-email')).toBeNull();
    expect(sanitizeEmail('@example.com')).toBeNull();
    expect(sanitizeEmail('user@')).toBeNull();
    expect(sanitizeEmail('user@.com')).toBeNull();
  });

  it('should return null for non-string values', () => {
    expect(sanitizeEmail(null)).toBeNull();
    expect(sanitizeEmail(123)).toBeNull();
    expect(sanitizeEmail(undefined)).toBeNull();
  });

  it('should truncate to 254 chars max', () => {
    const longLocal = 'a'.repeat(250);
    expect(sanitizeEmail(`${longLocal}@example.com`)).toBeNull();
  });
});

describe('sanitizeNumber', () => {
  it('should parse valid numbers', () => {
    expect(sanitizeNumber(42)).toBe(42);
    expect(sanitizeNumber('3.14')).toBe(3.14);
    expect(sanitizeNumber(0)).toBe(0);
  });

  it('should reject non-finite values', () => {
    expect(sanitizeNumber(NaN)).toBeNull();
    expect(sanitizeNumber(Infinity)).toBeNull();
    expect(sanitizeNumber(-Infinity)).toBeNull();
    expect(sanitizeNumber('abc')).toBeNull();
  });

  it('should enforce min/max range', () => {
    expect(sanitizeNumber(5, 1, 10)).toBe(5);
    expect(sanitizeNumber(0, 1, 10)).toBeNull();
    expect(sanitizeNumber(11, 1, 10)).toBeNull();
  });

  it('should work with only min or only max', () => {
    expect(sanitizeNumber(-1, 0)).toBeNull();
    expect(sanitizeNumber(100, undefined, 50)).toBeNull();
    expect(sanitizeNumber(25, undefined, 50)).toBe(25);
  });
});

describe('sanitizeStringArray', () => {
  it('should sanitize an array of strings', () => {
    expect(sanitizeStringArray(['  hello  ', '  world  '])).toEqual(['hello', 'world']);
  });

  it('should filter out non-string items', () => {
    expect(sanitizeStringArray(['a', 123, null, 'b'])).toEqual(['a', 'b']);
  });

  it('should limit number of items', () => {
    const arr = Array.from({ length: 10 }, (_, i) => `item${i}`);
    expect(sanitizeStringArray(arr, 3)).toHaveLength(3);
  });

  it('should limit item length', () => {
    expect(sanitizeStringArray(['abcdef'], 100, 3)).toEqual(['abc']);
  });

  it('should return empty array for non-array values', () => {
    expect(sanitizeStringArray(null)).toEqual([]);
    expect(sanitizeStringArray('string')).toEqual([]);
    expect(sanitizeStringArray(123)).toEqual([]);
  });
});

describe('Zod Schemas', () => {
  it('UuidSchema should validate correct UUIDs', () => {
    expect(UuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('UuidSchema should reject invalid UUIDs', () => {
    expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('EmailSchema should validate correct emails', () => {
    expect(EmailSchema.safeParse('user@example.com').success).toBe(true);
  });

  it('EmailSchema should reject invalid emails', () => {
    expect(EmailSchema.safeParse('invalid').success).toBe(false);
  });

  it('CountryCodeSchema should validate correct codes', () => {
    expect(CountryCodeSchema.safeParse('CO').success).toBe(true);
    expect(CountryCodeSchema.safeParse('US').success).toBe(true);
  });

  it('CountryCodeSchema should reject invalid codes', () => {
    expect(CountryCodeSchema.safeParse('co').success).toBe(false);
    expect(CountryCodeSchema.safeParse('ABC').success).toBe(false);
  });
});
