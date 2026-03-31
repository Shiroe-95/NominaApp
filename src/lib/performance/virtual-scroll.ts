/**
 * Virtual scrolling hook for PayrollEditor.
 * Renders only visible rows to maintain 30fps on large datasets.
 * Supports variable row heights, sticky columns, state preservation,
 * filter recalculation, and fallback to pagination.
 *
 * Requirements: 1.1–1.7
 * @module lib/performance/virtual-scroll
 */

import { useState, useCallback, useMemo, useRef } from 'react';

// --- Task 1.2: Reduced threshold from 100 to 50 ---
const VIRTUAL_SCROLL_THRESHOLD = 50;
const DEFAULT_OVERSCAN = 5;
const PAGINATION_PAGE_SIZE = 50;

// --- Task 1.1: Extended interface for variable row heights ---
export interface VirtualScrollOptions {
  totalItems: number;
  /** Fixed height or function returning height per index */
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
  /** Number of sticky columns for horizontal scroll (Task 1.5) */
  stickyColumns?: number;
}

export interface VirtualScrollResult {
  visibleItems: { index: number; offsetTop: number }[];
  totalHeight: number;
  onScroll: (scrollTop: number) => void;
  scrollTop: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Task 1.3: State preservation map */
  getRowState: (index: number) => RowState | undefined;
  setRowState: (index: number, state: RowState) => void;
  /** Task 1.4: Filter support */
  applyFilter: (predicate: (index: number) => boolean) => void;
  clearFilter: () => void;
  filteredIndices: number[] | null;
  /** Task 1.5: Sticky column count */
  stickyColumns: number;
  /** Task 1.6: Pagination fallback */
  isPaginated: boolean;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
}

// --- Task 1.3: Row state interface ---
export interface RowState {
  selected?: boolean;
  editing?: boolean;
  [key: string]: unknown;
}

/**
 * Resolves the height for a given index.
 */
function resolveHeight(itemHeight: number | ((index: number) => number), index: number): number {
  return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
}

/**
 * Computes cumulative offsets for all items (variable heights).
 * Returns array where offsets[i] = sum of heights of items 0..i-1.
 */
function computeOffsets(
  totalItems: number,
  itemHeight: number | ((index: number) => number),
  indices?: number[] | null,
): { offsets: number[]; totalHeight: number } {
  const count = indices ? indices.length : totalItems;
  const offsets: number[] = new Array(count);
  let cumulative = 0;
  for (let i = 0; i < count; i++) {
    offsets[i] = cumulative;
    const realIndex = indices ? indices[i] : i;
    cumulative += resolveHeight(itemHeight, realIndex);
  }
  return { offsets, totalHeight: cumulative };
}

/**
 * Binary search to find the first item whose offset + height > scrollTop.
 */
