'use client';

import { Component, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface WidgetWrapperProps {
  /** Unique widget ID for error isolation tracking. */
  widgetId: string;
  title?: string;
  children: ReactNode;
  className?: string;
}

interface WidgetWrapperState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary wrapper for individual dashboard widgets.
 *
 * Each widget is wrapped in its own WidgetWrapper so that if one widget
 * throws during render, only that widget shows an error state — all other
 * widgets continue functioning normally.
 *
 * Provides a "Retry" button that resets the error state and re-renders
 * the widget's children.
 */
export class WidgetWrapper extends Component<WidgetWrapperProps, WidgetWrapperState> {
  constructor(props: WidgetWrapperProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetWrapperState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center',
            this.props.className,
          )}
          data-testid={`widget-error-${this.props.widgetId}`}
          role="alert"
        >
          <span className="text-2xl">⚠️</span>
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">Widget Error</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {this.state.error?.message ?? 'Something went wrong'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-3 rounded-lg bg-[#7C3AED] px-3 py-1 text-xs font-medium text-white hover:bg-[#7C3AED]/80"
            data-testid={`widget-retry-${this.props.widgetId}`}
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div
        className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)]', this.props.className)}
        data-testid={`widget-${this.props.widgetId}`}
      >
        {this.props.title && (
          <div className="border-b border-[var(--border)] px-4 py-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{this.props.title}</h3>
          </div>
        )}
        <div className="p-4">{this.props.children}</div>
      </div>
    );
  }
}
