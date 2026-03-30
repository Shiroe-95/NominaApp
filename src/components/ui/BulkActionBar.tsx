'use client';

import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

export type BulkAction = 'export' | 'delete' | 're-audit' | 'change-status' | 'change-priority';

export interface BulkActionBarProps {
  selectedCount: number;
  onAction?: (action: BulkAction) => void;
  onClearSelection?: () => void;
  className?: string;
}

export function BulkActionBar({ selectedCount, onAction, onClearSelection, className }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#181b26] px-5 py-3 shadow-2xl',
        className
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <Badge variant="secondary">{selectedCount} selected</Badge>
      <div className="h-5 w-px bg-white/10" />
      <Button variant="ghost" size="sm" onClick={() => onAction?.('export')}>Export</Button>
      <Button variant="ghost" size="sm" onClick={() => onAction?.('re-audit')}>Re-audit</Button>
      <Button variant="ghost" size="sm" onClick={() => onAction?.('change-status')}>Status</Button>
      <Button variant="ghost" size="sm" onClick={() => onAction?.('change-priority')}>Priority</Button>
      <Button variant="destructive" size="sm" onClick={() => onAction?.('delete')}>Delete</Button>
      <div className="h-5 w-px bg-white/10" />
      <Button variant="ghost" size="sm" onClick={onClearSelection}>Clear</Button>
    </div>
  );
}
