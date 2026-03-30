'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Pagination } from '@/components/ui';
import type { BadgeProps } from '@/components/ui/Badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  resourceType: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  ipAddress: string;
}

export default function AuditTrailPage() {
  const [entries] = useState<AuditEntry[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);

  const severityColor: Record<string, BadgeVariant> = {
    info: 'info',
    warning: 'warning',
    critical: 'critical',
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search by user..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="w-48" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Action type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#181b26]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[#958da1]">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#958da1]">No audit entries found</td></tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-white/5 text-white hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xs text-[#958da1]">{entry.createdAt}</td>
                <td className="px-4 py-3">{entry.userName}</td>
                <td className="px-4 py-3">{entry.actionType}</td>
                <td className="px-4 py-3">{entry.resourceType}</td>
                <td className="px-4 py-3"><Badge variant={severityColor[entry.severity] ?? 'default'}>{entry.severity}</Badge></td>
                <td className="px-4 py-3 text-xs text-[#958da1]">{entry.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination hasNextPage={false} hasPreviousPage={false} onNextPage={() => setCursor(cursor)} onPreviousPage={() => setCursor(null)} />
    </div>
  );
}
