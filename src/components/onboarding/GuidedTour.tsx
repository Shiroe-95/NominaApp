'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface TourStepConfig {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface GuidedTourProps {
  steps: TourStepConfig[];
  tourId: string;
  onComplete?: (tourId: string) => void;
  onSkip?: (tourId: string) => void;
  className?: string;
}

export function GuidedTour({ steps, tourId, onComplete, onSkip, className }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      setIsActive(false);
      onComplete?.(tourId);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, onComplete, tourId]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip?.(tourId);
  }, [onSkip, tourId]);

  if (!isActive || !step) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/50" aria-hidden="true" />
      <div
        className={cn(
          'fixed z-[9999] w-80 rounded-xl border border-white/10 bg-[#181b26] p-5 shadow-2xl',
          className
        )}
        role="dialog"
        aria-label={`Tour step ${currentStep + 1} of ${steps.length}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-[#958da1]">{currentStep + 1} / {steps.length}</span>
          <button onClick={handleSkip} className="text-xs text-[#958da1] hover:text-white">Skip tour</button>
        </div>
        <h4 className="text-sm font-semibold text-white">{step.title}</h4>
        <p className="mt-2 text-sm text-white/70">{step.content}</p>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack} disabled={currentStep === 0}>Back</Button>
          <Button variant="primary" size="sm" onClick={handleNext}>{isLast ? 'Finish' : 'Next'}</Button>
        </div>
      </div>
    </>
  );
}
