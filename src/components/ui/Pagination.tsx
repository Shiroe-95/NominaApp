'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface PaginationProps {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  cursor?: string | null;
  className?: string;
  label?: string;
}

export function Pagination({
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  className,
  label = 'Pagination',
}: PaginationProps) {
  return (
    <nav role="navigation" aria-label={label} className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousPage}
        disabled={!hasPreviousPage}
        aria-label="Previous page"
      >
        ← Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={!hasNextPage}
        aria-label="Next page"
      >
        Next →
      </Button>
    </nav>
  );
}
