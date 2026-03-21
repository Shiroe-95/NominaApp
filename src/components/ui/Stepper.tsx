'use client';

import React from 'react';

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  return (
    <nav aria-label="Progress" className={`flex items-center gap-2 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={index}>
            <div className="flex items-center gap-2">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  transition-all duration-300 shrink-0
                  ${isCompleted
                    ? 'bg-emerald text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : isCurrent
                      ? 'bg-violet text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]'
                      : 'bg-navy-light text-slate-400 border border-white/10'
                  }
                `}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-medium leading-tight ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[10px] text-slate-500 leading-tight">{step.description}</p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 min-w-4 rounded-full transition-colors duration-300
                  ${isCompleted ? 'bg-emerald/60' : 'bg-white/10'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
