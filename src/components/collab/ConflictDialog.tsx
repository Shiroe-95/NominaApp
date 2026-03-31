'use client';

import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui';
import type { ConflictResolution } from '@/lib/collab/collaboration-engine';

export interface ConflictDialogProps {
  conflict: ConflictResolution | null;
  open: boolean;
  onRevert: (conflict: ConflictResolution) => void;
  onAccept: (conflict: ConflictResolution) => void;
  className?: string;
}

/**
 * ConflictDialog — modal for resolving edit conflicts with revert option.
 *
 * Shown when two users edit the same cell simultaneously.
 * Last-write-wins is the default; user can revert to their value.
 * Req 9.3: conflict resolution with notification and revert option.
 */
export function ConflictDialog({ conflict, open, onRevert, onAccept, className }: ConflictDialogProps) {
  if (!conflict) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen && conflict) onAccept(conflict); }}>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle className="text-amber-400">Edit Conflict Detected</DialogTitle>
          <DialogDescription>
            Another user edited the same cell. Their change was applied (last-write-wins).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs text-white/50">Cell</p>
            <p className="font-mono text-sm text-white">{conflict.cellKey}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-xs text-green-400">Current value (winner)</p>
              <p className="font-mono text-sm text-white">{String(conflict.winnerValue ?? '—')}</p>
            </div>
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">Your value (overwritten)</p>
              <p className="font-mono text-sm text-white">{String(conflict.loserValue ?? '—')}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onRevert(conflict)}>
            Revert to my value
          </Button>
          <Button onClick={() => onAccept(conflict)}>
            Accept their change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
