import { createAdminClient } from '@/lib/supabase/admin';
import type { AnnotationInput } from '@/lib/schemas/world-class-schemas';

/**
 * AnnotationService — CRUD annotations on cells, findings, action items,
 * and report sections with threaded replies, mentions, and resolve/unresolve.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 *
 * @module lib/collab/annotation-service
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnnotationRow {
  id: string;
  workspace_id: string;
  author_id: string;
  target_type: 'cell' | 'finding' | 'action_item' | 'report_section';
  target_id: string;
  target_metadata: Record<string, unknown> | null;
  content: string;
  mentions: string[] | null;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface AnnotationReplyRow {
  id: string;
  annotation_id: string;
  author_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
}

export interface CreateAnnotationInput {
  workspace_id: string;
  author_id: string;
  target_type: AnnotationInput['target_type'];
  target_id: string;
  target_metadata?: Record<string, unknown>;
  content: string;
  mentions?: string[];
}

export interface AddReplyInput {
  annotation_id: string;
  author_id: string;
  content: string;
  mentions?: string[];
}

export interface ListAnnotationsFilters {
  workspace_id: string;
  target_type?: AnnotationInput['target_type'];
  target_id?: string;
  is_resolved?: boolean;
  author_id?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default page size for listing annotations */
export const DEFAULT_PAGE_SIZE = 50;


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create an annotation on a cell, finding, action item, or report section.
 *
 * Req 12.1: Create comments associated to specific targets.
 * Req 12.2: Record author, timestamp, content, target, and mentions.
 * Req 12.3: Trigger notifications for mentioned users.
 *
 * @returns The newly created annotation row.
 */
