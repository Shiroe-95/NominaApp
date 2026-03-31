'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  isActive: boolean;
  cursorColor?: string;
}

/**
 * 10 unique cursor colors for up to 10 simultaneous collaborators.
 * Req 9.1: each connected user gets a unique cursor color.
 */
export const CURSOR_COLORS = [
  '#7C3AED', // violet
  '#2563EB', // blue
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#DB2777', // pink
  '#0891B2', // cyan
  '#4F46E5', // indigo
  '#65A30D', // lime
  '#EA580C', // orange
] as const;

/** Assign a stable cursor color based on user index */
export function getCursorColor(index: number): string {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

export interface PresenceIndicatorProps {
  users: PresenceUser[];
  maxVisible?: number;
  className?: string;
}

/**
 * PresenceIndicator — shows avatars of connected users with unique cursor colors.
 *
 * Consumes presence data from collaboration-engine.ts.
 * Req 9.1: avatar, name, unique cursor color per user.
 */
export function PresenceIndicator({ users, maxVisible = 4, className }: PresenceIndicatorProps) {
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center -space-x-2', className)} aria-label={`${users.length} users editing`}>
        {visible.map((user, idx) => {
          const color = user.cursorColor ?? getCursorColor(idx);
          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div
                  className={cn('relative rounded-full ring-2', user.isActive ? 'ring-opacity-70' : 'ring-white/10')}
                  style={user.isActive ? { ringColor: color, boxShadow: `0 0 0 2px ${color}` } : undefined}
                >
                  <Avatar className="h-7 w-7">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.userName} />}
                    <AvatarFallback className="text-[10px]" style={{ backgroundColor: `${color}33`, color }}>
                      {user.userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.isActive && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f1117]"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>{user.userName}</TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#262a35] text-[10px] font-medium text-[#958da1] ring-2 ring-[#0f1117]">
            +{overflow}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