function findStartIndex(offsets: number[], scrollTop: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid + 1] !== undefined && offsets[mid + 1] <= scrollTop) {
      lo = mid + 1;
    } else if (offsets[mid] <= scrollTop) {
      // mid could be the start
      if (mid + 1 < offsets.length && offsets[mid + 1] > scrollTop) {
        return mid;
      }
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// --- Task 1.6: Detect IntersectionObserver availability ---
function hasIntersectionObserver(): boolean {
  return typeof IntersectionObserver !== 'undefined';
}

/**
 * Hook for virtual scrolling in PayrollEditor.
 * Only renders visible rows + overscan buffer for smooth scrolling.
 */
export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const {
    totalItems,
    itemHeight,
    containerHeight,
    overscan = DEFAULT_OVERSCAN,
    stickyColumns: stickyColumnCount = 0,
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // --- Task 1.3: State preservation map ---
  const rowStateMap = useRef<Map<number, RowState>>(new Map());

  const getRowState = useCallback((index: number): RowState | undefined => {
    return rowStateMap.current.get(index);
  }, []);

  const setRowState = useCallback((index: number, state: RowState) => {
    rowStateMap.current.set(index, state);
  }, []);

  // --- Task 1.4: Filter state ---
  const [filteredIndices, setFilteredIndices] = useState<number[] | null>(null);

  const applyFilter = useCallback(
    (predicate: (index: number) => boolean) => {
      const matching: number[] = [];
      for (let i = 0; i < totalItems; i++) {
        if (predicate(i)) matching.push(i);
      }
      setFilteredIndices(matching);
      // Auto-scroll to first result
      if (matching.length > 0) {
        const { offsets } = computeOffsets(totalItems, itemHeight, matching);
        setScrollTop(offsets[0]);
      } else {
        setScrollTop(0);
      }
    },
    [totalItems, itemHeight],
  );

  const clearFilter = useCallback(() => {
    setFilteredIndices(null);
    setScrollTop(0);
  }, []);

  // --- Task 1.6: Pagination fallback ---
  const isPaginated = !hasIntersectionObserver();
  const [currentPage, setCurrentPage] = useState(0);

  const effectiveTotal = filteredIndices ? filteredIndices.length : totalItems;
  const totalPages = isPaginated ? Math.max(1, Math.ceil(effectiveTotal / PAGINATION_PAGE_SIZE)) : 0;

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, Math.max(0, totalPages - 1)));
      setCurrentPage(clamped);
    },
    [totalPages],
  );

  const shouldVirtualize = effectiveTotal > VIRTUAL_SCROLL_THRESHOLD && !isPaginated;

  // --- Compute visible items ---
  const visibleItems = useMemo(() => {
    const activeIndices = filteredIndices;

    // Pagination fallback (Task 1.6)
    if (isPaginated) {
      const start = currentPage * PAGINATION_PAGE_SIZE;
      const end = Math.min(start + PAGINATION_PAGE_SIZE, effectiveTotal);
      const { offsets } = computeOffsets(totalItems, itemHeight, activeIndices);
      const items: { index: number; offsetTop: number }[] = [];
      for (let i = start; i < end; i++) {
        const realIndex = activeIndices ? activeIndices[i] : i;
        items.push({ index: realIndex, offsetTop: offsets[i] });
      }
      return items;
    }

    // No virtualization needed
    if (!shouldVirtualize) {
      const count = activeIndices ? activeIndices.length : totalItems;
      const { offsets } = computeOffsets(totalItems, itemHeight, activeIndices);
      return Array.from({ length: count }, (_, i) => ({
        index: activeIndices ? activeIndices[i] : i,
        offsetTop: offsets[i],
      }));
    }

    // Virtual scrolling with variable heights
    const { offsets, totalHeight: _ } = computeOffsets(totalItems, itemHeight, activeIndices);
    const count = activeIndices ? activeIndices.length : totalItems;

    const startVirtual = findStartIndex(offsets, scrollTop);
    const startWithOverscan = Math.max(0, startVirtual - overscan);

    // Find end: keep adding items until we exceed scrollTop + containerHeight
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
  }, [
    scrollTop,
    totalItems,
    itemHeight,
    containerHeight,
    overscan,
    shouldVirtualize,
    filteredIndices,
    isPaginated,
    currentPage,
    effectiveTotal,
  ]);

  // Total height for scroll container
  const { totalHeight } = useMemo(
    () => computeOffsets(totalItems, itemHeight, filteredIndices),
    [totalItems, itemHeight, filteredIndices],
  );

  const onScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    onScroll,
    scrollTop,
    containerRef,
    getRowState,
    setRowState,
    applyFilter,
    clearFilter,
    filteredIndices,
    stickyColumns: stickyColumnCount,
    isPaginated,
    currentPage,
    totalPages,
    goToPage,
  };
}

// Exported for testing
export { VIRTUAL_SCROLL_THRESHOLD, PAGINATION_PAGE_SIZE, computeOffsets, findStartIndex, resolveHeight, hasIntersectionObserver };
