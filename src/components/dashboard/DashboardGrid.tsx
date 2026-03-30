'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface WidgetLayout {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardGridProps {
  layouts: WidgetLayout[];
  onLayoutChange?: (layouts: WidgetLayout[]) => void;
  onAddWidget?: () => void;
  onResetLayout?: () => void;
  renderWidget?: (widget: WidgetLayout) => React.ReactNode;
  className?: string;
}

export function DashboardGrid({ layouts, onLayoutChange, onAddWidget, onResetLayout, renderWidget, className }: DashboardGridProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleRemoveWidget = useCallback((id: string) => {
    onLayoutChange?.(layouts.filter((l) => l.id !== id));
  }, [layouts, onLayoutChange]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Done' : 'Customize'}
          </Button>
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={onAddWidget}>Add Widget</Button>
              <Button variant="ghost" size="sm" onClick={onResetLayout}>Reset</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {layouts.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              'relative rounded-xl border border-white/10 bg-[#181b26]',
              isEditing && 'ring-2 ring-[#7C3AED]/20 ring-dashed'
            )}
            style={{ gridColumn: `span ${Math.min(widget.w, 4)}` }}
          >
            {isEditing && (
              <button
                onClick={() => handleRemoveWidget(widget.id)}
                className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#E11D48] text-[10px] text-white"
                aria-label={`Remove ${widget.type} widget`}
              >
                ×
              </button>
            )}
            {renderWidget?.(widget) ?? (
              <div className="flex h-32 items-center justify-center text-sm text-[#958da1]">{widget.type}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
