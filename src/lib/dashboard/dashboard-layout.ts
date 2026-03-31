/**
 * Dashboard Layout — Schema, types, presets, and persistence helpers.
 *
 * Provides Zod validation for dashboard layouts, 3 role-based preset layouts,
 * and save/load functions for user_profiles.dashboard_layout (JSONB).
 */

import { z } from 'zod';

// ── Widget Types ────────────────────────────────────────────────────

export const WIDGET_TYPES = [
  'metrics',
  'risk-trend',
  'anomalies',
  'forecast',
  'activity',
  'ai-providers',
  'action-items',
  'system-health',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

// ── Zod Schemas ─────────────────────────────────────────────────────

export const DashboardWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WIDGET_TYPES),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(4),
    h: z.number().int().min(1).max(4),
  }),
});

export const DashboardLayoutSchema = z.object({
  widgets: z.array(DashboardWidgetSchema),
  preset: z.enum(['executive', 'analyst', 'admin']).optional(),
});

export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;
export type PresetRole = 'executive' | 'analyst' | 'admin';

// ── Widget Catalog Definitions ──────────────────────────────────────

export interface WidgetCatalogEntry {
  type: WidgetType;
  label: string;
  description: string;
  icon: string;
  defaultW: number;
  defaultH: number;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { type: 'metrics', label: 'Key Metrics', description: 'Summary metrics cards', icon: '📊', defaultW: 2, defaultH: 1 },
  { type: 'risk-trend', label: 'Risk Trend', description: 'Risk score over time', icon: '📈', defaultW: 2, defaultH: 1 },
  { type: 'anomalies', label: 'Anomalies', description: 'Detected anomalies', icon: '🔮', defaultW: 1, defaultH: 2 },
  { type: 'forecast', label: 'Forecast', description: 'Cost forecast chart', icon: '📉', defaultW: 2, defaultH: 1 },
  { type: 'activity', label: 'Activity Feed', description: 'Recent activity', icon: '📋', defaultW: 1, defaultH: 2 },
  { type: 'ai-providers', label: 'AI Providers', description: 'Provider status', icon: '🤖', defaultW: 1, defaultH: 1 },
  { type: 'action-items', label: 'Action Items', description: 'Pending actions', icon: '✅', defaultW: 1, defaultH: 1 },
  { type: 'system-health', label: 'System Health', description: 'System status', icon: '💚', defaultW: 1, defaultH: 1 },
];

// ── Preset Layouts ──────────────────────────────────────────────────

let _idCounter = 0;
function wid(): string {
  _idCounter += 1;
  return `w-${_idCounter}`;
}

/** Reset counter (useful for tests). */
export function resetIdCounter(): void {
  _idCounter = 0;
}

export function createPresetLayout(role: PresetRole): DashboardLayout {
  resetIdCounter();

  const presets: Record<PresetRole, DashboardWidget[]> = {
    executive: [
      { id: wid(), type: 'metrics', position: { x: 0, y: 0, w: 2, h: 1 } },
      { id: wid(), type: 'forecast', position: { x: 2, y: 0, w: 2, h: 1 } },
      { id: wid(), type: 'anomalies', position: { x: 0, y: 1, w: 1, h: 2 } },
      { id: wid(), type: 'risk-trend', position: { x: 1, y: 1, w: 2, h: 1 } },
      { id: wid(), type: 'action-items', position: { x: 3, y: 1, w: 1, h: 1 } },
    ],
    analyst: [
      { id: wid(), type: 'metrics', position: { x: 0, y: 0, w: 2, h: 1 } },
      { id: wid(), type: 'risk-trend', position: { x: 2, y: 0, w: 2, h: 1 } },
      { id: wid(), type: 'action-items', position: { x: 0, y: 1, w: 1, h: 1 } },
      { id: wid(), type: 'anomalies', position: { x: 1, y: 1, w: 1, h: 2 } },
      { id: wid(), type: 'activity', position: { x: 2, y: 1, w: 1, h: 2 } },
    ],
    admin: [
      { id: wid(), type: 'ai-providers', position: { x: 0, y: 0, w: 1, h: 1 } },
      { id: wid(), type: 'system-health', position: { x: 1, y: 0, w: 1, h: 1 } },
      { id: wid(), type: 'metrics', position: { x: 2, y: 0, w: 2, h: 1 } },
      { id: wid(), type: 'activity', position: { x: 0, y: 1, w: 1, h: 2 } },
      { id: wid(), type: 'action-items', position: { x: 1, y: 1, w: 1, h: 1 } },
    ],
  };

  return { widgets: presets[role], preset: role };
}

// ── Persistence Helpers ─────────────────────────────────────────────

/**
 * Serialize a DashboardLayout to JSON string for storage in JSONB column.
 * Validates with Zod before serializing.
 */
export function serializeLayout(layout: DashboardLayout): string {
  const validated = DashboardLayoutSchema.parse(layout);
  return JSON.stringify(validated);
}

/**
 * Deserialize a JSON string from JSONB column back to DashboardLayout.
 * Validates with Zod after parsing.
 */
export function deserializeLayout(json: string): DashboardLayout {
  const parsed = JSON.parse(json);
  return DashboardLayoutSchema.parse(parsed);
}

/**
 * Map a user role to the closest preset role.
 */
export function roleToPreset(role: string): PresetRole {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'analyst':
      return 'analyst';
    default:
      return 'executive';
  }
}
