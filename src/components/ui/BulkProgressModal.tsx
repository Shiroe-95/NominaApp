'use client';

import { cn } from '@/lib/utils';
import { Button, ProgressBar, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

export interface BulkProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  isComplete?: boolean;
  onRetryFailed?: () => void;
  onClose?: () => void;
  className?: string;
}

export function BulkProgressModal({
  open,
  onOpenChange,
  title = 'Processing...',
  totalCount,
  processedCount,
  failedCount,
  isComplete = false,
  onRetryFailed,
  onClose,
  className,
}: BulkProgressModalProps) {
  const progress = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-sm', className)}>
        <DialogHeader>
          <DialogTitle>{isComplete ? 'Complete' : title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ProgressBar value={progress} max={100} />

          <div className="flex justify-between text-sm">
            <span className="text-[#958da1]">Processed: <span className="text-white">{processedCount}/{totalCount}</span></span>
            {failedCount > 0 && <span className="text-[#E11D48]">Failed: {failedCount}</span>}
          </div>

          {isComplete && (
            <div className="flex items-center justify-end gap-2">
              {failedCount > 0 && <Button variant="outline" size="sm" onClick={onRetryFailed}>Retry Failed</Button>}
              <Button variant="primary" size="sm" onClick={onClose ?? (() => onOpenChange(false))}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
