'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

export interface ContextualTooltipProps {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function ContextualTooltip({ content, side = 'top', className }: ContextualTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-[#958da1] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors',
              className
            )}
            aria-label="Help"
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
