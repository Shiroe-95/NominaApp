'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface MentionUser {
  id: string;
  name: string;
}

export interface AnnotationFormProps {
  /** Called when the user submits the annotation */
  onSubmit: (content: string, mentions: string[]) => void;
  /** List of users available for @mention */
  users?: MentionUser[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether the form is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Extract @mention user IDs from text content.
 * Matches patterns like @[userId] embedded by the mention picker.
 */
export function extractMentions(content: string, users: MentionUser[]): string[] {
  const mentioned: string[] = [];
  for (const user of users) {
    // Match @username (case-insensitive, word boundary)
    const pattern = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
    if (pattern.test(content)) {
      mentioned.push(user.id);
    }
  }
  return [...new Set(mentioned)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function AnnotationForm({
  onSubmit,
  users = [],
  placeholder = 'Add a comment... Use @ to mention',
  isSubmitting = false,
  className,
}: AnnotationFormProps) {
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase()),
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);

      // Detect @ trigger for mention popup
      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setShowMentions(true);
        setMentionFilter(atMatch[1]);
      } else {
        setShowMentions(false);
        setMentionFilter('');
      }
    },
    [],
  );

  const handleMentionSelect = useCallback(
    (user: MentionUser) => {
      const cursorPos = inputRef.current?.selectionStart ?? content.length;
      const textBeforeCursor = content.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex >= 0) {
        const before = content.slice(0, atIndex);
        const after = content.slice(cursorPos);
        setContent(`${before}@${user.name} ${after}`);
      }

      setShowMentions(false);
      setMentionFilter('');
      inputRef.current?.focus();
    },
    [content],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const mentions = extractMentions(trimmed, users);
    onSubmit(trimmed, mentions);
    setContent('');
    setShowMentions(false);
  }, [content, users, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
      }
    },
    [handleSubmit],
  );

  return (
    <div className={cn('relative', className)}>
      <textarea
        ref={inputRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        disabled={isSubmitting}
        className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-[#958da1] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/40 disabled:opacity-50"
        aria-label="Annotation comment"
      />

      {/* Mention dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-32 w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1d28] shadow-lg"
        >
          {filteredUsers.slice(0, 5).map((user) => (
            <li key={user.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleMentionSelect(user)}
                className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#7C3AED]/20"
              >
                @{user.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-[#958da1]">Ctrl+Enter to submit</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}
