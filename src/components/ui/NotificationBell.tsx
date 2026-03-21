'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Info,
  AlertTriangle,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationRow } from '@/lib/types/regulatory-sync';

const POLL_INTERVAL = 30_000; // 30 seconds
const MAX_VISIBLE = 10;

/** Map severity → icon + color classes */
const severityConfig = {
  info: {
    Icon: Info,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  critical: {
    Icon: AlertCircle,
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
  },
} as const;

/** Returns a human-readable relative time string in Spanish */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `hace ${diffWeek}sem`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch notifications ────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.notifications ?? []);
    } catch {
      // silently ignore – will retry on next poll
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // ── Click outside to close ─────────────────────────────────────────
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // ── Mark as read ───────────────────────────────────────────────────
  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n,
      ),
    );

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, is_read: false, read_at: null } : n,
          ),
        );
      }
    } catch {
      // Revert on network error
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: false, read_at: null } : n,
        ),
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const visible = notifications.slice(0, MAX_VISIBLE);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Notificaciones"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold leading-none text-white ring-2 ring-navy-light">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 overflow-hidden rounded-2xl border border-white/10 bg-navy-light shadow-lg shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">
                Notificaciones
              </p>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet/20 px-1.5 text-[11px] font-semibold text-violet-light">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-slate-400 hover:text-white"
              aria-label="Cerrar notificaciones"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-[360px] divide-y divide-white/5 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No hay notificaciones
              </div>
            ) : (
              visible.map((n) => {
                const sev =
                  severityConfig[n.severity] ?? severityConfig.info;
                const { Icon } = sev;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5',
                      !n.is_read && 'bg-violet/[0.04]',
                    )}
                  >
                    {/* Severity icon */}
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        sev.iconBg,
                      )}
                    >
                      <Icon
                        className={cn('h-4 w-4', sev.iconColor)}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-200">
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-light" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {n.body}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {relativeTime(n.created_at)}
                        </span>
                        {!n.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(n.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-violet transition-colors hover:text-violet-light"
                          >
                            <Check className="h-3 w-3" />
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
