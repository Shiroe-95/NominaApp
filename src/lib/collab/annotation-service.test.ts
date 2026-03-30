import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
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
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let annotationsMock: ReturnType<typeof createChainMock>;
let repliesMock: ReturnType<typeof createChainMock>;
let notificationsMock: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === 'annotations') return annotationsMock.chain;
  if (table === 'annotation_replies') return repliesMock.chain;
  if (table === 'notifications') return notificationsMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  createAnnotation,
  getAnnotation,
  listAnnotations,
  addReply,
  resolveAnnotation,
  unresolveAnnotation,
  deleteAnnotation,
  DEFAULT_PAGE_SIZE,
  type AnnotationRow,
  type AnnotationReplyRow,
  type CreateAnnotationInput,
  type AddReplyInput,
} from './annotation-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeAnnotationInput(overrides: Partial<CreateAnnotationInput> = {}): CreateAnnotationInput {
  return {
    workspace_id: 'ws-001',
    author_id: 'user-001',
    target_type: 'cell',
    target_id: 'target-001',
    content: 'This value looks incorrect',
    ...overrides,
  };
}

function makeAnnotationRow(overrides: Partial<AnnotationRow> = {}): AnnotationRow {
  return {
    id: 'ann-001',
    workspace_id: 'ws-001',
    author_id: 'user-001',
    target_type: 'cell',
    target_id: 'target-001',
    target_metadata: null,
    content: 'This value looks incorrect',
    mentions: null,
    is_resolved: false,
    created_at: '2025-01-15T10:00:00Z',
    resolved_at: null,
    ...overrides,
  };
}

