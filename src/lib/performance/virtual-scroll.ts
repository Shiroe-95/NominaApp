/**
 * Virtual scrolling hook for PayrollEditor (>100 rows).
 * Renders only visible rows to maintain 30fps on large datasets.
 *
 * Requirements: 23.1, 23.5
 * @module lib/performance/virtual-scroll
 */

import { useState, useCallback, useMemo, useRef } from 'react';

export interface VirtualScrollOptions {
  totalItems: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualScrollResult {
  visibleItems: { index: number; offsetTop: number }[];
  totalHeight: number;
  onScroll: (scrollTop: number) => void;
  scrollTop: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const DEFAULT_OVERSCAN = 5;
const VIRTUAL_SCROLL_THRESHOLD = 100;

/**
 * Hook for virtual scrolling in PayrollEditor.
 * Only renders visible rows + overscan buffer for smooth scrolling.
 */
export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const { totalItems, itemHeight, containerHeight, overscan = DEFAULT_OVERSCAN } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = totalItems > VIRTUAL_SCROLL_THRESHOLD;
  const totalHeight = totalItems * itemHeight;

  const visibleItems = useMemo(() => {
    if (!shouldVirtualize) {
      return Array.from({ length: totalItems }, (_, i) => ({
        index: i,
        offsetTop: i * itemHeight,
      }));
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);

    const items: { index: number; offsetTop: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({ index: i, offsetTop: i * itemHeight });
    }
    return items;
  }, [scrollTop, totalItems, itemHeight, containerHeight, overscan, shouldVirtualize]);

  const onScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);

  return { visibleItems, totalHeight, onScroll, scrollTop, containerRef };
}

export { VIRTUAL_SCROLL_THRESHOLD };
