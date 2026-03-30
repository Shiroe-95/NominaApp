import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown; count?: number }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = terminal;
  chain.maybeSingle = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let workspacesMock: ReturnType<typeof createChainMock>;
let membersMock: ReturnType<typeof createChainMock>;
let profilesMock: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === 'workspaces') return workspacesMock.chain;
  if (table === 'workspace_members') return membersMock.chain;
  if (table === 'user_profiles') return profilesMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  inviteMember,
  acceptInvite,
  removeMember,
  changeRole,
  switchWorkspace,
  listWorkspaceMembers,
  listUserWorkspaces,
  getActiveWorkspaceId,
  WORKSPACE_ROLES,
  type WorkspaceRow,
  type WorkspaceMemberRow,
} from './workspace-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeWorkspace(overrides: Partial<WorkspaceRow> = {}): WorkspaceRow {
  return {
    id: 'ws-001',
    name: 'Test Workspace',
    description: 'A test workspace',
    default_country_code: 'CO',
    data_region: 'sa',
    organization_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMember(overrides: Partial<WorkspaceMemberRow> = {}): WorkspaceMemberRow {
  return {
    id: 'mem-001',
    workspace_id: 'ws-001',
    user_id: 'user-001',
    role: 'owner',
    joined_at: '2025-01-01T00:00:00Z',
    invited_at: '2025-01-01T00:00:00Z',
    invite_status: 'accepted',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('WorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspacesMock = createChainMock();
    membersMock = createChainMock();
    profilesMock = createChainMock();
  });

  // ── createWorkspace ─────────────────────────────────────────────

  describe('createWorkspace', () => {
    it('creates a workspace and adds creator as owner', async () => {
      const ws = makeWorkspace();
      workspacesMock.terminal.mockResolvedValueOnce({ data: ws, error: null });
      membersMock.terminal.mockResolvedValueOnce({ data: null, error: null });

      const result = await createWorkspace('user-001', {
        name: 'Test Workspace',
        default_country_code: 'CO',
        data_region: 'sa',
      });

      expect(result.id).toBe('ws-001');
      expect(mockFrom).toHaveBeenCalledWith('workspaces');
      expect(mockFrom).toHaveBeenCalledWith('workspace_members');
      expect(membersMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-001',
          user_id: 'user-001',
          role: 'owner',
          invite_status: 'accepted',
        }),
      );
    });

    it('throws when user_id is empty', async () => {
      await expect(
        createWorkspace('', { name: 'Test', default_country_code: 'CO' }),
      ).rejects.toThrow('user_id is required');
    });

    it('throws on invalid input (Zod validation)', async () => {
      await expect(
        createWorkspace('user-001', { name: '', default_country_code: 'CO' }),
      ).rejects.toThrow();
    });

    it('rolls back workspace on member insert failure', async () => {
      const ws = makeWorkspace();
      workspacesMock.terminal.mockResolvedValueOnce({ data: ws, error: null });
      // Member insert fails
      membersMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'FK violation' },
      });
      // Delete rollback
      workspacesMock.chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      await expect(
        createWorkspace('user-001', { name: 'Test', default_country_code: 'CO' }),
      ).rejects.toThrow('Failed to add creator as owner');
    });
  });

  // ── getWorkspace ────────────────────────────────────────────────

  describe('getWorkspace', () => {
    it('returns a workspace by ID', async () => {
      const ws = makeWorkspace();
      workspacesMock.terminal.mockResolvedValueOnce({ data: ws, error: null });

      const result = await getWorkspace('ws-001');

      expect(result.id).toBe('ws-001');
      expect(result.name).toBe('Test Workspace');
    });

    it('throws when workspace_id is empty', async () => {
      await expect(getWorkspace('')).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase error', async () => {
      workspacesMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(getWorkspace('ws-999')).rejects.toThrow('Failed to get workspace: not found');
    });
  });

  // ── updateWorkspace ─────────────────────────────────────────────

  describe('updateWorkspace', () => {
    it('updates workspace fields when user is owner', async () => {
      // getMember (requireRole) call
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // update call
      const updated = makeWorkspace({ name: 'Updated' });
      workspacesMock.terminal.mockResolvedValueOnce({ data: updated, error: null });

      const result = await updateWorkspace('ws-001', 'user-001', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws when user is not owner', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'editor' }),
        error: null,
      });

      await expect(
        updateWorkspace('ws-001', 'user-001', { name: 'Updated' }),
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  // ── deleteWorkspace ─────────────────────────────────────────────

  describe('deleteWorkspace', () => {
    it('deletes workspace when user is owner', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      workspacesMock.chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      await expect(deleteWorkspace('ws-001', 'user-001')).resolves.toBeUndefined();
    });

    it('throws when user is not owner', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'viewer' }),
        error: null,
      });

      await expect(deleteWorkspace('ws-001', 'user-001')).rejects.toThrow('Insufficient permissions');
    });
  });

  // ── inviteMember ────────────────────────────────────────────────

  describe('inviteMember', () => {
    it('invites a user with pending status', async () => {
      // getMember for inviter
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // getMember for target (not found)
      membersMock.terminal.mockResolvedValueOnce({ data: null, error: null });
      // insert
      const newMember = makeMember({
        id: 'mem-002',
        user_id: 'user-002',
        role: 'editor',
        invite_status: 'pending',
      });
      membersMock.terminal.mockResolvedValueOnce({ data: newMember, error: null });

      const result = await inviteMember('ws-001', 'user-001', 'user-002', 'editor');

      expect(result.user_id).toBe('user-002');
      expect(result.role).toBe('editor');
      expect(result.invite_status).toBe('pending');
    });

    it('throws when inviter is a viewer', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'viewer' }),
        error: null,
      });

      await expect(
        inviteMember('ws-001', 'user-001', 'user-002', 'editor'),
      ).rejects.toThrow('Viewers cannot invite members');
    });

    it('throws when editor tries to invite owner', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'editor' }),
        error: null,
      });

      await expect(
        inviteMember('ws-001', 'user-001', 'user-002', 'owner'),
      ).rejects.toThrow('Editors cannot invite owners');
    });

    it('throws when target is already a member', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ user_id: 'user-002' }),
        error: null,
      });

      await expect(
        inviteMember('ws-001', 'user-001', 'user-002', 'editor'),
      ).rejects.toThrow('User is already a member');
    });

    it('throws on invalid role', async () => {
      await expect(
        inviteMember('ws-001', 'user-001', 'user-002', 'superadmin' as any),
      ).rejects.toThrow('Invalid role');
    });
  });

  // ── acceptInvite ────────────────────────────────────────────────

  describe('acceptInvite', () => {
    it('accepts a pending invitation', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ invite_status: 'pending' }),
        error: null,
      });
      const accepted = makeMember({ invite_status: 'accepted' });
      membersMock.terminal.mockResolvedValueOnce({ data: accepted, error: null });

      const result = await acceptInvite('ws-001', 'user-001');

      expect(result.invite_status).toBe('accepted');
    });

    it('throws when already accepted', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ invite_status: 'accepted' }),
        error: null,
      });

      await expect(acceptInvite('ws-001', 'user-001')).rejects.toThrow('already accepted');
    });

    it('throws when invitation expired', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ invite_status: 'expired' }),
        error: null,
      });

      await expect(acceptInvite('ws-001', 'user-001')).rejects.toThrow('expired');
    });

    it('throws when no invitation found', async () => {
      membersMock.terminal.mockResolvedValueOnce({ data: null, error: null });

      await expect(acceptInvite('ws-001', 'user-999')).rejects.toThrow('No invitation found');
    });
  });

  // ── removeMember ────────────────────────────────────────────────

  describe('removeMember', () => {
    it('removes a member when remover is owner', async () => {
      // requireRole
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // delete chain
      membersMock.chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      await expect(removeMember('ws-001', 'user-001', 'user-002')).resolves.toBeUndefined();
    });

    it('prevents removing the last owner (self-removal)', async () => {
      // requireRole
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // getOwnerCount — select with count
      membersMock.chain.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ count: 1, error: null }),
        }),
      });

      await expect(
        removeMember('ws-001', 'user-001', 'user-001'),
      ).rejects.toThrow('Cannot remove the last owner');
    });
  });

  // ── changeRole ──────────────────────────────────────────────────

  describe('changeRole', () => {
    it('changes a member role', async () => {
      // requireRole (changer is owner)
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // getMember (target)
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ id: 'mem-002', user_id: 'user-002', role: 'viewer' }),
        error: null,
      });
      // update
      const updated = makeMember({ id: 'mem-002', user_id: 'user-002', role: 'editor' });
      membersMock.terminal.mockResolvedValueOnce({ data: updated, error: null });

      const result = await changeRole('ws-001', 'user-001', 'user-002', 'editor');

      expect(result.role).toBe('editor');
    });

    it('prevents demoting the last owner', async () => {
      // requireRole
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner' }),
        error: null,
      });
      // getMember (target is owner)
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ role: 'owner', user_id: 'user-002' }),
        error: null,
      });
      // getOwnerCount
      membersMock.chain.select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValueOnce({ count: 1, error: null }),
        }),
      });

      await expect(
        changeRole('ws-001', 'user-001', 'user-002', 'editor'),
      ).rejects.toThrow('Cannot demote the last owner');
    });

    it('throws on invalid role', async () => {
      await expect(
        changeRole('ws-001', 'user-001', 'user-002', 'superadmin' as any),
      ).rejects.toThrow('Invalid role');
    });
  });

  // ── switchWorkspace ─────────────────────────────────────────────

  describe('switchWorkspace', () => {
    it('updates active_workspace_id on user profile', async () => {
      // getMember
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ invite_status: 'accepted' }),
        error: null,
      });
      // update user_profiles
      profilesMock.chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });

      await expect(switchWorkspace('user-001', 'ws-001')).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    });

    it('throws when user is not a member', async () => {
      membersMock.terminal.mockResolvedValueOnce({ data: null, error: null });

      await expect(switchWorkspace('user-001', 'ws-999')).rejects.toThrow('not a member');
    });

    it('throws when invitation not accepted', async () => {
      membersMock.terminal.mockResolvedValueOnce({
        data: makeMember({ invite_status: 'pending' }),
        error: null,
      });

      await expect(switchWorkspace('user-001', 'ws-001')).rejects.toThrow('not accepted');
    });
  });

  // ── listWorkspaceMembers ────────────────────────────────────────

  describe('listWorkspaceMembers', () => {
    it('returns all members of a workspace', async () => {
      const members = [makeMember(), makeMember({ id: 'mem-002', user_id: 'user-002', role: 'editor' })];
      membersMock.chain.order.mockResolvedValueOnce({ data: members, error: null });

      const result = await listWorkspaceMembers('ws-001');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('owner');
      expect(result[1].role).toBe('editor');
    });

    it('throws when workspace_id is empty', async () => {
      await expect(listWorkspaceMembers('')).rejects.toThrow('workspace_id is required');
    });
  });

  // ── listUserWorkspaces ──────────────────────────────────────────

  describe('listUserWorkspaces', () => {
    it('returns workspaces the user belongs to', async () => {
      // First query: get memberships
      membersMock.chain.eq = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({
          data: [{ workspace_id: 'ws-001' }, { workspace_id: 'ws-002' }],
          error: null,
        }),
      });
      // Second query: get workspaces
      const workspaces = [makeWorkspace(), makeWorkspace({ id: 'ws-002', name: 'Second' })];
      workspacesMock.chain.order.mockResolvedValueOnce({ data: workspaces, error: null });

      const result = await listUserWorkspaces('user-001');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when user has no memberships', async () => {
      membersMock.chain.eq = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      });

      const result = await listUserWorkspaces('user-001');

      expect(result).toEqual([]);
    });

    it('throws when user_id is empty', async () => {
      await expect(listUserWorkspaces('')).rejects.toThrow('user_id is required');
    });
  });

  // ── getActiveWorkspaceId ────────────────────────────────────────

  describe('getActiveWorkspaceId', () => {
    it('returns the active workspace ID', async () => {
      profilesMock.terminal.mockResolvedValueOnce({
        data: { active_workspace_id: 'ws-001' },
        error: null,
      });

      const result = await getActiveWorkspaceId('user-001');

      expect(result).toBe('ws-001');
    });

    it('returns null when no active workspace set', async () => {
      profilesMock.terminal.mockResolvedValueOnce({
        data: { active_workspace_id: null },
        error: null,
      });

      const result = await getActiveWorkspaceId('user-001');

      expect(result).toBeNull();
    });

    it('throws when user_id is empty', async () => {
      await expect(getActiveWorkspaceId('')).rejects.toThrow('user_id is required');
    });
  });

  // ── Constants ───────────────────────────────────────────────────

  describe('constants', () => {
    it('WORKSPACE_ROLES contains owner, editor, viewer', () => {
      expect(WORKSPACE_ROLES).toEqual(['owner', 'editor', 'viewer']);
    });
  });
});