function makeReplyRow(overrides: Partial<AnnotationReplyRow> = {}): AnnotationReplyRow {
  return {
    id: 'reply-001',
    annotation_id: 'ann-001',
    author_id: 'user-002',
    content: 'I agree, let me fix it',
    mentions: null,
    created_at: '2025-01-15T10:05:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('AnnotationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    annotationsMock = createChainMock();
    repliesMock = createChainMock();
    notificationsMock = createChainMock();
  });

  // ── createAnnotation ────────────────────────────────────────────

  describe('createAnnotation', () => {
    it('inserts an annotation and returns the row', async () => {
      const row = makeAnnotationRow();
      annotationsMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await createAnnotation(makeAnnotationInput());

      expect(result).toEqual(row);
      expect(mockFrom).toHaveBeenCalledWith('annotations');
      expect(annotationsMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-001',
          author_id: 'user-001',
          target_type: 'cell',
          target_id: 'target-001',
          content: 'This value looks incorrect',
          is_resolved: false,
        }),
      );
    });

    it('triggers notifications for mentioned users', async () => {
      const row = makeAnnotationRow({ mentions: ['user-002', 'user-003'] });
      annotationsMock.terminal.mockResolvedValueOnce({ data: row, error: null });
      notificationsMock.chain.insert.mockResolvedValueOnce({ data: [], error: null });

      await createAnnotation(makeAnnotationInput({
        mentions: ['user-002', 'user-003'],
      }));

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(notificationsMock.chain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-002', type: 'mention' }),
          expect.objectContaining({ user_id: 'user-003', type: 'mention' }),
        ]),
      );
    });

    it('does not notify the author even if mentioned', async () => {
      const row = makeAnnotationRow({ mentions: ['user-001'] });
      annotationsMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      await createAnnotation(makeAnnotationInput({
        mentions: ['user-001'], // author mentions themselves
      }));

      // notifications.insert should NOT be called since the only mention is the author
      expect(notificationsMock.chain.insert).not.toHaveBeenCalled();
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        createAnnotation(makeAnnotationInput({ workspace_id: '' })),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when author_id is missing', async () => {
      await expect(
        createAnnotation(makeAnnotationInput({ author_id: '' })),
      ).rejects.toThrow('author_id is required');
    });

    it('throws when content is empty', async () => {
      await expect(
        createAnnotation(makeAnnotationInput({ content: '   ' })),
      ).rejects.toThrow('content is required');
    });

    it('throws on Supabase insert error', async () => {
      annotationsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(
        createAnnotation(makeAnnotationInput()),
      ).rejects.toThrow('Failed to create annotation: RLS violation');
    });

    it('supports all target types', async () => {
      for (const targetType of ['cell', 'finding', 'action_item', 'report_section'] as const) {
        annotationsMock.terminal.mockResolvedValueOnce({
          data: makeAnnotationRow({ target_type: targetType }),
          error: null,
        });

        const result = await createAnnotation(makeAnnotationInput({ target_type: targetType }));
        expect(result.target_type).toBe(targetType);
      }
    });
  });

  // ── getAnnotation ───────────────────────────────────────────────

  describe('getAnnotation', () => {
    it('returns annotation with replies', async () => {
      const annotation = makeAnnotationRow();
      const replies = [makeReplyRow()];

      annotationsMock.terminal.mockResolvedValueOnce({ data: annotation, error: null });
      repliesMock.chain.order.mockResolvedValueOnce({ data: replies, error: null });

      const result = await getAnnotation('ann-001');

      expect(result).toEqual({ ...annotation, replies });
      expect(mockFrom).toHaveBeenCalledWith('annotations');
      expect(mockFrom).toHaveBeenCalledWith('annotation_replies');
    });

    it('returns null when annotation not found', async () => {
      annotationsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await getAnnotation('nonexistent');
      expect(result).toBeNull();
    });

    it('throws when annotationId is empty', async () => {
      await expect(getAnnotation('')).rejects.toThrow('annotationId is required');
    });

    it('throws on Supabase error (non-404)', async () => {
      annotationsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST500', message: 'server error' },
      });

      await expect(getAnnotation('ann-001')).rejects.toThrow(
        'Failed to get annotation: server error',
      );
    });
  });

  // ── listAnnotations ─────────────────────────────────────────────

  describe('listAnnotations', () => {
    it('returns annotations for a workspace', async () => {
      const rows = [makeAnnotationRow()];
      annotationsMock.chain.limit.mockResolvedValueOnce({ data: rows, error: null });

      const result = await listAnnotations({ workspace_id: 'ws-001' });

      expect(result).toEqual(rows);
      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-001');
      expect(annotationsMock.chain.limit).toHaveBeenCalledWith(DEFAULT_PAGE_SIZE);
    });

    it('applies optional filters', async () => {
      annotationsMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listAnnotations({
        workspace_id: 'ws-001',
        target_type: 'finding',
        target_id: 'target-002',
        is_resolved: false,
        author_id: 'user-001',
      });

      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('target_type', 'finding');
      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('target_id', 'target-002');
      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('is_resolved', false);
      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('author_id', 'user-001');
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        listAnnotations({ workspace_id: '' }),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase query error', async () => {
      annotationsMock.chain.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(
        listAnnotations({ workspace_id: 'ws-001' }),
      ).rejects.toThrow('Failed to list annotations: timeout');
    });
  });

  // ── addReply ────────────────────────────────────────────────────

  describe('addReply', () => {
    it('inserts a reply and returns the row', async () => {
      const parent = makeAnnotationRow();
      const reply = makeReplyRow();

      // First call: verify parent annotation exists
      annotationsMock.terminal.mockResolvedValueOnce({ data: parent, error: null });
      // Second call: insert reply
      repliesMock.terminal.mockResolvedValueOnce({ data: reply, error: null });

      const result = await addReply({
        annotation_id: 'ann-001',
        author_id: 'user-002',
        content: 'I agree, let me fix it',
      });

      expect(result).toEqual(reply);
      expect(mockFrom).toHaveBeenCalledWith('annotation_replies');
    });

    it('triggers notifications for mentioned users in reply', async () => {
      const parent = makeAnnotationRow();
      const reply = makeReplyRow({ mentions: ['user-003'] });

      annotationsMock.terminal.mockResolvedValueOnce({ data: parent, error: null });
      repliesMock.terminal.mockResolvedValueOnce({ data: reply, error: null });
      notificationsMock.chain.insert.mockResolvedValueOnce({ data: [], error: null });

      await addReply({
        annotation_id: 'ann-001',
        author_id: 'user-002',
        content: 'Check this @user-003',
        mentions: ['user-003'],
      });

      expect(mockFrom).toHaveBeenCalledWith('notifications');
    });

    it('throws when annotation not found', async () => {
      annotationsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      await expect(
        addReply({ annotation_id: 'nonexistent', author_id: 'user-002', content: 'reply' }),
      ).rejects.toThrow('Annotation not found');
    });

    it('throws when annotation_id is empty', async () => {
      await expect(
        addReply({ annotation_id: '', author_id: 'user-002', content: 'reply' }),
      ).rejects.toThrow('annotation_id is required');
    });

    it('throws when content is empty', async () => {
      await expect(
        addReply({ annotation_id: 'ann-001', author_id: 'user-002', content: '' }),
      ).rejects.toThrow('content is required');
    });
  });

  // ── resolveAnnotation ───────────────────────────────────────────

  describe('resolveAnnotation', () => {
    it('marks annotation as resolved', async () => {
      const resolved = makeAnnotationRow({ is_resolved: true, resolved_at: '2025-01-15T12:00:00Z' });
      annotationsMock.terminal.mockResolvedValueOnce({ data: resolved, error: null });

      const result = await resolveAnnotation('ann-001', 'user-001');

      expect(result.is_resolved).toBe(true);
      expect(result.resolved_at).toBeTruthy();
      expect(annotationsMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_resolved: true }),
      );
    });

    it('throws when annotationId is empty', async () => {
      await expect(resolveAnnotation('', 'user-001')).rejects.toThrow('annotationId is required');
    });

    it('throws on Supabase error', async () => {
      annotationsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(resolveAnnotation('ann-001', 'user-001')).rejects.toThrow(
        'Failed to resolve annotation: not found',
      );
    });
  });

  // ── unresolveAnnotation ─────────────────────────────────────────

  describe('unresolveAnnotation', () => {
    it('marks annotation as unresolved', async () => {
      const unresolved = makeAnnotationRow({ is_resolved: false, resolved_at: null });
      annotationsMock.terminal.mockResolvedValueOnce({ data: unresolved, error: null });

      const result = await unresolveAnnotation('ann-001', 'user-001');

      expect(result.is_resolved).toBe(false);
      expect(result.resolved_at).toBeNull();
      expect(annotationsMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_resolved: false, resolved_at: null }),
      );
    });

    it('throws when annotationId is empty', async () => {
      await expect(unresolveAnnotation('', 'user-001')).rejects.toThrow('annotationId is required');
    });
  });

  // ── deleteAnnotation ────────────────────────────────────────────

  describe('deleteAnnotation', () => {
    it('deletes the annotation', async () => {
      annotationsMock.chain.eq.mockResolvedValueOnce({ error: null });

      await deleteAnnotation('ann-001');

      expect(mockFrom).toHaveBeenCalledWith('annotations');
      expect(annotationsMock.chain.delete).toHaveBeenCalled();
      expect(annotationsMock.chain.eq).toHaveBeenCalledWith('id', 'ann-001');
    });

    it('throws when annotationId is empty', async () => {
      await expect(deleteAnnotation('')).rejects.toThrow('annotationId is required');
    });

    it('throws on Supabase error', async () => {
      annotationsMock.chain.eq.mockResolvedValueOnce({
        error: { message: 'FK constraint' },
      });

      await expect(deleteAnnotation('ann-001')).rejects.toThrow(
        'Failed to delete annotation: FK constraint',
      );
    });
  });

  // ── Constants ───────────────────────────────────────────────────

  describe('constants', () => {
    it('DEFAULT_PAGE_SIZE is 50', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(50);
    });
  });
});
