'use client';

import { useState, useCallback } from 'react';
import { DashboardGrid } from './DashboardGrid';
import { WidgetCatalog } from './WidgetCatalog';
import { WidgetWrapper } from './WidgetWrapper';
import { WIDGET_COMPONENTS } from './widgets';
import {
  WIDGET_CATALOG,
  createPresetLayout,
  roleToPreset,
  type DashboardWidget,
  type DashboardLayout,
  type WidgetType,
} from '@/lib/dashboard/dashboard-layout';

export interface PersonalizableDashboardProps {
  /** Initial layout loaded from user_profiles.dashboard_layout. */
  initialLayout?: DashboardLayout | null;
  /** User role for preset defaults. */
  userRole?: string;
  /** Callback when layout changes (for persistence). */
  onSaveLayout?: (layout: DashboardLayout) => void;
  className?: string;
}

let _nextId = 100;

/**
 * Personalizable Dashboard — main orchestrator component.
 *
 * Combines DashboardGrid (drag-and-drop), WidgetCatalog (add widgets),
 * WidgetWrapper (error boundaries), preset layouts, and reset functionality.
 */
export function PersonalizableDashboard({
  initialLayout,
  userRole = 'executive',
  onSaveLayout,
  className,
}: PersonalizableDashboardProps) {
  const preset = roleToPreset(userRole);
  const defaultLayout = initialLayout ?? createPresetLayout(preset);

  const [layout, setLayout] = useState<DashboardLayout>(defaultLayout);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleLayoutChange = useCallback(
    (widgets: DashboardWidget[]) => {
      const newLayout: DashboardLayout = { ...layout, widgets, preset: undefined };
      setLayout(newLayout);
      onSaveLayout?.(newLayout);
    },
    [layout, onSaveLayout],
  );

  const handleAddWidget = useCallback(
    (type: WidgetType) => {
      _nextId += 1;
      const catalogEntry = WIDGET_CATALOG.find((w) => w.type === type);
      const newWidget: DashboardWidget = {
        id: `w-${_nextId}`,
        type,
        position: {
          x: 0,
          y: layout.widgets.length,
          w: catalogEntry?.defaultW ?? 1,
          h: catalogEntry?.defaultH ?? 1,
        },
      };
      const newLayout: DashboardLayout = {
        widgets: [...layout.widgets, newWidget],
      };
      setLayout(newLayout);
      onSaveLayout?.(newLayout);
    },
    [layout, onSaveLayout],
  );

  const handleResetLayout = useCallback(() => {
    const resetLayout = createPresetLayout(preset);
    setLayout(resetLayout);
    onSaveLayout?.(resetLayout);
  }, [preset, onSaveLayout]);

  const renderWidget = useCallback((widget: DashboardWidget) => {
    const WidgetComponent = WIDGET_COMPONENTS[widget.type];
    if (!WidgetComponent) {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--muted-foreground)]">
          Unknown widget: {widget.type}
        </div>
      );
    }
    return (
      <WidgetWrapper widgetId={widget.id} title={undefined}>
        <WidgetComponent />
      </WidgetWrapper>
    );
  }, []);

  return (
    <div className={className}>
      <DashboardGrid
        widgets={layout.widgets}
        onLayoutChange={handleLayoutChange}
        onAddWidget={() => setCatalogOpen(true)}
        onResetLayout={handleResetLayout}
        renderWidget={renderWidget}
      />

      <WidgetCatalog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onAdd={handleAddWidget}
        existingTypes={layout.widgets.map((w) => w.type)}
      />
    </div>
  );
}
