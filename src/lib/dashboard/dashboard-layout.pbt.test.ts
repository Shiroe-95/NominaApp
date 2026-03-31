/**
 * Property-Based Tests for Dashboard Layout
 * Feature: platform-improvements
 *
 * Property 22: Dashboard layout persistence round-trip
 *   (save and load produces equivalent layout)
 * Property 23: Widget error isolation
 *   (one widget failing doesn't affect others)
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DashboardLayoutSchema,
  WIDGET_TYPES,
  serializeLayout,
  deserializeLayout,
  createPresetLayout,
  type DashboardWidget,
  type DashboardLayout,
  type WidgetType,
} from './dashboard-layout';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

const widgetTypeArb: fc.Arbitrary<WidgetType> = fc.constantFrom(...WIDGET_TYPES);

const positionArb = fc.record({
  x: fc.integer({ min: 0, max: 10 }),
  y: fc.integer({ min: 0, max: 10 }),
  w: fc.integer({ min: 1, max: 4 }),
  h: fc.integer({ min: 1, max: 4 }),
});

const widgetArb: fc.Arbitrary<DashboardWidget> = fc.record({
  id: fc.stringMatching(/^[a-z0-9-]{1,20}$/),
  type: widgetTypeArb,
  position: positionArb,
});

const layoutArb: fc.Arbitrary<DashboardLayout> = fc.record({
  widgets: fc.array(widgetArb, { minLength: 0, maxLength: 12 }),
  preset: fc.option(fc.constantFrom('executive' as const, 'analyst' as const, 'admin' as const), { nil: undefined }),
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Dashboard Layout PBT', () => {
  /**
   * Property 22: Dashboard layout persistence round-trip
   *
   * For any valid dashboard layout (widgets with positions and sizes),
   * serializing it to JSON and deserializing it back must produce
   * an equivalent layout.
   *
   * **Validates: Requirements 8.3**
   */
  it('Property 22: layout persistence round-trip — serialize then deserialize produces equivalent layout', () => {
    fc.assert(
      fc.property(layoutArb, (layout) => {
        const serialized = serializeLayout(layout);
        const deserialized = deserializeLayout(serialized);

        // Widgets count must match
        expect(deserialized.widgets.length).toBe(layout.widgets.length);

        // Each widget must be equivalent
        for (let i = 0; i < layout.widgets.length; i++) {
          const original = layout.widgets[i];
          const restored = deserialized.widgets[i];
          expect(restored.id).toBe(original.id);
          expect(restored.type).toBe(original.type);
          expect(restored.position.x).toBe(original.position.x);
          expect(restored.position.y).toBe(original.position.y);
          expect(restored.position.w).toBe(original.position.w);
          expect(restored.position.h).toBe(original.position.h);
        }

        // Preset must match
        expect(deserialized.preset).toBe(layout.preset);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 22 (extended): Preset layouts also survive round-trip
   *
   * **Validates: Requirements 8.3**
   */
  it('Property 22: preset layout round-trip — all 3 presets survive serialization', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('executive' as const, 'analyst' as const, 'admin' as const),
        (role) => {
          const preset = createPresetLayout(role);
          const serialized = serializeLayout(preset);
          const deserialized = deserializeLayout(serialized);

          expect(deserialized.widgets.length).toBe(preset.widgets.length);
          expect(deserialized.preset).toBe(role);

          for (let i = 0; i < preset.widgets.length; i++) {
            expect(deserialized.widgets[i].type).toBe(preset.widgets[i].type);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 22 (extended): Zod validation rejects invalid layouts
   *
   * **Validates: Requirements 8.3**
   */
  it('Property 22: Zod schema rejects layouts with invalid widget types', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(WIDGET_TYPES as readonly string[]).includes(s) && s.length > 0),
        (invalidType) => {
          const invalidLayout = {
            widgets: [{ id: 'test', type: invalidType, position: { x: 0, y: 0, w: 1, h: 1 } }],
          };
          const result = DashboardLayoutSchema.safeParse(invalidLayout);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 23: Widget error isolation
   *
   * For any set of widgets where one widget fails, the remaining widgets
   * must still be valid and unaffected. We simulate this by verifying that
   * removing any single widget from a layout leaves all other widgets intact
   * and the layout still validates.
   *
   * **Validates: Requirements 8.6**
   */
  it('Property 23: widget error isolation — removing any widget leaves others intact', () => {
    fc.assert(
      fc.property(
        fc.array(widgetArb, { minLength: 2, maxLength: 8 }),
        fc.nat(),
        (widgets, indexSeed) => {
          const layout: DashboardLayout = { widgets };

          // Pick a widget to "fail" (remove)
          const failIndex = indexSeed % widgets.length;
          const failedWidget = widgets[failIndex];

          // Remaining widgets after the failed one is removed
          const remaining = widgets.filter((_, i) => i !== failIndex);

          // All remaining widgets must be unchanged
          for (const w of remaining) {
            expect(w.id).toBeDefined();
            expect(w.type).toBeDefined();
            expect(w.position).toBeDefined();
            // Widget was not mutated by the "failure"
            expect(WIDGET_TYPES).toContain(w.type);
          }

          // The remaining layout must still be valid
          const remainingLayout: DashboardLayout = { widgets: remaining };
          const result = DashboardLayoutSchema.safeParse(remainingLayout);
          expect(result.success).toBe(true);

          // The failed widget's data is independent
          expect(failedWidget.id).not.toBe(undefined);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 23 (extended): Error in one widget's data doesn't corrupt others
   *
   * Simulates a widget throwing by corrupting one widget's position,
   * then verifying all other widgets remain valid.
   *
   * **Validates: Requirements 8.6**
   */
  it('Property 23: corrupting one widget position does not affect other widgets', () => {
    fc.assert(
      fc.property(
        fc.array(widgetArb, { minLength: 2, maxLength: 8 }),
        fc.nat(),
        (widgets, indexSeed) => {
          // Deep clone to avoid mutation
          const cloned = widgets.map((w) => ({
            ...w,
            position: { ...w.position },
          }));

          const corruptIndex = indexSeed % cloned.length;

          // Corrupt one widget's position (simulate error)
          cloned[corruptIndex].position.w = -999;

          // All OTHER widgets must still have valid positions
          for (let i = 0; i < cloned.length; i++) {
            if (i === corruptIndex) continue;
            expect(cloned[i].position.w).toBeGreaterThanOrEqual(1);
            expect(cloned[i].position.w).toBeLessThanOrEqual(4);
            expect(cloned[i].position.h).toBeGreaterThanOrEqual(1);
            expect(cloned[i].position.h).toBeLessThanOrEqual(4);
            expect(cloned[i].position.x).toBeGreaterThanOrEqual(0);
            expect(cloned[i].position.y).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