export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<AnnotationRow> {
  if (!input.workspace_id) {
    throw new Error('workspace_id is required');
  }
  if (!input.author_id) {
    throw new Error('author_id is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('annotations')
    .insert({
      workspace_id: input.workspace_id,
      author_id: input.author_id,
      target_type: input.target_type,
      target_id: input.target_id,
      target_metadata: input.target_metadata ?? null,
      content: input.content,
      mentions: input.mentions ?? [],
      is_resolved: false,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create annotation: ${error.message}`);
  }

  const annotation = data as AnnotationRow;

  // Trigger notifications for mentioned users (Req 12.3)
  if (input.mentions && input.mentions.length > 0) {
    await notifyMentionedUsers(input.mentions, input.author_id, annotation);
  }

  return annotation;
}

/**
 * Get a single annotation by ID, including its replies.
 *
 * @returns The annotation row or null if not found.
 */
export async function getAnnotation(
  annotationId: string
): Promise<(AnnotationRow & { replies: AnnotationReplyRow[] }) | null> {
  if (!annotationId) {
    throw new Error('annotationId is required');
  }

  const supabase = createAdminClient();

  const { data: annotation, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('id', annotationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get annotation: ${error.message}`);
  }

  const { data: replies, error: repliesError } = await supabase
    .from('annotation_replies')
    .select('*')
    .eq('annotation_id', annotationId)
    .order('created_at', { ascending: true });

  if (repliesError) {
    throw new Error(`Failed to get annotation replies: ${repliesError.message}`);
  }

  return {
    ...(annotation as AnnotationRow),
    replies: (replies ?? []) as AnnotationReplyRow[],
  };
}

/**
 * List annotations for a workspace with optional filters.
 *
 * Req 12.1: Annotations on cells, findings, action items, report sections.
 * Req 12.6: Visual indicator support — returns is_resolved status.
 */
export async function listAnnotations(
  filters: ListAnnotationsFilters,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<AnnotationRow[]> {
  if (!filters.workspace_id) {
    throw new Error('workspace_id is required');
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('annotations')
    .select('*')
    .eq('workspace_id', filters.workspace_id)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (filters.target_type) {
    query = query.eq('target_type', filters.target_type);
  }
  if (filters.target_id) {
    query = query.eq('target_id', filters.target_id);
  }
  if (filters.is_resolved !== undefined) {
    query = query.eq('is_resolved', filters.is_resolved);
  }
  if (filters.author_id) {
    query = query.eq('author_id', filters.author_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list annotations: ${error.message}`);
  }

  return (data ?? []) as AnnotationRow[];
}

/**
 * Add a reply to an annotation thread.
 *
 * Req 12.4: Thread replies for contextual discussions.
 * Req 12.3: Trigger notifications for mentioned users in replies.
 *
 * @returns The newly created reply row.
 */
export async function addReply(input: AddReplyInput): Promise<AnnotationReplyRow> {
  if (!input.annotation_id) {
    throw new Error('annotation_id is required');
  }
  if (!input.author_id) {
    throw new Error('author_id is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }

  const supabase = createAdminClient();

  // Verify the parent annotation exists
  const { data: parent, error: parentError } = await supabase
    .from('annotations')
    .select('id, workspace_id, author_id, target_type, target_id')
    .eq('id', input.annotation_id)
    .single();

  if (parentError) {
    if (parentError.code === 'PGRST116') {
      throw new Error('Annotation not found');
    }
    throw new Error(`Failed to verify annotation: ${parentError.message}`);
  }

  const { data, error } = await supabase
    .from('annotation_replies')
    .insert({
      annotation_id: input.annotation_id,
      author_id: input.author_id,
      content: input.content,
      mentions: input.mentions ?? [],
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to add reply: ${error.message}`);
  }

  const reply = data as AnnotationReplyRow;

  // Trigger notifications for mentioned users in the reply (Req 12.3)
  if (input.mentions && input.mentions.length > 0) {
    await notifyMentionedUsers(
      input.mentions,
      input.author_id,
      parent as AnnotationRow
    );
  }

  return reply;
}

/**
 * Resolve an annotation, marking it as completed without deleting it.
 *
 * Req 12.5: Resolve annotations without removing from history.
 */
export async function resolveAnnotation(
  annotationId: string,
  userId: string
): Promise<AnnotationRow> {
  if (!annotationId) {
    throw new Error('annotationId is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('annotations')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', annotationId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to resolve annotation: ${error.message}`);
  }

  return data as AnnotationRow;
}

/**
 * Unresolve a previously resolved annotation.
 *
 * Req 12.5: Allow reopening resolved annotations.
 */
export async function unresolveAnnotation(
  annotationId: string,
  userId: string
): Promise<AnnotationRow> {
  if (!annotationId) {
    throw new Error('annotationId is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('annotations')
    .update({
      is_resolved: false,
      resolved_at: null,
    })
    .eq('id', annotationId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to unresolve annotation: ${error.message}`);
  }

  return data as AnnotationRow;
}

/**
 * Delete an annotation and all its replies (cascade).
 */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  if (!annotationId) {
    throw new Error('annotationId is required');
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId);

  if (error) {
    throw new Error(`Failed to delete annotation: ${error.message}`);
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Send in-app notifications to mentioned users (Req 12.3).
 *
 * Notifies each mentioned user (except the author) with a link
 * to the annotation target.
 */
async function notifyMentionedUsers(
  mentionedUserIds: string[],
  authorId: string,
  annotation: Pick<AnnotationRow, 'id' | 'target_type' | 'target_id'>
): Promise<void> {
  const uniqueIds = [...new Set(mentionedUserIds)].filter(
    (id) => id !== authorId
  );

  if (uniqueIds.length === 0) return;

  const supabase = createAdminClient();

  const rows = uniqueIds.map((userId) => ({
    user_id: userId,
    type: 'mention',
    severity: 'info',
    title: 'You were mentioned in an annotation',
    body: `You were mentioned in a comment on a ${annotation.target_type}.`,
    metadata: {
      annotation_id: annotation.id,
      target_type: annotation.target_type,
      target_id: annotation.target_id,
    },
  }));

  try {
    await supabase.from('notifications').insert(rows);
  } catch {
    // Don't fail the annotation creation if notification fails
  }
}
