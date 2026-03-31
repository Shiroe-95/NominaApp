'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AnnotationBadge } from './AnnotationBadge';
import { AnnotationThread, type Annotation } from './AnnotationThread';
import { AnnotationForm, type MentionUser } from './AnnotationForm';
import type { AnnotationRow } from '@/lib/collab/annotation-service';

export interface AnnotationPanelProps {
  /** Annotations for this entity */
  annotations: AnnotationRow[];
  /** Count of unresolved annotations for the badge */
  unresolvedCount: number;
  /** Available users for @mention */
  users?: MentionUser[];
  /** Called when a new annotation is submitted */
  onSubmit?: (content: string, mentions: string[]) => void;
  /** Called when a reply is added to a thread */
  onReply?: (annotationId: string, content: string) => void;
  /** Called when an annotation is resolved */
  onResolve?: (annotationId: string) => void;
  /** Called when an annotation is reopened */
  onUnresolve?: (annotationId: string) => void;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AnnotationPanel — Combines AnnotationBadge, AnnotationThread, and AnnotationForm
 * into a single panel for use in PayrollEditor cells and Reconcile page findings.
 *
 * Requirements: 10.1, 10.2, 10.6
 */
export function AnnotationPanel({
  annotations,
  unresolvedCount,
  users = [],
  onSubmit,
  onReply,
  onResolve,
  onUnresolve,
  isSubmitting,
  className,
}: AnnotationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Map AnnotationRow to the Annotation shape expected by AnnotationThread
  const threadAnnotations: Annotation[] = annotations.map((a) => ({
    id: a.id,
    userId: a.author_id,
    userName: a.author_id, // In real usage, resolve from user profiles
    content: a.content,
    targetType: a.target_type,
    targetRef: a.target_id,
    isResolved: a.is_resolved,
    createdAt: a.created_at,
    replies: [], // Replies loaded separately per thread
  }));

  return (
    <div className={cn('relative inline-block', className)}>
      <AnnotationBadge
        count={unresolvedCount}
        hasUnresolved={unresolvedCount > 0}
        onClick={() => setIsOpen(!isOpen)}
      />

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-white/10 bg-[#12141f] p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/70">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#958da1] hover:text-white"
              aria-label="Close annotations"
            >
              ✕
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {threadAnnotations.map((annotation) => (
              <AnnotationThread
                key={annotation.id}
                annotation={annotation}
                onReply={onReply}
                onResolve={onResolve}
                onUnresolve={onUnresolve}
              />
            ))}
          </div>

          {onSubmit && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <AnnotationForm
                onSubmit={onSubmit}
                users={users}
                isSubmitting={isSubmitting}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
