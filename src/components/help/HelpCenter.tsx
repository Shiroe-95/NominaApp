'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Sheet, SheetTrigger, SheetContent } from '@/components/ui';

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  videoUrl?: string;
}

export interface HelpCenterProps {
  articles?: HelpArticle[];
  faq?: { question: string; answer: string }[];
  onSearch?: (query: string) => void;
  className?: string;
}

export function HelpCenter({ articles = [], faq = [], onSearch, className }: HelpCenterProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const handleSearch = (value: string) => {
    setSearch(value);
    onSearch?.(value);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open help center" className={className}>
          <span className="text-lg">❓</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">Help Center</h2>

        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search help..."
          className="mt-4"
        />

        {articles.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-[#958da1]">Articles</h3>
            {articles.map((article) => (
              <div key={article.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                <p className="text-sm font-medium text-white">{article.title}</p>
                <p className="mt-1 text-xs text-[#958da1]">{article.summary}</p>
                {article.videoUrl && <span className="text-xs text-[#7C3AED]">🎥 Video available</span>}
              </div>
            ))}
          </div>
        )}

        {faq.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-[#958da1]">FAQ</h3>
            {faq.map((item, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-black/20 p-3">
                <p className="text-sm font-medium text-white">{item.question}</p>
                <p className="mt-1 text-xs text-white/70">{item.answer}</p>
              </div>
            ))}
          </div>
        )}

        {articles.length === 0 && faq.length === 0 && (
          <p className="mt-8 text-center text-sm text-[#958da1]">No help content available</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
