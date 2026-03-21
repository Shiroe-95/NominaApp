import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the ENCRYPTION_KEY env var.
 * If the env var is already 32 bytes hex-encoded (64 chars), use it directly.
 * Otherwise, hash it to get a consistent 32-byte key.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // If it's a 64-char hex string, decode directly to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Otherwise, use a SHA-256 hash to derive a 32-byte key
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 * Returns a base64 string with format: IV (12 bytes) + authTag (16 bytes) + ciphertext.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: IV + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypts an API key previously encrypted with encryptApiKey.
 * Expects a base64 string with format: IV (12 bytes) + authTag (16 bytes) + ciphertext.
 */
export function decryptApiKey(encrypted: string): string {
  const key = getKey();
  const packed = Buffer.from(encrypted, 'base64');

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
