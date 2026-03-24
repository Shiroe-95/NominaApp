/**
 * Feature: dashboard-redesign, Property 1: Conteo de proveedores coincide con datos de entrada
 *
 * *For any* array of providers with varied active/inactive states, the summary
 * rendered by `ProviderStatusPanel` must show a total count equal to the array
 * length and an active count equal to the number of providers with
 * `isActive === true`.
 *
 * **Validates: Requirements 1.1**
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { ProviderStatusPanel } from './ProviderStatusPanel';
import type { ProviderSummary } from '@/lib/types/pipeline';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string, params?: Record<string, unknown>) => {
      if (key === 'count' && params) {
        return `${params.total} total, ${params.active} active`;
      }
      return key;
    };
  },
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'alert-icon', ...props }),
  Settings: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'settings-icon', ...props }),
  Cpu: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'cpu-icon', ...props }),
}));

// ── Generators ──────────────────────────────────────────────────────

const PROVIDER_TYPES = ['openai', 'anthropic', 'groq', 'google', 'openrouter'] as const;

const arbProviderSummary: fc.Arbitrary<ProviderSummary> = fc.record({
  id: fc.uuid(),
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  providerType: fc.constantFrom(...PROVIDER_TYPES),
  isActive: fc.boolean(),
  lastTestSuccess: fc.oneof(fc.constant(true), fc.constant(false), fc.constant(null)),
});

const arbNonEmptyProviders: fc.Arbitrary<ProviderSummary[]> = fc.array(arbProviderSummary, {
  minLength: 1,
  maxLength: 20,
});

const arbProviders: fc.Arbitrary<ProviderSummary[]> = fc.array(arbProviderSummary, {
  minLength: 0,
  maxLength: 20,
});

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 1: Conteo de proveedores coincide con datos de entrada', () => {
  afterEach(() => {
    cleanup();
  });

  it('(a) rendered count text contains the correct total (providers.length)', () => {
    fc.assert(
      fc.property(arbNonEmptyProviders, (providers) => {
        const { getByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        const countEl = getByTestId('provider-count');
        const text = countEl.textContent ?? '';

        expect(text).toContain(`${providers.length} total`);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(b) rendered count text contains the correct active count', () => {
    fc.assert(
      fc.property(arbNonEmptyProviders, (providers) => {
        const expectedActive = providers.filter((p) => p.isActive).length;

        const { getByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        const countEl = getByTestId('provider-count');
        const text = countEl.textContent ?? '';

        expect(text).toContain(`${expectedActive} active`);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(c) when providers array is empty, the empty state is shown instead of the count', () => {
    fc.assert(
      fc.property(fc.constant([] as ProviderSummary[]), (providers) => {
        const { queryByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        expect(queryByTestId('provider-empty-state')).not.toBeNull();
        expect(queryByTestId('provider-count')).toBeNull();

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: dashboard-redesign, Property 2: Renderizado completo de información de proveedores
 *
 * *For any* non-empty list of providers, the `ProviderStatusPanel` must render
 * for each provider its name (`displayName`), type (`providerType`) and status
 * (`isActive`).
 *
 * **Validates: Requirements 1.4**
 */

describe('Property 2: Renderizado completo de información de proveedores', () => {
  afterEach(() => {
    cleanup();
  });

  it('(a) each provider has a rendered item element with data-testid="provider-item-{id}"', () => {
    fc.assert(
      fc.property(arbNonEmptyProviders, (providers) => {
        const { getByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        for (const provider of providers) {
          const item = getByTestId(`provider-item-${provider.id}`);
          expect(item).toBeTruthy();
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(b) each provider item contains the displayName text', () => {
    fc.assert(
      fc.property(arbNonEmptyProviders, (providers) => {
        const { getByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        for (const provider of providers) {
          const item = getByTestId(`provider-item-${provider.id}`);
          expect(item.textContent).toContain(provider.displayName);
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(c) each provider item contains the providerType text', () => {
    fc.assert(
      fc.property(arbNonEmptyProviders, (providers) => {
        const { getByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        for (const provider of providers) {
          const item = getByTestId(`provider-item-${provider.id}`);
          expect(item.textContent).toContain(provider.providerType);
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: dashboard-redesign, Property 3: Alerta visual para proveedores con test fallido
 *
 * *For any* list of providers where some have `lastTestSuccess === false`, the
 * `ProviderStatusPanel` must show an alert indicator only next to providers
 * whose last test failed, and not next to those with `lastTestSuccess === true`
 * or `null`.
 *
 * **Validates: Requirements 1.5**
 */

// ── Generator: at least one provider with lastTestSuccess === false ──

const arbProviderWithTestStatus = (
  testStatus: boolean | null,
): fc.Arbitrary<ProviderSummary> =>
  fc.record({
    id: fc.uuid(),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    providerType: fc.constantFrom(...PROVIDER_TYPES),
    isActive: fc.boolean(),
    lastTestSuccess: fc.constant(testStatus),
  });

/**
 * Generate a mixed list of providers where at least one has
 * `lastTestSuccess === false` and the rest have varied values.
 */
const arbMixedProviders: fc.Arbitrary<ProviderSummary[]> = fc
  .tuple(
    fc.array(arbProviderWithTestStatus(false), { minLength: 1, maxLength: 8 }),
    fc.array(arbProviderWithTestStatus(true), { minLength: 0, maxLength: 6 }),
    fc.array(arbProviderWithTestStatus(null), { minLength: 0, maxLength: 6 }),
  )
  .chain(([failed, passed, unknown]) =>
    fc.shuffledSubarray([...failed, ...passed, ...unknown], {
      minLength: failed.length + passed.length + unknown.length,
      maxLength: failed.length + passed.length + unknown.length,
    }),
  );

describe('Property 3: Alerta visual para proveedores con test fallido', () => {
  afterEach(() => {
    cleanup();
  });

  it('(a) providers with lastTestSuccess === false have an alert element with data-testid="provider-alert-{id}"', () => {
    fc.assert(
      fc.property(arbMixedProviders, (providers) => {
        const { queryByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        const failedProviders = providers.filter(
          (p) => p.lastTestSuccess === false,
        );

        for (const provider of failedProviders) {
          const alertEl = queryByTestId(`provider-alert-${provider.id}`);
          expect(alertEl).not.toBeNull();
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(b) providers with lastTestSuccess === true do NOT have an alert element', () => {
    fc.assert(
      fc.property(arbMixedProviders, (providers) => {
        const { queryByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        const passedProviders = providers.filter(
          (p) => p.lastTestSuccess === true,
        );

        for (const provider of passedProviders) {
          const alertEl = queryByTestId(`provider-alert-${provider.id}`);
          expect(alertEl).toBeNull();
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(c) providers with lastTestSuccess === null do NOT have an alert element', () => {
    fc.assert(
      fc.property(arbMixedProviders, (providers) => {
        const { queryByTestId } = render(
          React.createElement(ProviderStatusPanel, { providers }),
        );

        const unknownProviders = providers.filter(
          (p) => p.lastTestSuccess === null,
        );

        for (const provider of unknownProviders) {
          const alertEl = queryByTestId(`provider-alert-${provider.id}`);
          expect(alertEl).toBeNull();
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
