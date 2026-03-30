'use client';

import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';

export interface AnomalyItem {
  id: string;
  category: 'potential_fraud' | 'systematic_error' | 'seasonal_variation' | 'legitimate_change';
  confidence: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  employeeDoc?: string;
  deviation: number;
}

export interface AnomalyPanelProps {
  anomalies: AnomalyItem[];
  onDrillDown?: (id: string) => void;
  className?: string;
}

const categoryLabels: Record<string, string> = {
  potential_fraud: '🚨 Potential Fraud',
  systematic_error: '⚠️ Systematic Error',
  seasonal_variation: '📅 Seasonal',
  legitimate_change: '✅ Legitimate',
};

const confidenceColor: Record<string, 'destructive' | 'outline' | 'secondary'> = {
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
};

export function AnomalyPanel({ anomalies, onDrillDown, className }: AnomalyPanelProps) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26] p-4', className)}>
      <h3 className="text-sm font-semibold text-white">Anomaly Detection</h3>
      <p className="text-xs text-[#958da1]">{anomalies.length} anomalies detected</p>

      <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
        {anomalies.length === 0 && <p className="py-6 text-center text-xs text-[#958da1]">No anomalies detected</p>}
        {anomalies.map((a) => (
          <div key={a.id} className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs">{categoryLabels[a.category]}</span>
              <Badge variant={confidenceColor[a.confidence]}>{a.confidence}</Badge>
            </div>
            <p className="text-sm text-white/80">{a.description}</p>
            <p className="text-xs text-[#958da1]">{a.recommendation}</p>
            {a.employeeDoc && (
              <Button variant="ghost" size="sm" onClick={() => onDrillDown?.(a.id)} className="mt-1">
                Drill down →
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
