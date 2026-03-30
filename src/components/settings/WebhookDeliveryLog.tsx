'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

export interface DeliveryEntry {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  httpStatus: number | null;
  responseTimeMs: number | null;
  attempts: number;
  lastAttemptAt: string;
}

export interface WebhookDeliveryLogProps {
  deliveries: DeliveryEntry[];
  className?: string;
}

const statusColor: Record<string, 'default' | 'destructive' | 'outline'> = {
  success: 'default',
  failed: 'destructive',
  pending: 'outline',
};

export function WebhookDeliveryLog({ deliveries, className }: WebhookDeliveryLogProps) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26]', className)}>
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Delivery Log</h3>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[#958da1]">
            <th className="px-4 py-2">Event</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">HTTP</th>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Attempts</th>
            <th className="px-4 py-2">Last Attempt</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-[#958da1]">No deliveries yet</td></tr>
          )}
          {deliveries.map((d) => (
            <tr key={d.id} className="border-b border-white/5 text-white hover:bg-white/[0.02]">
              <td className="px-4 py-2">{d.event}</td>
              <td className="px-4 py-2"><Badge variant={statusColor[d.status]}>{d.status}</Badge></td>
              <td className="px-4 py-2 text-[#958da1]">{d.httpStatus ?? '—'}</td>
              <td className="px-4 py-2 text-[#958da1]">{d.responseTimeMs != null ? `${d.responseTimeMs}ms` : '—'}</td>
              <td className="px-4 py-2 text-[#958da1]">{d.attempts}</td>
              <td className="px-4 py-2 text-xs text-[#958da1]">{d.lastAttemptAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
