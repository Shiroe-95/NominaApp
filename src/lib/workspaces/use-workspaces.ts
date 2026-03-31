'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WorkspaceInfo {
  id: string;
  name: string;
  description: string;
  defaultCountryCode: string;
  role: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

/**
 * Hook to manage workspace state: list, switch, CRUD.
 * Consumes /api/v1/workspaces endpoints.
 */
export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces ?? []);
        setActiveWorkspaceId(data.activeWorkspaceId ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/switch`, { method: 'POST' });
    if (res.ok) {
      setActiveWorkspaceId(workspaceId);
      // Trigger data reload across the app
      window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId } }));
    }
  }, []);

  const createWorkspace = useCallback(async (data: { name: string; description: string; defaultCountryCode: string }) => {
    const res = await fetch('/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) await fetchWorkspaces();
    return res.ok;
  }, [fetchWorkspaces]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE' });
    if (res.ok) await fetchWorkspaces();
    return res.ok;
  }, [fetchWorkspaces]);

  const inviteMember = useCallback(async (workspaceId: string, email: string, role: string) => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    return res.ok;
  }, []);

  return {
    workspaces,
    activeWorkspaceId,
    loading,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    inviteMember,
    refresh: fetchWorkspaces,
  };
}
