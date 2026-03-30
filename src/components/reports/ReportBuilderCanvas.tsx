'use client';

import { cn } from '@/lib/utils';

export interface CanvasBlock {
  id: string;
  type: 'header' | 'table' | 'chart' | 'text' | 'spacer';
  config: Record<string, unknown>;
}

export interface ReportBuilderCanvasProps {
  blocks: CanvasBlock[];
  onReorder?: (blocks: CanvasBlock[]) => void;
  onRemoveBlock?: (id: string) => void;
  onSelectBlock?: (id: string) => void;
  selectedBlockId?: string | null;
  className?: string;
}

const blockIcons: Record<string, string> = {
  header: '📝',
  table: '📊',
  chart: '📈',
  text: '📄',
  spacer: '➖',
};

export function ReportBuilderCanvas({ blocks, onRemoveBlock, onSelectBlock, selectedBlockId, className }: ReportBuilderCanvasProps) {
  return (
    <div className={cn('space-y-2 rounded-xl border-2 border-dashed border-white/10 bg-black/10 p-4 min-h-[300px]', className)}>
      {blocks.length === 0 && (
        <div className="flex h-60 items-center justify-center text-sm text-[#958da1]">
          Drag blocks here to build your report
        </div>
      )}

      {blocks.map((block) => (
        <div
          key={block.id}
          onClick={() => onSelectBlock?.(block.id)}
          className={cn(
            'group relative flex items-center gap-3 rounded-lg border bg-[#181b26] px-4 py-3 cursor-pointer transition-colors',
            selectedBlockId === block.id ? 'border-[#7C3AED] ring-1 ring-[#7C3AED]/30' : 'border-white/10 hover:border-white/20'
          )}
          role="button"
          tabIndex={0}
          aria-label={`${block.type} block`}
        >
          <span className="text-base">{blockIcons[block.type] ?? '📦'}</span>
          <span className="flex-1 text-sm text-white capitalize">{block.type}</span>
          <span className="text-xs text-[#958da1]">⋮⋮</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveBlock?.(block.id); }}
            className="opacity-0 group-hover:opacity-100 text-[#958da1] hover:text-[#E11D48] transition-opacity"
            aria-label={`Remove ${block.type} block`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
