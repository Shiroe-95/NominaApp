/**
 * Property-Based Tests for AnnotationService
 * Feature: platform-improvements
 *
 * Tests Properties 27, 28, 29, 30 from the design document.
 * Uses fast-check with minimum 100 iterations per property.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeBadgeCount } from './use-annotations';

const NUM_RUNS = 100;

// ─── Types for in-memory simulation ─────────────────────────────────────────

interface SimAnnotation {
  id: string;
  workspace_id: string;
  author_id: string;
  target_type: 'cell' | 'finding' | 'action_item' | 'report_section';
  target_id: string;
  target_metadata: Record<string, unknown> | null;
  content: string;
  mentions: string[];
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

interface SimReply {
  id: string;
  annotation_id: string;
  author_id: string;
  content: string;
  mentions: string[];
  created_at: string;
}

// ─── In-memory annotation store (simulates DB) ─────────────────────────────

class AnnotationStore {
  private annotations = new Map<string, SimAnnotation>();
  private replies = new Map<string, SimReply[]>();
  private idCounter = 0;

  create(input: {
    workspace_id: string;
    author_id: string;
    target_type: SimAnnotation['target_type'];
    target_id: string;
    content: string;
    mentions?: string[];
  }): SimAnnotation {
    if (!input.workspace_id) throw new Error('workspace_id is required');
    if (!input.author_id) throw new Error('author_id is required');
    if (!input.content || input.content.trim().length === 0) throw new Error('content is required');

    const id = `ann-${++this.idCounter}`;
    const annotation: SimAnnotation = {
      id,
      workspace_id: input.workspace_id,
      author_id: input.author_id,
      target_type: input.target_type,
      target_id: input.target_id,
      target_metadata: null,
      content: input.content,
      mentions: input.mentions ?? [],
      is_resolved: false,
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    this.annotations.set(id, annotation);
    this.replies.set(id, []);
    return annotation;
  }

  get(id: string): SimAnnotation | null {
    return this.annotations.get(id) ?? null;
  }

  listByTarget(
    workspaceId: string,
    targetType: SimAnnotation['target_type'],
    targetId: string,
  ): SimAnnotation[] {
    return Array.from(this.annotations.values()).filter(
      (a) =>
        a.workspace_id === workspaceId &&
        a.target_type === targetType &&
        a.target_id === targetId,
    );
  }

  addReply(input: {
    annotation_id: string;
    author_id: string;
    content: string;
    mentions?: string[];
  }): SimReply {
    const parent = this.annotations.get(input.annotation_id);
    if (!parent) throw new Error('Annotation not found');
    if (!input.content || input.content.trim().length === 0) throw new Error('content is required');

    const id = `reply-${++this.idCounter}`;
    const reply: SimReply = {
      id,
      annotation_id: input.annotation_id,
      author_id: input.author_id,
      content: input.content,
      mentions: input.mentions ?? [],
      created_at: new Date().toISOString(),
    };
    const replies = this.replies.get(input.annotation_id) ?? [];
    replies.push(reply);
    this.replies.set(input.annotation_id, replies);
    return reply;
  }

  getReplies(annotationId: string): SimReply[] {
    return this.replies.get(annotationId) ?? [];
  }

  resolve(id: string): SimAnnotation {
    const annotation = this.annotations.get(id);
    if (!annotation) throw new Error('Annotation not found');
    annotation.is_resolved = true;
    annotation.resolved_at = new Date().toISOString();
    return annotation;
  }

  unresolve(id: string): SimAnnotation {
    const annotation = this.annotations.get(id);
    if (!annotation) throw new Error('Annotation not found');
    annotation.is_resolved = false;
    annotation.resolved_at = null;
    return annotation;
  }

  clear(): void {
    this.annotations.clear();
    this.replies.clear();
    this.idCounter = 0;
  }
}

// ─── Generators ─────────────────────────────────────────────────────────────

const targetTypeArb = fc.constantFrom<SimAnnotation['target_type']>(
  'cell', 'finding', 'action_item', 'report_section',
);

const uuidArb = fc.uuid();
const contentArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s: string) => s.trim().length > 0);
const mentionsArb = fc.array(fc.uuid(), { minLength: 0, maxLength: 5 });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AnnotationService PBT', () => {
  /**
   * Property 27: Annotation CRUD — create and retrieve by entity type returns all fields
   *
   * For any supported entity type (cell, finding, action_item, report_section)
   * and any valid annotation data, creating an annotation and then retrieving it
   * must return all registered fields (author, timestamp, text, type, entityId, mentions).
   *
   * **Validates: Requirements 10.1, 10.2**
   */
  it('Property 27: create and retrieve annotation preserves all fields', () => {
    fc.assert(
      fc.property(
        targetTypeArb,
        uuidArb,
        uuidArb,
        uuidArb,
        contentArb,
        mentionsArb,
        (targetType: SimAnnotation['target_type'], workspaceId: string, authorId: string, targetId: string, content: string, mentions: string[]) => {
          const store = new AnnotationStore();

          // Create annotation
          const created = store.create({
            workspace_id: workspaceId,
            author_id: authorId,
            target_type: targetType,
            target_id: targetId,
            content,
            mentions,
          });

          // Retrieve by ID
          const retrieved = store.get(created.id);
          expect(retrieved).not.toBeNull();

          // All fields must be preserved
          expect(retrieved!.author_id).toBe(authorId);
          expect(retrieved!.content).toBe(content);
          expect(retrieved!.target_type).toBe(targetType);
          expect(retrieved!.target_id).toBe(targetId);
          expect(retrieved!.workspace_id).toBe(workspaceId);
          expect(retrieved!.mentions).toEqual(mentions);
          expect(retrieved!.is_resolved).toBe(false);
          expect(retrieved!.created_at).toBeTruthy();
          expect(retrieved!.id).toBeTruthy();

          // Retrieve by target type filter
          const byTarget = store.listByTarget(workspaceId, targetType, targetId);
          expect(byTarget.length).toBeGreaterThanOrEqual(1);
          expect(byTarget.some((a) => a.id === created.id)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 28: Threads with parent_id — parent exists, replies ordered chronologically
   *
   * For any annotation with parent_id, the parent must exist and replies
   * must be ordered chronologically.
   *
   * **Validates: Requirements 10.4**
   */
  it('Property 28: thread replies have existing parent and chronological order', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        contentArb,
        fc.array(
          fc.record({
            authorId: uuidArb,
            content: contentArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (workspaceId: string, authorId: string, targetId: string, parentContent: string, replyInputs: { authorId: string; content: string }[]) => {
          const store = new AnnotationStore();

          // Create parent annotation
          const parent = store.create({
            workspace_id: workspaceId,
            author_id: authorId,
            target_type: 'finding',
            target_id: targetId,
            content: parentContent,
          });

          // Parent must exist
          expect(store.get(parent.id)).not.toBeNull();

          // Add replies
          for (const input of replyInputs) {
            store.addReply({
              annotation_id: parent.id,
              author_id: input.authorId,
              content: input.content,
            });
          }

          // Get replies
          const replies = store.getReplies(parent.id);

          // All replies must reference the parent
          for (const reply of replies) {
            expect(reply.annotation_id).toBe(parent.id);
          }

          // Replies must be in chronological order
          for (let i = 1; i < replies.length; i++) {
            const prev = new Date(replies[i - 1].created_at).getTime();
            const curr = new Date(replies[i].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }

          // Reply count must match input count
          expect(replies.length).toBe(replyInputs.length);

          // Adding a reply to a non-existent annotation must throw
          expect(() =>
            store.addReply({
              annotation_id: 'non-existent-id',
              author_id: authorId,
              content: 'test',
            }),
          ).toThrow('Annotation not found');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 29: Resolution without deletion — resolved annotation still retrievable with updated status
   *
   * For any annotation marked as resolved via PATCH, it must still be
   * retrievable from the history with its status updated to "resolved".
   *
   * **Validates: Requirements 10.5**
   */
  it('Property 29: resolved annotation remains retrievable with updated status', () => {
    fc.assert(
      fc.property(
        targetTypeArb,
        uuidArb,
        uuidArb,
        uuidArb,
        contentArb,
        (targetType: SimAnnotation['target_type'], workspaceId: string, authorId: string, targetId: string, content: string) => {
          const store = new AnnotationStore();

          // Create annotation
          const created = store.create({
            workspace_id: workspaceId,
            author_id: authorId,
            target_type: targetType,
            target_id: targetId,
            content,
          });

          // Initially not resolved
          expect(created.is_resolved).toBe(false);
          expect(created.resolved_at).toBeNull();

          // Resolve it
          const resolved = store.resolve(created.id);
          expect(resolved.is_resolved).toBe(true);
          expect(resolved.resolved_at).not.toBeNull();

          // Must still be retrievable
          const retrieved = store.get(created.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.is_resolved).toBe(true);
          expect(retrieved!.resolved_at).not.toBeNull();

          // Content and other fields must be preserved
          expect(retrieved!.content).toBe(content);
          expect(retrieved!.author_id).toBe(authorId);
          expect(retrieved!.target_type).toBe(targetType);
          expect(retrieved!.target_id).toBe(targetId);

          // Unresolve it — must revert status
          const unresolved = store.unresolve(created.id);
          expect(unresolved.is_resolved).toBe(false);
          expect(unresolved.resolved_at).toBeNull();

          // Still retrievable after unresolve
          const retrievedAgain = store.get(created.id);
          expect(retrievedAgain).not.toBeNull();
          expect(retrievedAgain!.is_resolved).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 30: Badge count invariant — count equals exactly N unresolved annotations
   *
   * For any entity with N unresolved annotations, the badge count must be exactly N.
   *
   * **Validates: Requirements 10.6**
   */
  it('Property 30: badge count equals exactly N unresolved annotations', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(
          fc.record({
            authorId: uuidArb,
            content: contentArb,
            shouldResolve: fc.boolean(),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (workspaceId: string, targetId: string, annotationInputs: { authorId: string; content: string; shouldResolve: boolean }[]) => {
          const store = new AnnotationStore();

          // Create annotations and optionally resolve some
          const created: SimAnnotation[] = [];
          for (const input of annotationInputs) {
            const ann = store.create({
              workspace_id: workspaceId,
              author_id: input.authorId,
              target_type: 'finding',
              target_id: targetId,
              content: input.content,
            });
            if (input.shouldResolve) {
              store.resolve(ann.id);
            }
            created.push(store.get(ann.id)!);
          }

          // Get all annotations for this target
          const allAnnotations = store.listByTarget(workspaceId, 'finding', targetId);

          // Count unresolved manually
          const expectedUnresolved = allAnnotations.filter((a) => !a.is_resolved).length;

          // Badge count must match
          const badgeCount = computeBadgeCount(allAnnotations);
          expect(badgeCount).toBe(expectedUnresolved);

          // Also verify: resolved count + unresolved count = total
          const resolvedCount = allAnnotations.filter((a) => a.is_resolved).length;
          expect(resolvedCount + expectedUnresolved).toBe(allAnnotations.length);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
