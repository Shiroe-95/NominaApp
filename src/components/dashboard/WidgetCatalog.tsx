'use client';

import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  defaultW: number;
  defaultH: number;
}

export interface WidgetCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets?: WidgetDefinition[];
  onAdd?: (type: string) => void;
  className?: string;
}

const defaultWidgets: WidgetDefinition[] = [
  { type: 'metrics', label: 'Key Metrics', description: 'Summary metrics cards', icon: '📊', defaultW: 2, defaultH: 1 },
  { type: 'risk_trend', label: 'Risk Trend', description: 'Risk score over time', icon: '📈', defaultW: 2, defaultH: 1 },
  { type: 'anomalies', label: 'Anomalies', description: 'Detected anomalies panel', icon: '🔮', defaultW: 1, defaultH: 2 },
  { type: 'forecast', label: 'Forecast', description: 'Cost forecast chart', icon: '📉', defaultW: 2, defaultH: 1 },
  { type: 'activity', label: 'Activity Feed', description: 'Recent activity', icon: '📋', defaultW: 1, defaultH: 2 },
  { type: 'ai_providers', label: 'AI Providers', description: 'Provider status', icon: '🤖', defaultW: 1, defaultH: 1 },
  { type: 'scheduled_reports', label: 'Scheduled Reports', description: 'Upcoming reports', icon: '📅', defaultW: 1, defaultH: 1 },
  { type: 'action_items', label: 'Action Items', description: 'Pending actions', icon: '✅', defaultW: 1, defaultH: 1 },
];

export function WidgetCatalog({ open, onOpenChange, widgets = defaultWidgets, onAdd, className }: WidgetCatalogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
          {widgets.map((w) => (
            <button
              key={w.type}
              onClick={() => { onAdd?.(w.type); onOpenChange(false); }}
              className="flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition-colors hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5"
            >
              <span className="text-lg">{w.icon}</span>
              <span className="text-sm font-medium text-white">{w.label}</span>
              <span className="text-xs text-[#958da1]">{w.description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
