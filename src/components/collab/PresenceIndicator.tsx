'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface PresenceIndicatorProps {
  users: PresenceUser[];
  maxVisible?: number;
  className?: string;
}

export function PresenceIndicator({ users, maxVisible = 4, className }: PresenceIndicatorProps) {
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center -space-x-2', className)} aria-label={`${users.length} users editing`}>
        {visible.map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <div className={cn('relative rounded-full ring-2 ring-[#0f1117]', user.isActive ? 'ring-green-500/50' : 'ring-white/10')}>
                <Avatar className="h-7 w-7">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.userName} />}
                  <AvatarFallback className="text-[10px]">
                    {user.userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.isActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f1117] bg-green-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>{user.userName}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#262a35] text-[10px] font-medium text-[#958da1] ring-2 ring-[#0f1117]">
            +{overflow}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
