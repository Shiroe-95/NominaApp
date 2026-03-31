'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { DashboardWidget } from '@/lib/dashboard/dashboard-layout';

export interface DashboardGridProps {
  widgets: DashboardWidget[];
  onLayoutChange?: (widgets: DashboardWidget[]) => void;
  onAddWidget?: () => void;
  onResetLayout?: () => void;
  renderWidget?: (widget: DashboardWidget) => React.ReactNode;
  className?: string;
}

/**
 * Responsive dashboard grid with HTML5 drag-and-drop.
 * Breakpoints: 1 col mobile, 2 col tablet (sm), 3-4 col desktop (lg/xl).
 */
export function DashboardGrid({
  widgets,
  onLayoutChange,
  onAddWidget,
  onResetLayout,
  renderWidget,
  className,
}: DashboardGridProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const handleRemoveWidget = useCallback(
    (id: string) => {
      onLayoutChange?.(widgets.filter((w) => w.id !== id));
    },
    [widgets, onLayoutChange],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, id: string) => {
      if (!isEditing) return;
      setDraggedId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    [isEditing],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, id: string) => {
      if (!isEditing || !draggedId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dragOverId.current = id;
    },
    [isEditing, draggedId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        return;
      }

      const fromIdx = widgets.findIndex((w) => w.id === draggedId);
      const toIdx = widgets.findIndex((w) => w.id === targetId);
      if (fromIdx === -1 || toIdx === -1) {
        setDraggedId(null);
        return;
      }

      // Swap positions in the array
      const reordered = [...widgets];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);

      // Update y positions to reflect new order
      const updated = reordered.map((w, i) => ({
        ...w,
        position: { ...w.position, y: i },
      }));

      onLayoutChange?.(updated);
      setDraggedId(null);
    },
    [draggedId, widgets, onLayoutChange],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    dragOverId.current = null;
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Done' : 'Customize'}
          </Button>
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={onAddWidget}>
                Add Widget
              </Button>
              <Button variant="ghost" size="sm" onClick={onResetLayout}>
                Reset Layout
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Responsive grid: 1 col mobile, 2 col tablet, 3-4 col desktop */}
      <div
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="list"
        aria-label="Dashboard widgets"
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            role="listitem"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDrop={(e) => handleDrop(e, widget.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all',
              isEditing && 'cursor-grab ring-2 ring-dashed ring-[#7C3AED]/20',
              draggedId === widget.id && 'opacity-50',
            )}
            style={{
              gridColumn: `span ${Math.min(widget.position.w, 4)}`,
            }}
          >
            {isEditing && (
              <button
                onClick={() => handleRemoveWidget(widget.id)}
                className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#E11D48] text-[10px] text-white"
                aria-label={`Remove ${widget.type} widget`}
              >
                ×
              </button>
            )}
            {renderWidget?.(widget) ?? (
              <div className="flex h-32 items-center justify-center text-sm text-[var(--muted-foreground)]">
                {widget.type}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
