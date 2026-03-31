'use client';

import { cn } from '@/lib/utils';
import { PresenceIndicator, type PresenceUser } from './PresenceIndicator';

export interface CollaborationBannerProps {
  users: PresenceUser[];
  payrollName?: string;
  isConnected: boolean;
  isReconnecting?: boolean;
  pendingChanges?: number;
  className?: string;
}

/**
 * CollaborationBanner — shows count of active editors and presence avatars.
 *
 * Displayed at the top of the PayrollEditor when collaboration is active.
 * Req 9.5: indicator of "users editing" with count and avatars.
 */
export function CollaborationBanner({
  users,
  payrollName,
  isConnected,
  isReconnecting = false,
  pendingChanges = 0,
  className,
}: CollaborationBannerProps) {
  const activeCount = users.filter((u) => u.isActive).length;

  if (!isConnected && !isReconnecting && users.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-4 py-2 text-sm',
        isReconnecting
          ? 'border-amber-500/30 bg-amber-500/5 text-amber-300'
          : isConnected
            ? 'border-white/10 bg-white/[0.02] text-white/70'
            : 'border-red-500/30 bg-red-500/5 text-red-300',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {/* Connection status dot */}
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            isReconnecting ? 'animate-pulse bg-amber-400' : isConnected ? 'bg-green-500' : 'bg-red-500',
          )}
        />

        <span>
          {isReconnecting ? (
            <>Reconnecting…{pendingChanges > 0 && ` (${pendingChanges} pending changes)`}</>
          ) : isConnected ? (
            <>
              {activeCount} {activeCount === 1 ? 'user' : 'users'} editing
              {payrollName && <span className="text-white/40"> — {payrollName}</span>}
            </>
          ) : (
            <>Disconnected{pendingChanges > 0 && ` — ${pendingChanges} unsaved changes`}</>
          )}
        </span>
      </div>

      {users.length > 0 && <PresenceIndicator users={users} maxVisible={6} />}
    </div>
  );
}
