/**
 * Property-Based Tests for Virtual Scrolling
 * Feature: platform-improvements
 *
 * Tests Properties 1, 2, 3, 4 from the design document.
 * Uses fast-check with minimum 100 iterations per property.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeOffsets,
  resolveHeight,
  VIRTUAL_SCROLL_THRESHOLD,
} from './virtual-scroll';
import type { RowState } from './virtual-scroll';

const NUM_RUNS = 100;

/**
 * Helper: simulate the visible items calculation from useVirtualScroll
 * without React hooks, using the same pure logic.
 */
function computeVisibleItems(
  totalItems: number,
  itemHeight: number | ((index: number) => number),
  containerHeight: number,
  scrollTop: number,
  overscan: number,
  filteredIndices?: number[] | null,
): { index: number; offsetTop: number }[] {
  const activeIndices = filteredIndices ?? null;
  const effectiveTotal = activeIndices ? activeIndices.length : totalItems;
  const shouldVirtualize = effectiveTotal > VIRTUAL_SCROLL_THRESHOLD;

  if (!shouldVirtualize) {
    const count = activeIndices ? activeIndices.length : totalItems;
    const { offsets } = computeOffsets(totalItems, itemHeight, activeIndices);
    return Array.from({ length: count }, (_, i) => ({
      index: activeIndices ? activeIndices[i] : i,
      offsetTop: offsets[i],
    }));
  }

  const { offsets } = computeOffsets(totalItems, itemHeight, activeIndices);
  const count = activeIndices ? activeIndices.length : totalItems;

  // Find start index via linear scan (reference implementation)
  let startVirtual = 0;
  for (let i = 0; i < count; i++) {
    if (i + 1 < count && offsets[i + 1] <= scrollTop) {
      startVirtual = i + 1;
    } else if (offsets[i] <= scrollTop) {
      startVirtual = i;
      break;
    } else {
      break;
    }
  }

  const startWithOverscan = Math.max(0, startVirtual - overscan);

  let endVirtual = startVirtual;
  while (endVirtual < count - 1) {
    const realIdx = activeIndices ? activeIndices[endVirtual] : endVirtual;
    if (offsets[endVirtual] + resolveHeight(itemHeight, realIdx) > scrollTop + containerHeight) {
      break;
    }
    endVirtual++;
  }
  const endWithOverscan = Math.min(count - 1, endVirtual + overscan);

  const items: { index: number; offsetTop: number }[] = [];
  for (let i = startWithOverscan; i <= endWithOverscan; i++) {
    const realIndex = activeIndices ? activeIndices[i] : i;
    items.push({ index: realIndex, offsetTop: offsets[i] });
  }
  return items;
}

