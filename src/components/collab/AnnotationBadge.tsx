'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

export interface AnnotationBadgeProps {
  count: number;
  hasUnresolved?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AnnotationBadge({ count, hasUnresolved = false, onClick, className }: AnnotationBadgeProps) {
  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold transition-colors',
              hasUnresolved
                ? 'bg-[#7C3AED] text-white shadow-[0_0_8px_rgba(124,58,237,0.4)]'
                : 'bg-[#262a35] text-[#958da1]',
              className
            )}
            aria-label={`${count} annotation${count !== 1 ? 's' : ''}${hasUnresolved ? ', has unresolved' : ''}`}
          >
            {count}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {count} annotation{count !== 1 ? 's' : ''}{hasUnresolved ? ' (unresolved)' : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
