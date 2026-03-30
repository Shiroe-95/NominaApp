/**
 * Minimal type declarations for Node.js built-ins.
 * These are only needed when node_modules/@types/node is not installed.
 * Once `npm install` is run, @types/node will provide full declarations.
 */

// ─── Global Node.js types ───────────────────────────────────────────────────

declare var process: {
  env: Record<string, string | undefined>;
  [key: string]: unknown;
};

declare var global: typeof globalThis;
declare module 'crypto' {
  export function createHash(algorithm: string): Hash;
  export function createHmac(algorithm: string, key: string | Buffer): Hmac;
  export function randomBytes(size: number): Buffer;
  export function randomUUID(): string;
  export function timingSafeEqual(a: Buffer, b: Buffer): boolean;

  interface Hash {
    update(data: string | Buffer): Hash;
    digest(encoding: 'hex' | 'base64' | 'binary'): string;
    digest(): Buffer;
  }

  interface Hmac {
    update(data: string | Buffer): Hmac;
    digest(encoding: 'hex' | 'base64' | 'binary'): string;
    digest(): Buffer;
  }

  export function createCipheriv(
    algorithm: string,
    key: Buffer,
    iv: Buffer,
  ): CipherGCM;

  export function createDecipheriv(
    algorithm: string,
    key: Buffer,
    iv: Buffer,
  ): DecipherGCM;

  interface CipherGCM {
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(outputEncoding: string): string;
    getAuthTag(): Buffer;
  }

  interface DecipherGCM {
    setAuthTag(tag: Buffer): this;
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(outputEncoding: string): string;
  }
}
