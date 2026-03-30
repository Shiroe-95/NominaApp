/**
 * Onboarding feature wiring helpers.
 * Wire GuidedTour, ContextualTooltip, HelpCenter, and FeedbackWidget
 * into existing app pages.
 *
 * Requirements: 30.1, 31.1, 31.2, 31.6
 * @module lib/integration/wire-onboarding
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TourConfig {
  tourId: string;
  name: string;
  roles: string[];
  steps: { target: string; title: string; content: string }[];
}

/**
 * Available guided tours by role.
 */
export const TOURS: TourConfig[] = [
  {
    tourId: 'main-overview',
    name: 'Main Overview',
    roles: ['admin', 'analyst', 'client'],
    steps: [
      { target: '[data-tour="dashboard"]', title: 'Dashboard', content: 'Your payroll control center' },
      { target: '[data-tour="upload"]', title: 'Upload', content: 'Import payroll files here' },
      { target: '[data-tour="reports"]', title: 'Reports', content: 'View audit reports and analytics' },
    ],
  },
  {
    tourId: 'audit-pipeline',
    name: 'Audit Pipeline',
    roles: ['admin', 'analyst'],
    steps: [
      { target: '[data-tour="reconcile"]', title: 'Reconciliation', content: 'Review and correct findings' },
      { target: '[data-tour="actions"]', title: 'Actions', content: 'Manage action items' },
    ],
  },
  {
    tourId: 'admin-tour',
    name: 'Admin Tour',
    roles: ['admin'],
    steps: [
      { target: '[data-tour="settings"]', title: 'Settings', content: 'Configure system settings' },
      { target: '[data-tour="users"]', title: 'Users', content: 'Manage users and roles' },
    ],
  },
];

/**
 * Check if a user should see a guided tour on the current page.
 */
export async function shouldShowTour(
  supabase: SupabaseClient,
  userId: string,
  tourId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('guided_tour_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('tour_id', tourId)
    .single();

  return !data?.completed_at;
}

/**
 * Get tours available for a specific role.
 */
export function getToursForRole(role: string): TourConfig[] {
  return TOURS.filter((t) => t.roles.includes(role));
}

/**
 * Contextual tooltip definitions by page route.
 */
export const CONTEXTUAL_TOOLTIPS: Record<string, { field: string; tooltip: string }[]> = {
  '/upload': [
    { field: 'file-format', tooltip: 'Supported formats: Excel (.xlsx), CSV, XML' },
    { field: 'column-mapping', tooltip: 'AI will automatically map your columns to system fields' },
  ],
  '/reconcile': [
    { field: 'risk-score', tooltip: 'Risk score from 0-100 based on findings severity' },
    { field: 'triple-match', tooltip: 'Compares internal payroll, PILA payment, and regulatory standard' },
  ],
  '/reports': [
    { field: 'certification', tooltip: 'Payroll is certifiable when all critical findings are resolved' },
  ],
};

/**
 * Get contextual tooltips for a given route.
 */
export function getTooltipsForRoute(route: string): { field: string; tooltip: string }[] {
  return CONTEXTUAL_TOOLTIPS[route] ?? [];
}
