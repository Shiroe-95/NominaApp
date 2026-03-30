'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cn } from '@/lib/utils';

const Toggle = React.forwardRef<
  React.ComponentRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & {
    variant?: 'default' | 'outline';
    size?: 'default' | 'sm' | 'lg';
  }
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
      'hover:bg-white/[0.06] hover:text-white',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=on]:bg-[#7C3AED]/20 data-[state=on]:text-[#7C3AED]',
      variant === 'outline' && 'border border-white/10 bg-transparent',
      size === 'default' && 'h-9 px-3 text-sm',
      size === 'sm' && 'h-8 px-2 text-xs',
      size === 'lg' && 'h-11 px-4 text-sm',
      className
    )}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle };
