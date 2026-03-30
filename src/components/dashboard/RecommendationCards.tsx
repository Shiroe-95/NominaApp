'use client';

import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

export type RecommendationCategory = 'urgent_action' | 'optimization' | 'informative' | 'preventive';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  explanation: string;
  suggestedAction: string;
}

export interface RecommendationCardsProps {
  recommendations: Recommendation[];
  onDismiss?: (id: string) => void;
  onAction?: (id: string) => void;
  className?: string;
}

const categoryConfig: Record<RecommendationCategory, { icon: string; color: 'destructive' | 'outline' | 'secondary' | 'default' }> = {
  urgent_action: { icon: '🚨', color: 'destructive' },
  optimization: { icon: '⚡', color: 'outline' },
  informative: { icon: 'ℹ️', color: 'secondary' },
  preventive: { icon: '🛡️', color: 'default' },
};

export function RecommendationCards({ recommendations, onDismiss, onAction, className }: RecommendationCardsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-white">Recommendations</h3>

      {recommendations.length === 0 && <p className="py-4 text-center text-xs text-[#958da1]">No recommendations</p>}

      {recommendations.slice(0, 5).map((rec) => {
        const cfg = categoryConfig[rec.category];
        return (
          <div key={rec.id} className="rounded-xl border border-white/10 bg-[#181b26] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{cfg.icon}</span>
                <span className="text-sm font-medium text-white">{rec.title}</span>
              </div>
              <Badge variant={cfg.color}>{rec.category.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-white/70">{rec.explanation}</p>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => onAction?.(rec.id)}>{rec.suggestedAction}</Button>
              <Button variant="ghost" size="sm" onClick={() => onDismiss?.(rec.id)}>Dismiss</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
