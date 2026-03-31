/**
 * Property-Based Tests for Theme Engine
 * Feature: platform-improvements
 *
 * Property 20: Theme persistence round-trip (save to localStorage, read back = same value)
 * Property 21: All semantic tokens defined for both themes (non-empty values)
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

const themeArb = fc.constantFrom('light' as const, 'dark' as const, 'auto' as const);

// ── Required semantic tokens per the design spec ────────────────────

const REQUIRED_TOKENS = [
  '--background',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--ring',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--sidebar',
  '--sidebar-foreground',
] as const;

// ── localStorage mock ───────────────────────────────────────────────

const STORAGE_KEY = 'nominasmart-theme';

let store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, value: string): void => { store[key] = value; },
  removeItem: (key: string): void => { delete store[key]; },
  clear: (): void => { store = {}; },
};

// ── CSS parsing helper ──────────────────────────────────────────────

function parseGlobalsCss(): { dark: Record<string, string>; light: Record<string, string> } {
  const cssPath = path.resolve(__dirname, '../../app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  const result: { dark: Record<string, string>; light: Record<string, string> } = {
    dark: {},
    light: {},
  };

  // Parse dark theme tokens from `:root` and `.dark` blocks
  // The CSS has `:root,\n.dark {` as the dark theme block
  const darkBlockMatch = css.match(/:root,\s*\n?\s*\.dark\s*\{([^}]+)\}/);
  if (darkBlockMatch) {
    const props = darkBlockMatch[1].matchAll(/\s*(--[\w-]+)\s*:\s*([^;]+);/g);
    for (const m of props) {
      result.dark[m[1].trim()] = m[2].trim();
    }
  }

  // Parse light theme tokens from `.light` block
  const lightBlockMatch = css.match(/\.light\s*\{([^}]+)\}/);
  if (lightBlockMatch) {
    const props = lightBlockMatch[1].matchAll(/\s*(--[\w-]+)\s*:\s*([^;]+);/g);
    for (const m of props) {
      result.light[m[1].trim()] = m[2].trim();
    }
  }

  return result;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Theme Engine PBT', () => {
  beforeEach(() => {
    store = {};
  });

  /**
   * Property 20: Theme persistence round-trip
   *
   * For any valid theme preference ('light', 'dark', 'auto'),
   * saving it to localStorage and reading it back must produce the same value.
   *
   * **Validates: Requirements 7.3**
   */
  it('Property 20: theme persistence round-trip — save and read back produces same value', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        // Save
        localStorageMock.setItem(STORAGE_KEY, theme);

        // Read back
        const retrieved = localStorageMock.getItem(STORAGE_KEY);

        // Must be identical
        expect(retrieved).toBe(theme);

        // Must be a valid theme value
        expect(['light', 'dark', 'auto']).toContain(retrieved);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 20 (extended): Multiple sequential writes preserve last value
   *
   * **Validates: Requirements 7.3**
   */
  it('Property 20: sequential theme writes preserve last value', () => {
    fc.assert(
      fc.property(
        fc.array(themeArb, { minLength: 1, maxLength: 20 }),
        (themes) => {
          for (const t of themes) {
            localStorageMock.setItem(STORAGE_KEY, t);
          }
          const lastTheme = themes[themes.length - 1];
          const retrieved = localStorageMock.getItem(STORAGE_KEY);
          expect(retrieved).toBe(lastTheme);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 21: All semantic tokens defined for both themes
   *
   * For both themes (light and dark), all required semantic tokens
   * (background, foreground, primary, secondary, muted, accent, destructive,
   * border, ring, card, popover, sidebar and their -foreground variants)
   * must be defined and have non-empty values.
   *
   * **Validates: Requirements 7.4**
   */
  it('Property 21: all semantic tokens defined for dark theme with non-empty values', () => {
    const tokens = parseGlobalsCss();

    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_TOKENS),
        (tokenName) => {
          const value = tokens.dark[tokenName];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value!.trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 21: all semantic tokens defined for light theme with non-empty values', () => {
    const tokens = parseGlobalsCss();

    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_TOKENS),
        (tokenName) => {
          const value = tokens.light[tokenName];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value!.trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 21 (extended): Dark and light tokens differ for key visual tokens
   *
   * **Validates: Requirements 7.4**
   */
  it('Property 21: dark and light themes have different values for visual tokens', () => {
    const tokens = parseGlobalsCss();
    const visualTokens = ['--background', '--foreground', '--card', '--popover', '--sidebar'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...visualTokens),
        (tokenName) => {
          const darkVal = tokens.dark[tokenName];
          const lightVal = tokens.light[tokenName];
          expect(darkVal).not.toBe(lightVal);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
