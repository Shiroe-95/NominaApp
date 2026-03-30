'use client';

import { cn } from '@/lib/utils';

export interface RecentActivity {
  id: string;
  type: string;
  userName: string;
  description: string;
  createdAt: string;
}

export interface ActivityWidgetProps {
  activities: RecentActivity[];
  onViewAll?: () => void;
  className?: string;
}

const typeIcons: Record<string, string> = {
  upload: '📤',
  audit: '🔍',
  correction: '✏️',
  comment: '💬',
  status_change: '🔄',
  report: '📊',
};

export function ActivityWidget({ activities, onViewAll, className }: ActivityWidgetProps) {
  const recent = activities.slice(0, 10);

  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26] p-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-[#7C3AED] hover:underline">View all</button>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {recent.length === 0 && <p className="py-4 text-center text-xs text-[#958da1]">No recent activity</p>}
        {recent.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
            <span className="text-sm">{typeIcons[item.type] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs text-white">
                <span className="font-medium">{item.userName}</span> {item.description}
              </p>
            </div>
            <span className="shrink-0 text-[10px] text-[#958da1]">{item.createdAt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
