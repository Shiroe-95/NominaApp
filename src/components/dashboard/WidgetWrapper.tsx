'use client';

import { Component, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface WidgetWrapperProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

interface WidgetWrapperState {
  hasError: boolean;
  error: Error | null;
}

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
        <div className={cn('flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#181b26] p-6 text-center', this.props.className)}>
          <span className="text-2xl">⚠️</span>
          <p className="mt-2 text-sm font-medium text-white">Widget Error</p>
          <p className="mt-1 text-xs text-[#958da1]">{this.state.error?.message ?? 'Something went wrong'}</p>
          <button
            onClick={this.handleRetry}
            className="mt-3 rounded-lg bg-[#7C3AED] px-3 py-1 text-xs font-medium text-white hover:bg-[#7C3AED]/80"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className={cn('rounded-xl border border-white/10 bg-[#181b26]', this.props.className)}>
        {this.props.title && (
          <div className="border-b border-white/5 px-4 py-2">
            <h3 className="text-sm font-semibold text-white">{this.props.title}</h3>
          </div>
        )}
        <div className="p-4">{this.props.children}</div>
      </div>
    );
  }
}
