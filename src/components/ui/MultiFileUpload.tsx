'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge, ProgressBar } from '@/components/ui';

export interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export interface MultiFileUploadProps {
  accept?: string;
  maxFiles?: number;
  onUpload?: (files: File[]) => void;
  className?: string;
}

export function MultiFileUpload({ accept = '.xlsx,.csv', maxFiles = 10, onUpload, className }: MultiFileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).slice(0, maxFiles);
    setFiles(dropped.map((file) => ({ file, status: 'pending', progress: 0 })));
  }, [maxFiles]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).slice(0, maxFiles);
    setFiles(selected.map((file) => ({ file, status: 'pending', progress: 0 })));
  };

  const handleUpload = () => {
    onUpload?.(files.map((f) => f.file));
  };

  const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    uploading: 'outline',
    success: 'default',
    error: 'destructive',
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-[#181b26] p-8 text-center transition-colors hover:border-[#7C3AED]/40"
      >
        <p className="text-sm text-[#958da1]">Drag & drop files here, or</p>
        <label className="mt-2 cursor-pointer">
          <span className="text-sm font-medium text-[#7C3AED] hover:underline">browse files</span>
          <input type="file" accept={accept} multiple onChange={handleSelect} className="hidden" />
        </label>
        <p className="mt-1 text-xs text-[#958da1]">Max {maxFiles} files</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#181b26] px-3 py-2">
              <span className="flex-1 truncate text-sm text-white">{f.file.name}</span>
              <span className="text-xs text-[#958da1]">{(f.file.size / 1024).toFixed(0)} KB</span>
              <Badge variant={statusColor[f.status]}>{f.status}</Badge>
              {f.status === 'uploading' && <ProgressBar value={f.progress} max={100} className="w-20" />}
            </div>
          ))}
          <Button variant="primary" size="sm" onClick={handleUpload}>Upload All</Button>
        </div>
      )}
    </div>
  );
}
