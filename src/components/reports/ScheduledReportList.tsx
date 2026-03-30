'use client';

import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

export interface ScheduledReportItem {
  id: string;
  name: string;
  reportType: string;
  outputFormat: string;
  cronExpression: string;
  isActive: boolean;
  lastRunStatus: 'success' | 'failed' | null;
  nextRunAt: string;
}

export interface ScheduledReportListProps {
  reports: ScheduledReportItem[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
  onExecuteNow?: (id: string) => void;
  className?: string;
}

export function ScheduledReportList({ reports, onPause, onResume, onDelete, onExecuteNow, className }: ScheduledReportListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-white">Scheduled Reports</h3>

      {reports.length === 0 && <p className="py-6 text-center text-sm text-[#958da1]">No scheduled reports</p>}

      {reports.map((report) => (
        <div key={report.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#181b26] p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{report.name}</span>
              <Badge variant={report.isActive ? 'default' : 'secondary'}>{report.isActive ? 'Active' : 'Paused'}</Badge>
              {report.lastRunStatus && (
                <Badge variant={report.lastRunStatus === 'success' ? 'outline' : 'destructive'}>{report.lastRunStatus}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-[#958da1]">
              {report.reportType} · {report.outputFormat.toUpperCase()} · Next: {report.nextRunAt}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onExecuteNow?.(report.id)}>Run Now</Button>
            {report.isActive
              ? <Button variant="ghost" size="sm" onClick={() => onPause?.(report.id)}>Pause</Button>
              : <Button variant="ghost" size="sm" onClick={() => onResume?.(report.id)}>Resume</Button>
            }
            <Button variant="ghost" size="sm" onClick={() => onDelete?.(report.id)}>Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
