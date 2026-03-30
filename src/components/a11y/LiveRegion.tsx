'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LiveRegionProps {
  /** The message to announce */
  message?: string;
  /** ARIA politeness level */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether to visually hide the region */
  visuallyHidden?: boolean;
  /** Role attribute */
  role?: 'status' | 'alert' | 'log';
  className?: string;
}

export function LiveRegion({
  message,
  politeness = 'polite',
  visuallyHidden = true,
  role = 'status',
  className,
}: LiveRegionProps) {
  const [announcement, setAnnouncement] = React.useState('');

  React.useEffect(() => {
    if (message) {
      // Clear then set to force re-announcement
      setAnnouncement('');
      const timer = setTimeout(() => setAnnouncement(message), 100);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic="true"
      className={cn(visuallyHidden && 'sr-only', className)}
    >
      {announcement}
    </div>
  );
}
