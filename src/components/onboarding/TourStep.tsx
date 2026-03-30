'use client';

import { cn } from '@/lib/utils';

export interface TourStepProps {
  title: string;
  content: string;
  stepNumber: number;
  totalSteps: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isHighlighted?: boolean;
  className?: string;
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full mb-3',
  bottom: 'top-full mt-3',
  left: 'right-full mr-3',
  right: 'left-full ml-3',
};

export function TourStep({ title, content, stepNumber, totalSteps, position = 'bottom', isHighlighted = false, className }: TourStepProps) {
  return (
    <div className={cn('relative', isHighlighted && 'ring-2 ring-[#7C3AED] ring-offset-2 ring-offset-[#0f1117] rounded-lg')}>
      <div
        className={cn(
          'absolute z-50 w-64 rounded-xl border border-white/10 bg-[#181b26] p-4 shadow-xl',
          positionClasses[position],
          className
        )}
        role="tooltip"
      >
        <span className="text-[10px] text-[#958da1]">Step {stepNumber} of {totalSteps}</span>
        <h4 className="mt-1 text-sm font-semibold text-white">{title}</h4>
        <p className="mt-1 text-xs text-white/70">{content}</p>
      </div>
    </div>
  );
}