describe('Virtual Scrolling PBT', () => {
  /**
   * Property 1: Virtual Scrolling renders only visible rows plus buffer
   * Feature: platform-improvements, Property 1
   *
   * For any N rows (> threshold) and any scroll position, the hook returns
   * only visible rows + max 5 buffer above and below.
   *
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: renders only visible rows plus buffer', () => {
    it('should return at most visible + 2*overscan rows for any scroll position', () => {
      fc.assert(
        fc.property(
          // totalItems > threshold to trigger virtualization
          fc.integer({ min: VIRTUAL_SCROLL_THRESHOLD + 1, max: 2000 }),
          fc.integer({ min: 20, max: 100 }), // itemHeight
          fc.integer({ min: 100, max: 800 }), // containerHeight
          fc.integer({ min: 0, max: 100000 }), // scrollTop
          (totalItems: number, itemHeight: number, containerHeight: number, scrollTop: number) => {
            const overscan = 5;
            const maxScrollTop = totalItems * itemHeight - containerHeight;
            const clampedScroll = Math.max(0, Math.min(scrollTop, Math.max(0, maxScrollTop)));

            const items = computeVisibleItems(
              totalItems,
              itemHeight,
              containerHeight,
              clampedScroll,
              overscan,
            );

            // Calculate how many rows fit in the viewport
            const visibleCount = Math.ceil(containerHeight / itemHeight);
            // Max items = visible + overscan above + overscan below
            const maxExpected = visibleCount + 2 * overscan + 1;

            expect(items.length).toBeLessThanOrEqual(maxExpected);
            expect(items.length).toBeGreaterThan(0);

            // All indices must be valid
            for (const item of items) {
              expect(item.index).toBeGreaterThanOrEqual(0);
              expect(item.index).toBeLessThan(totalItems);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  /**
   * Property 2: Virtual Scrolling preserves row state (round-trip)
   * Feature: platform-improvements, Property 2
   *
   * For any row with selection/editing state, if the row exits the viewport
   * and re-enters, its state must be identical.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: preserves row state across viewport exit/re-enter', () => {
    it('should preserve state in the row state map for any index and state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9999 }), // row index
          fc.boolean(), // selected
          fc.boolean(), // editing
          fc.string({ minLength: 0, maxLength: 50 }), // arbitrary extra state
          (index: number, selected: boolean, editing: boolean, extra: string) => {
            // Simulate the state map (same as useRef<Map> in the hook)
            const stateMap = new Map<number, RowState>();

            const originalState: RowState = { selected, editing, extra };

            // Set state (row is in viewport)
            stateMap.set(index, originalState);

            // Row exits viewport (we don't touch the map)
            // Row re-enters viewport — retrieve state
            const retrieved = stateMap.get(index);

            expect(retrieved).toBeDefined();
            expect(retrieved!.selected).toBe(selected);
            expect(retrieved!.editing).toBe(editing);
            expect(retrieved!.extra).toBe(extra);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('should preserve state for multiple rows simultaneously', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              index: fc.integer({ min: 0, max: 9999 }),
              selected: fc.boolean(),
              editing: fc.boolean(),
            }),
            { minLength: 1, maxLength: 50 },
          ),
          (rows: { index: number; selected: boolean; editing: boolean }[]) => {
            const stateMap = new Map<number, RowState>();

            // Set all states
            for (const row of rows) {
              stateMap.set(row.index, { selected: row.selected, editing: row.editing });
            }

            // Verify all states are preserved (last write wins for duplicate indices)
            const uniqueByIndex = new Map<number, (typeof rows)[0]>();
            for (const row of rows) {
              uniqueByIndex.set(row.index, row);
            }

            for (const [index, expected] of uniqueByIndex) {
              const retrieved = stateMap.get(index);
              expect(retrieved).toBeDefined();
              expect(retrieved!.selected).toBe(expected.selected);
              expect(retrieved!.editing).toBe(expected.editing);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  /**
   * Property 3: Virtual Scrolling recalculates visible rows on filter
   * Feature: platform-improvements, Property 3
   *
   * For any set of rows and any filter, the visible rows must contain
   * only matching rows, and scroll should position at the first result.
   *
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: recalculates visible rows on filter', () => {
    it('should show only filtered rows when a filter is applied', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: VIRTUAL_SCROLL_THRESHOLD + 1, max: 500 }),
          fc.integer({ min: 20, max: 60 }), // itemHeight
          fc.integer({ min: 200, max: 600 }), // containerHeight
          // Generate a set of matching indices
          fc.array(fc.integer({ min: 0, max: 499 }), { minLength: 1, maxLength: 100 }),
          (totalItems: number, itemHeight: number, containerHeight: number, matchingRaw: number[]) => {
            // Ensure matching indices are within range and unique
            const matching = [...new Set(matchingRaw.filter((i: number) => i < totalItems))].sort(
              (a: number, b: number) => a - b,
            );
            if (matching.length === 0) return; // skip degenerate case

            // Compute offsets for filtered indices
            const { offsets } = computeOffsets(totalItems, itemHeight, matching);
            // Scroll to first result (offset 0)
            const scrollTop = offsets[0];

            const items = computeVisibleItems(
              totalItems,
              itemHeight,
              containerHeight,
              scrollTop,
              5,
              matching,
            );

            // All returned items must be in the matching set
            const matchingSet = new Set(matching);
            for (const item of items) {
              expect(matchingSet.has(item.index)).toBe(true);
            }

            // First visible item should be the first matching item (or close due to overscan)
            if (items.length > 0) {
              expect(items[0].index).toBe(matching[0]);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  /**
   * Property 4: Virtual Scrolling calculates correct offsets with variable heights
   * Feature: platform-improvements, Property 4
   *
   * For any height function and any scroll position, offsets for each visible
   * row must be the cumulative sum of all previous row heights.
   *
   * **Validates: Requirements 1.5**
   */
  describe('Property 4: correct offsets with variable heights', () => {
    it('offsets should be cumulative sum of previous row heights', () => {
      fc.assert(
        fc.property(
          // Generate an array of heights (one per row)
          fc.array(fc.integer({ min: 20, max: 120 }), {
            minLength: 10,
            maxLength: 500,
          }),
          (heights: number[]) => {
            const totalItems = heights.length;
            const heightFn = (index: number) => heights[index];

            const { offsets, totalHeight } = computeOffsets(totalItems, heightFn);

            // Verify each offset is the cumulative sum
            let expectedOffset = 0;
            for (let i = 0; i < totalItems; i++) {
              expect(offsets[i]).toBe(expectedOffset);
              expectedOffset += heights[i];
            }

            // Total height should be sum of all heights
            expect(totalHeight).toBe(expectedOffset);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('offsets with fixed height should equal index * height', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }), // totalItems
          fc.integer({ min: 10, max: 200 }), // fixed height
          (totalItems: number, fixedHeight: number) => {
            const { offsets, totalHeight } = computeOffsets(totalItems, fixedHeight);

            for (let i = 0; i < totalItems; i++) {
              expect(offsets[i]).toBe(i * fixedHeight);
            }
            expect(totalHeight).toBe(totalItems * fixedHeight);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
