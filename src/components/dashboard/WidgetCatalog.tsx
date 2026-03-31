'use client';

import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { WIDGET_CATALOG, type WidgetType } from '@/lib/dashboard/dashboard-layout';

export interface WidgetCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (type: WidgetType) => void;
  /** Widget types already on the dashboard (to show "added" state). */
  existingTypes?: WidgetType[];
  className?: string;
}

/**
 * Dialog showing the 8 available widget types for the customizable dashboard.
 * Widgets: metrics, risk-trend, anomalies, forecast, activity, ai-providers, action-items, system-health.
 */
export function WidgetCatalog({
  open,
  onOpenChange,
  onAdd,
  existingTypes = [],
  className,
}: WidgetCatalogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
          {WIDGET_CATALOG.map((w) => {
            const alreadyAdded = existingTypes.includes(w.type);
            return (
              <button
                key={w.type}
                disabled={alreadyAdded}
                onClick={() => {
                  onAdd?.(w.type);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border border-[var(--border)] bg-black/20 p-3 text-left transition-colors',
                  alreadyAdded
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5',
                )}
              >
                <span className="text-lg">{w.icon}</span>
                <span className="text-sm font-medium text-[var(--foreground)]">{w.label}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{w.description}</span>
                {alreadyAdded && (
                  <span className="text-[10px] text-[var(--muted-foreground)]">Already added</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
