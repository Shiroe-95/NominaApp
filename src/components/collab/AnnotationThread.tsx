'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Avatar, AvatarFallback, Badge } from '@/components/ui';

export interface AnnotationReply {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  userId: string;
  userName: string;
  content: string;
  targetType: 'cell' | 'finding' | 'action_item' | 'report_section';
  targetRef: string;
  isResolved: boolean;
  createdAt: string;
  replies: AnnotationReply[];
}

export interface AnnotationThreadProps {
  annotation: Annotation;
  onReply?: (annotationId: string, content: string) => void;
  onResolve?: (annotationId: string) => void;
  className?: string;
}

export function AnnotationThread({ annotation, onReply, onResolve, className }: AnnotationThreadProps) {
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply?.(annotation.id, replyText);
    setReplyText('');
  };

  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={cn('space-y-3 rounded-xl border border-white/10 bg-[#181b26] p-4', className)}>
      <div className="flex items-start gap-3">
        <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(annotation.userName)}</AvatarFallback></Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{annotation.userName}</span>
            <span className="text-xs text-[#958da1]">{annotation.createdAt}</span>
            {annotation.isResolved && <Badge variant="outline">Resolved</Badge>}
          </div>
          <p className="mt-1 text-sm text-white/80">{annotation.content}</p>
        </div>
      </div>

      {annotation.replies.map((reply) => (
        <div key={reply.id} className="ml-10 flex items-start gap-3 border-l border-white/5 pl-3">
          <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{initials(reply.userName)}</AvatarFallback></Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white">{reply.userName}</span>
              <span className="text-xs text-[#958da1]">{reply.createdAt}</span>
            </div>
            <p className="text-sm text-white/70">{reply.content}</p>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Reply..."
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-[#958da1] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/40"
          onKeyDown={(e) => e.key === 'Enter' && handleReply()}
        />
        <Button variant="ghost" size="sm" onClick={handleReply}>Reply</Button>
        {!annotation.isResolved && <Button variant="ghost" size="sm" onClick={() => onResolve?.(annotation.id)}>Resolve</Button>}
      </div>
    </div>
  );
}
