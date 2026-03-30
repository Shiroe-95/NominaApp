'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';

export interface WorkspaceInviteProps {
  workspaceId: string;
  workspaceName: string;
  onInvite?: (data: { email: string; role: string }) => void;
  onCancel?: () => void;
  className?: string;
}

export function WorkspaceInvite({ workspaceId, workspaceName, onInvite, onCancel, className }: WorkspaceInviteProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('viewer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite?.({ email, role });
    setEmail('');
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4 rounded-xl border border-white/10 bg-[#181b26] p-6', className)}>
      <h3 className="text-lg font-semibold text-white">Invite to {workspaceName}</h3>
      <p className="text-xs text-[#958da1]">Workspace ID: {workspaceId}</p>

      <div>
        <Label htmlFor="invite-email">Email Address</Label>
        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
      </div>

      <div>
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Send Invitation</Button>
      </div>
    </form>
  );
}
