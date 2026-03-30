'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface AuditTrailExportProps {
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  isExporting?: boolean;
  className?: string;
}

export function AuditTrailExport({ onExportCSV, onExportPDF, isExporting = false, className }: AuditTrailExportProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size="sm" onClick={onExportCSV} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPDF} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Export PDF'}
      </Button>
    </div>
  );
}
