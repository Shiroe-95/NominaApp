'use client';

import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';

export type ActivityType = 'upload' | 'audit' | 'correction' | 'comment' | 'status_change' | 'report';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  userName: string;
  description: string;
  createdAt: string;
  groupId?: string;
}

export interface ActivityFeedProps {
  activities: ActivityItem[];
  filterType?: ActivityType | null;
  onFilterChange?: (type: ActivityType | null) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

const typeIcons: Record<ActivityType, string> = {
  upload: '📤',
  audit: '🔍',
  correction: '✏️',
  comment: '💬',
  status_change: '🔄',
  report: '📊',
};

const typeColors: Record<ActivityType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  upload: 'default',
  audit: 'secondary',
  correction: 'outline',
  comment: 'secondary',
  status_change: 'outline',
  report: 'default',
};

export function ActivityFeed({ activities, filterType, onFilterChange, onLoadMore, hasMore = false, className }: ActivityFeedProps) {
  const types: ActivityType[] = ['upload', 'audit', 'correction', 'comment', 'status_change', 'report'];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filterType === null ? 'primary' : 'ghost'} size="sm" onClick={() => onFilterChange?.(null)}>All</Button>
        {types.map((t) => (
          <Button key={t} variant={filterType === t ? 'primary' : 'ghost'} size="sm" onClick={() => onFilterChange?.(t)}>{t.replace('_', ' ')}</Button>
        ))}
      </div>

      <div className="space-y-1">
        {activities.length === 0 && <p className="py-8 text-center text-sm text-[#958da1]">No activity yet</p>}
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.02]">
            <span className="mt-0.5 text-base">{typeIcons[item.type]}</span>
            <div className="flex-1">
              <p className="text-sm text-white">
                <span className="font-medium">{item.userName}</span>{' '}
                <span className="text-white/70">{item.description}</span>
              </p>
              <span className="text-xs text-[#958da1]">{item.createdAt}</span>
            </div>
            <Badge variant={typeColors[item.type]}>{item.type.replace('_', ' ')}</Badge>
          </div>
        ))}
      </div>

      {hasMore && <Button variant="ghost" size="sm" onClick={onLoadMore} className="w-full">Load more</Button>}
    </div>
  );
}
