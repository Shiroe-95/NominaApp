'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

export interface NLQResult {
  answer: string;
  dataSources: string[];
  needsClarification?: boolean;
  clarificationOptions?: string[];
}

export interface NLQInputProps {
  onSubmit?: (query: string) => void;
  result?: NLQResult | null;
  isLoading?: boolean;
  className?: string;
}

export function NLQInput({ onSubmit, result, isLoading = false, className }: NLQInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit?.(query);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your payroll data..."
          className="flex-1 rounded-lg border border-white/10 bg-[#181b26] px-4 py-2 text-sm text-white placeholder:text-[#958da1] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
          aria-label="Natural language query"
        />
        <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
          {isLoading ? '...' : 'Ask'}
        </Button>
      </form>

      {result && (
        <div className="rounded-xl border border-white/10 bg-[#181b26] p-4 space-y-2">
          {result.needsClarification ? (
            <div>
              <p className="text-sm text-[#958da1]">Could you clarify?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.clarificationOptions?.map((opt, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => { setQuery(opt); onSubmit?.(opt); }}>{opt}</Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-white">{result.answer}</p>
              <div className="flex flex-wrap gap-1">
                {result.dataSources.map((src, i) => (
                  <Badge key={i} variant="secondary">{src}</Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
