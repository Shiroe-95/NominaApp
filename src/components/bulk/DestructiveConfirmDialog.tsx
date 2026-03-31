'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label } from '@/components/ui';

export interface DestructiveConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText: string; // Text the user must type to confirm
  itemCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Confirmation dialog for destructive bulk operations.
 * Requires the user to type a confirmation phrase.
 *
 * Requirements: 17.5
 */
export function DestructiveConfirmDialog({
  open, title, description, confirmText, itemCount, onConfirm, onCancel, className,
}: DestructiveConfirmDialogProps) {
  const [input, setInput] = useState('');

  if (!open) return null;

  const isConfirmed = input === confirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className={cn('w-full max-w-md rounded-xl border border-white/10 bg-[#181b26] p-6 space-y-4', className)}>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-[#958da1]">{description}</p>
        <p className="text-sm text-red-400">
          This will affect <strong>{itemCount}</strong> records. This action cannot be undone.
        </p>

        <div>
          <Label htmlFor="confirm-input">
            Type <code className="rounded bg-white/10 px-1 text-white">{confirmText}</code> to confirm
          </Label>
          <Input
            id="confirm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmText}
            className="mt-1"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setInput(''); onCancel(); }}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => { setInput(''); onConfirm(); }} disabled={!isConfirmed}>
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
