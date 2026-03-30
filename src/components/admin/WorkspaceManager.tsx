'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Badge } from '@/components/ui';

export interface WorkspaceMember {
  id: string;
  userId: string;
  userName: string;
  role: 'owner' | 'editor' | 'viewer';
  inviteStatus: 'pending' | 'accepted' | 'expired';
}

export interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  defaultCountryCode: string;
  members: WorkspaceMember[];
}

export interface WorkspaceManagerProps {
  workspaces: WorkspaceData[];
  onCreateWorkspace?: (data: { name: string; description: string; defaultCountryCode: string }) => void;
  onDeleteWorkspace?: (id: string) => void;
  onInviteMember?: (workspaceId: string) => void;
  className?: string;
}

export function WorkspaceManager({ workspaces, onCreateWorkspace, onDeleteWorkspace, onInviteMember, className }: WorkspaceManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    onCreateWorkspace?.({ name, description, defaultCountryCode: 'CO' });
    setName('');
    setDescription('');
    setShowCreate(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Workspaces</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'New Workspace'}
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#181b26] p-4">
          <div><Label htmlFor="ws-name">Name</Label><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workspace" /></div>
          <div><Label htmlFor="ws-desc">Description</Label><Input id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" /></div>
          <Button variant="primary" size="sm" onClick={handleCreate}>Create</Button>
        </div>
      )}

      <div className="space-y-3">
        {workspaces.map((ws) => (
          <div key={ws.id} className="rounded-xl border border-white/10 bg-[#181b26] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">{ws.name}</h3>
                <p className="text-sm text-[#958da1]">{ws.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{ws.members.length} members</Badge>
                <Button variant="ghost" size="sm" onClick={() => onInviteMember?.(ws.id)}>Invite</Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteWorkspace?.(ws.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
