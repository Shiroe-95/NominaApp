import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { APIKeyCreateSchema, type APIKeyCreateInput } from '@/lib/schemas/world-class-schemas';

/**
 * APIKeyService — Create, validate, revoke, and list API keys.
 *
 * Keys are generated as random hex strings. Only the SHA-256 hash is persisted;
 * the full key is returned exactly once at creation time.
 *
 * Requirements: 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7
 *
 * @module lib/auth/api-key-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Byte length of the random key (32 bytes → 64 hex chars) */
export const API_KEY_BYTE_LENGTH = 32;

/** Prefix added to every generated key for easy identification */
export const API_KEY_PREFIX = 'nsk_';

/** Valid permission scopes (Req 38.1) */
export type APIKeyPermission = 'read' | 'write' | 'admin';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIKeyRow {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  expires_at: string | null;
  last_used_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export interface APIKeyCreateResult {
  apiKey: APIKeyRow;
  /** The full key — shown only once (Req 38.2) */
  fullKey: string;
}

export interface APIKeyValidationResult {
  valid: boolean;
  apiKey: APIKeyRow | null;
  reason?: 'not_found' | 'expired' | 'revoked';
}

// ─── Crypto Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random API key string.
 * Format: `nsk_<64 hex chars>`
 */
export function generateAPIKey(): string {
  const raw = randomBytes(API_KEY_BYTE_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${raw}`;
}

/**
 * Compute the SHA-256 hash of an API key (Req 38.2).
 */
export function hashAPIKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract a display-safe prefix from a full key.
 * Returns the last 8 characters so admins can identify keys (Req 38.7).
 */
export function extractKeyPrefix(key: string): string {
  return key.slice(-8);
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Create a new API key for a workspace.
 *
 * Req 38.1: admin/analyst can create keys with name, permissions, optional expiry.
 * Req 38.2: full key shown once; only SHA-256 hash stored.
 */
export async function createAPIKey(
  workspaceId: string,
  userId: string,
  input: APIKeyCreateInput,
): Promise<APIKeyCreateResult> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!userId) throw new Error('user_id is required');

  const parsed = APIKeyCreateSchema.parse(input);
  const fullKey = generateAPIKey();
  const keyHash = hashAPIKey(fullKey);
  const keyPrefix = extractKeyPrefix(fullKey);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: parsed.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: parsed.permissions,
      expires_at: parsed.expires_at ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return { apiKey: data as APIKeyRow, fullKey };
}

/**
 * Validate an incoming API key.
 *
 * Req 38.3: accept Bearer token, hash it, look up by hash.
 * Checks expiration and revocation status.
 */
export async function validateAPIKey(key: string): Promise<APIKeyValidationResult> {
  if (!key) return { valid: false, apiKey: null, reason: 'not_found' };

  const keyHash = hashAPIKey(key);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return { valid: false, apiKey: null, reason: 'not_found' };
  }

  const apiKey = data as APIKeyRow;

  // Check revocation (Req 38.5)
  if (apiKey.is_revoked) {
    return { valid: false, apiKey, reason: 'revoked' };
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, apiKey, reason: 'expired' };
  }

  // Update last_used_at (Req 38.4) — fire-and-forget
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then();

  return { valid: true, apiKey };
}

/**
 * Revoke an API key immediately (Req 38.5).
 */
export async function revokeAPIKey(apiKeyId: string): Promise<APIKeyRow> {
  if (!apiKeyId) throw new Error('api_key_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_keys')
    .update({ is_revoked: true })
    .eq('id', apiKeyId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }

  return data as APIKeyRow;
}

/**
 * List all API keys for a workspace (Req 38.4).
 * Returns keys ordered by creation date (newest first).
 * The key_hash is included but the full key is never retrievable.
 */
export async function listAPIKeys(workspaceId: string): Promise<APIKeyRow[]> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return (data ?? []) as APIKeyRow[];
}
