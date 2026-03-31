'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AnnotationRow, AnnotationReplyRow } from './annotation-service';

/**
 * Entity types supported by the annotation system.
 * Maps to annotation_service target_type.
 */
export type AnnotationEntityType = 'cell' | 'finding' | 'action_item' | 'report_section';

export interface UseAnnotationsOptions {
  workspaceId: string;
  targetType: AnnotationEntityType;
  targetId: string;
}

export interface UseAnnotationsReturn {
  annotations: AnnotationRow[];
  unresolvedCount: number;
  isLoading: boolean;
  error: string | null;
  createAnnotation: (content: string, mentions: string[]) => Promise<void>;
  addReply: (annotationId: string, content: string, mentions?: string[]) => Promise<void>;
  resolveAnnotation: (annotationId: string) => Promise<void>;
  unresolveAnnotation: (annotationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage annotations for a specific entity (cell, finding, action_item, report_section).
 * Integrates with the annotation API endpoints.
 *
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.6
 */
export function useAnnotations({
  workspaceId,
  targetType,
  targetId,
}: UseAnnotationsOptions): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unresolvedCount = annotations.filter((a) => !a.is_resolved).length;

  const fetchAnnotations = useCallback(async () => {
    if (!workspaceId || !targetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        target_type: targetType,
        target_id: targetId,
      });
      const res = await fetch(`/api/v1/annotations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch annotations');
      const data = await res.json();
      setAnnotations(data.annotations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, targetType, targetId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const createAnnotation = useCallback(
    async (content: string, mentions: string[]) => {
      const res = await fetch('/api/v1/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          target_type: targetType,
          target_id: targetId,
          content,
          mentions,
        }),
      });
      if (!res.ok) throw new Error('Failed to create annotation');
      await fetchAnnotations();
    },
    [workspaceId, targetType, targetId, fetchAnnotations],
  );

  const addReply = useCallback(
    async (annotationId: string, content: string, mentions?: string[]) => {
      const res = await fetch(`/api/v1/annotations/${annotationId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mentions }),
      });
      if (!res.ok) throw new Error('Failed to add reply');
      await fetchAnnotations();
    },
    [fetchAnnotations],
  );

  const resolveAnnotation = useCallback(
    async (annotationId: string) => {
      const res = await fetch(`/api/v1/annotations/${annotationId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
      if (!res.ok) throw new Error('Failed to resolve annotation');
      await fetchAnnotations();
    },
    [fetchAnnotations],
  );

  const unresolveAnnotation = useCallback(
    async (annotationId: string) => {
      const res = await fetch(`/api/v1/annotations/${annotationId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: false }),
      });
      if (!res.ok) throw new Error('Failed to unresolve annotation');
      await fetchAnnotations();
    },
    [fetchAnnotations],
  );

  return {
    annotations,
    unresolvedCount,
    isLoading,
    error,
    createAnnotation,
    addReply,
    resolveAnnotation,
    unresolveAnnotation,
    refresh: fetchAnnotations,
  };
}

/**
 * Compute the badge count for a set of annotations.
 * Returns the number of unresolved annotations.
 *
 * Property 30: Badge count invariant — count equals exactly N unresolved annotations.
 */
export function computeBadgeCount(annotations: Pick<AnnotationRow, 'is_resolved'>[]): number {
  return annotations.filter((a) => !a.is_resolved).length;
}
