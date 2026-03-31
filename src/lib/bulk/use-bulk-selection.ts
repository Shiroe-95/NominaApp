'use client';

import { useState, useCallback, useMemo } from 'react';

export interface BulkSelectionState<T extends { id: string }> {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  selectedCount: number;
  toggleItem: (id: string) => void;
  toggleAll: (items: T[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

/**
 * Hook for managing bulk selection state with checkboxes.
 * Used in Reports and Reconcile pages.
 *
 * Requirements: 17.1
 */
export function useBulkSelection<T extends { id: string }>(items: T[]): BulkSelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((allItems: T[]) => {
    setSelectedIds((prev) => {
      if (prev.size === allItems.length) return new Set();
      return new Set(allItems.map((item) => item.id));
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const isAllSelected = useMemo(() => items.length > 0 && selectedIds.size === items.length, [items.length, selectedIds.size]);
  const isPartiallySelected = useMemo(() => selectedIds.size > 0 && selectedIds.size < items.length, [items.length, selectedIds.size]);

  return {
    selectedIds,
    isAllSelected,
    isPartiallySelected,
    selectedCount: selectedIds.size,
    toggleItem,
    toggleAll,
    clearSelection,
    isSelected,
  };
}
