'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface MobileDrawerProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function MobileDrawer({ children, open, onOpenChange, trigger }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogPrimitive.Trigger asChild>
          {trigger}
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[280px] bg-[#13151e] shadow-2xl lg:hidden',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left',
            'focus:outline-none'
          )}
          aria-label="Navigation drawer"
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-white">Menu</span>
              <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40">
                <span className="text-lg">✕</span>
                <span className="sr-only">Close menu</span>
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 p-4">{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
