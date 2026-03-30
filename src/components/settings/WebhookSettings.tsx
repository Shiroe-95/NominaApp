'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Badge, Checkbox } from '@/components/ui';

export type WebhookEvent = 'payroll.uploaded' | 'audit.completed' | 'correction.applied' | 'report.generated' | 'rule.updated' | 'user.invited' | 'action.status_changed';

export interface WebhookItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  secret: string;
}

export interface WebhookSettingsProps {
  webhooks: WebhookItem[];
  onCreate?: (data: { url: string; events: WebhookEvent[]; secret: string }) => void;
  onDelete?: (id: string) => void;
  onTest?: (id: string) => void;
  onToggle?: (id: string, active: boolean) => void;
  className?: string;
}

const allEvents: WebhookEvent[] = ['payroll.uploaded', 'audit.completed', 'correction.applied', 'report.generated', 'rule.updated', 'user.invited', 'action.status_changed'];

export function WebhookSettings({ webhooks, onCreate, onDelete, onTest, onToggle, className }: WebhookSettingsProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  };

  const handleCreate = () => {
    onCreate?.({ url, events: selectedEvents, secret });
    setUrl('');
    setSecret('');
    setSelectedEvents([]);
    setShowCreate(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Webhooks</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add Webhook'}
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#181b26] p-4">
          <div><Label htmlFor="wh-url">Endpoint URL</Label><Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" /></div>
          <div><Label htmlFor="wh-secret">HMAC Secret</Label><Input id="wh-secret" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="whsec_..." /></div>
          <div>
            <Label>Events</Label>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {allEvents.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <Checkbox checked={selectedEvents.includes(evt)} onCheckedChange={() => toggleEvent(evt)} />
                  {evt}
                </label>
              ))}
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={handleCreate}>Create Webhook</Button>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.length === 0 && <p className="py-6 text-center text-sm text-[#958da1]">No webhooks configured</p>}
        {webhooks.map((wh) => (
          <div key={wh.id} className="rounded-xl border border-white/10 bg-[#181b26] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white truncate max-w-xs">{wh.url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {wh.events.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={wh.isActive ? 'default' : 'outline'}>{wh.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button variant="ghost" size="sm" onClick={() => onTest?.(wh.id)}>Test</Button>
                <Button variant="ghost" size="sm" onClick={() => onToggle?.(wh.id, !wh.isActive)}>{wh.isActive ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete?.(wh.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
