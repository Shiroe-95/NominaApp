'use client';

import { cn } from '@/lib/utils';
import { Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui';

export interface AuditDetailData {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  dataBefore: Record<string, unknown> | null;
  dataAfter: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface AuditTrailDetailProps {
  entry: AuditDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function AuditTrailDetail({ entry, open, onOpenChange, className }: AuditTrailDetailProps) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>Audit Entry Detail</DialogTitle>
          <DialogDescription>Full details for audit event {entry.id.slice(0, 8)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[#958da1]">User</span><p className="text-white">{entry.userName}</p></div>
            <div><span className="text-[#958da1]">Timestamp</span><p className="text-white">{entry.createdAt}</p></div>
            <div><span className="text-[#958da1]">Action</span><p className="text-white">{entry.actionType}</p></div>
            <div><span className="text-[#958da1]">Resource</span><p className="text-white">{entry.resourceType} / {entry.resourceId.slice(0, 8)}</p></div>
            <div><span className="text-[#958da1]">IP Address</span><p className="text-white">{entry.ipAddress}</p></div>
            <div><span className="text-[#958da1]">Severity</span><Badge variant={entry.severity === 'critical' ? 'destructive' : 'outline'}>{entry.severity}</Badge></div>
          </div>

          <div><span className="text-[#958da1]">User Agent</span><p className="text-xs text-white/70 break-all">{entry.userAgent}</p></div>

          {entry.dataBefore && (
            <div>
              <span className="text-[#958da1]">Before</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-white/80">{JSON.stringify(entry.dataBefore, null, 2)}</pre>
            </div>
          )}
          {entry.dataAfter && (
            <div>
              <span className="text-[#958da1]">After</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-white/80">{JSON.stringify(entry.dataAfter, null, 2)}</pre>
            </div>
          )}
        </div>

        <DialogClose asChild><Button variant="ghost" className="mt-4">Close</Button></DialogClose>
      </DialogContent>
    </Dialog>
  );
}
