'use client';

import { cn } from '@/lib/utils';
import { Button, Alert, AlertTitle, AlertDescription } from '@/components/ui';

export interface ConflictInfo {
  id: string;
  cellRef: string;
  yourValue: string;
  theirValue: string;
  theirUserName: string;
  timestamp: string;
}

export interface ConflictNotificationProps {
  conflict: ConflictInfo | null;
  onRevert?: (conflictId: string) => void;
  onDismiss?: (conflictId: string) => void;
  className?: string;
}

export function ConflictNotification({ conflict, onRevert, onDismiss, className }: ConflictNotificationProps) {
  if (!conflict) return null;

  return (
    <Alert variant="destructive" className={cn('animate-in slide-in-from-top-2', className)}>
      <AlertTitle>Edit Conflict — {conflict.cellRef}</AlertTitle>
      <AlertDescription>
        <p className="text-sm">
          {conflict.theirUserName} changed this cell to <span className="font-mono font-semibold">{conflict.theirValue}</span>.
          Your value <span className="font-mono">{conflict.yourValue}</span> was overwritten.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onRevert?.(conflict.id)}>Revert to mine</Button>
          <Button variant="ghost" size="sm" onClick={() => onDismiss?.(conflict.id)}>Dismiss</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
