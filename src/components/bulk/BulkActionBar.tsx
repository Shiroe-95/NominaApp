'use client';

import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

export type BulkAction = 'export' | 'delete' | 're-audit' | 'change-status' | 'assign';

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onAction: (action: BulkAction) => void;
  onClear: () => void;
  className?: string;
}

const actionLabels: Record<BulkAction, string> = {
  export: 'Export',
  delete: 'Delete',
  're-audit': 'Re-audit',
  'change-status': 'Change Status',
  assign: 'Assign',
};

const destructiveActions: BulkAction[] = ['delete'];

/**
 * Floating action bar shown when items are selected for bulk operations.
 * Requirements: 17.2
 */
export function BulkActionBar({ selectedCount, actions, onAction, onClear, className }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 rounded-xl border border-white/10 bg-[#181b26] px-4 py-3 shadow-2xl',
        className,
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <Badge variant="secondary">{selectedCount} selected</Badge>

      {actions.map((action) => (
        <Button
          key={action}
          variant={destructiveActions.includes(action) ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => onAction(action)}
        >
          {actionLabels[action]}
        </Button>
      ))}

      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
