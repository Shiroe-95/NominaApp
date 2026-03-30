'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/components/ui';

export interface FeedbackData {
  type: 'bug' | 'feature' | 'general';
  message: string;
  url: string;
  userAgent: string;
}

export interface FeedbackWidgetProps {
  onSubmit?: (data: FeedbackData) => void;
  className?: string;
}

export function FeedbackWidget({ onSubmit, className }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackData['type']>('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit?.({
      type,
      message,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
    setMessage('');
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setOpen(false); }, 1500);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('fixed bottom-4 right-4 z-40', className)} aria-label="Send feedback">
          💬 Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        {submitted ? (
          <p className="py-4 text-center text-sm text-green-400">Thanks for your feedback! ✅</p>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Send Feedback</h4>
            <div className="flex gap-1">
              {(['bug', 'feature', 'general'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-xs capitalize transition-colors',
                    type === t ? 'bg-[#7C3AED] text-white' : 'bg-[#262a35] text-[#958da1] hover:text-white'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you think..."
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-[#958da1] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/40"
            />
            <Button variant="primary" size="sm" onClick={handleSubmit} className="w-full">Send</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
