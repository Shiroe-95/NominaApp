'use client';

import { cn } from '@/lib/utils';
import { Button, ProgressBar, Spinner } from '@/components/ui';

export interface PDFPreviewProps {
  pdfUrl?: string | null;
  isGenerating?: boolean;
  progress?: number;
  onDownload?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

export function PDFPreview({ pdfUrl, isGenerating = false, progress = 0, onDownload, onRegenerate, className }: PDFPreviewProps) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26]', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">PDF Preview</h3>
        <div className="flex items-center gap-2">
          {pdfUrl && <Button variant="primary" size="sm" onClick={onDownload}>Download</Button>}
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isGenerating}>Regenerate</Button>
        </div>
      </div>

      <div className="p-4">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Spinner size="lg" />
            <p className="text-sm text-[#958da1]">Generating PDF...</p>
            <ProgressBar value={progress} max={100} className="w-48" />
            <p className="text-xs text-[#958da1]">{progress}%</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="PDF Preview"
            className="h-[500px] w-full rounded-lg border border-white/5 bg-white"
          />
        ) : (
          <div className="flex h-60 items-center justify-center text-sm text-[#958da1]">
            No PDF generated yet
          </div>
        )}
      </div>
    </div>
  );
}
