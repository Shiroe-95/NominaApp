'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
}

export interface CommandPaletteProps {
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({ items, placeholder = 'Type a command or search…' }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-white/10 bg-[#13151e] shadow-2xl"
          aria-label="Command palette"
        >
          <div className="flex items-center border-b border-white/10 px-3">
            <span className="mr-2 text-slate-500">⌘</span>
            <input
              className="flex h-11 w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 outline-none"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2" role="listbox">
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No results found.</p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                role="option"
                aria-selected={false}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300',
                  'hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white focus:outline-none'
                )}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                  setQuery('');
                }}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <div className="flex flex-col items-start">
                  <span className="font-medium">{item.label}</span>
                  {item.description && <span className="text-xs text-slate-500">{item.description}</span>}
                </div>
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
