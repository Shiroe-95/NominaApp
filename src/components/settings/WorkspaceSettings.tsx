'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Badge } from '@/components/ui';

export interface WorkspaceMember {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface WorkspaceItem {
  id: string;
  name: string;
  description: string;
  defaultCountryCode: string;
  memberCount: number;
}

export interface WorkspaceSettingsProps {
  workspaces: WorkspaceItem[];
  members?: WorkspaceMember[];
  selectedWorkspaceId?: string;
  onCreate?: (data: { name: string; description: string; defaultCountryCode: string }) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  onInvite?: (workspaceId: string, email: string, role: string) => void;
  className?: string;
}

const memberRoles = ['owner', 'editor', 'viewer'] as const;

export function WorkspaceSettings({
  workspaces, members = [], selectedWorkspaceId, onCreate, onDelete, onSelect, onInvite, className,
}: WorkspaceSettingsProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');

  const handleCreate = () => {
    onCreate?.({ name, description, defaultCountryCode: country });
    setName(''); setDescription(''); setCountry('');
    setShowCreate(false);
  };

  const handleInvite = () => {
    if (selectedWorkspaceId && inviteEmail) {
      onInvite?.(selectedWorkspaceId, inviteEmail, inviteRole);
      setInviteEmail('');
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Workspaces</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Workspace'}
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#181b26] p-4">
          <div><Label htmlFor="ws-name">Name</Label><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering Team" /></div>
          <div><Label htmlFor="ws-desc">Description</Label><Input id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Workspace for engineering" /></div>
          <div><Label htmlFor="ws-country">Default Country</Label><Input id="ws-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="CO" /></div>
          <Button variant="primary" size="sm" onClick={handleCreate}>Create</Button>
        </div>
      )}

      <div className="space-y-3">
        {workspaces.length === 0 && <p className="py-6 text-center text-sm text-[#958da1]">No workspaces</p>}
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={cn(
              'rounded-xl border border-white/10 bg-[#181b26] p-4 cursor-pointer transition-colors',
              selectedWorkspaceId === ws.id && 'border-[#7C3AED]/50',
            )}
            onClick={() => onSelect?.(ws.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{ws.name}</p>
                <p className="text-xs text-[#958da1]">{ws.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{ws.defaultCountryCode}</Badge>
                <Badge variant="outline">{ws.memberCount} members</Badge>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete?.(ws.id); }}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedWorkspaceId && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Members</h3>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0e1117] px-3 py-2">
                <div>
                  <p className="text-sm text-white">{m.fullName}</p>
                  <p className="text-xs text-[#958da1]">{m.email}</p>
                </div>
                <Badge variant="outline">{m.role}</Badge>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" className="flex-1" />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0e1117] px-2 text-sm text-white"
            >
              {memberRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={handleInvite}>Invite</Button>
          </div>
        </div>
      )}
    </div>
  );
}
