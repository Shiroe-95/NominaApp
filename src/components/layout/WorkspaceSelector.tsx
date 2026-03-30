'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui';

export interface Workspace {
  id: string;
  name: string;
  defaultCountryCode: string;
}

export interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitch?: (workspaceId: string) => void;
  onManage?: () => void;
  className?: string;
}

export function WorkspaceSelector({ workspaces, activeWorkspaceId, onSwitch, onManage, className }: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg border border-white/10 bg-[#181b26] px-3 py-1.5 text-sm text-white hover:bg-[#262a35] transition-colors',
            className
          )}
          aria-label="Switch workspace"
        >
          <span className="truncate max-w-[140px]">{active?.name ?? 'Select workspace'}</span>
          <svg className="h-4 w-4 text-[#958da1]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onSelect={() => { onSwitch?.(ws.id); setOpen(false); }}
            className={cn(ws.id === activeWorkspaceId && 'bg-[#7C3AED]/10 text-[#7C3AED]')}
          >
            <span className="truncate">{ws.name}</span>
            <span className="ml-auto text-xs text-[#958da1]">{ws.defaultCountryCode}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onManage?.()}>
          Manage Workspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
