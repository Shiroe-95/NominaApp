import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GuidedTourService — Tour progress tracking, role-specific tours, and reset.
 *
 * Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7
 *
 * @module lib/onboarding/guided-tour-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const TOUR_IDS = {
  MAIN_OVERVIEW: 'main-overview',
  AUDIT_PIPELINE: 'audit-pipeline',
  AI_CHAT: 'ai-chat',
  REPORTS: 'reports',
  ADMIN: 'admin',
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

export type UserRole = 'admin' | 'analyst' | 'client';

// ─── Tour Definitions ───────────────────────────────────────────────────────

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  order: number;
}

export interface TourDefinition {
  id: TourId;
  name: string;
  description: string;
  roles: UserRole[];
  steps: TourStep[];
}

/** All available tours with their steps and role restrictions (Req 30.5, 30.7) */
export const TOUR_DEFINITIONS: TourDefinition[] = [
  {
    id: TOUR_IDS.MAIN_OVERVIEW,
    name: 'Main Overview',
    description: 'Introduction to NominaSmart dashboard and navigation',
    roles: ['admin', 'analyst', 'client'],
    steps: [
      { id: 'dashboard', targetSelector: '[data-tour="dashboard"]', title: 'Dashboard', content: 'Your central hub for payroll metrics and insights.', order: 1 },
      { id: 'sidebar', targetSelector: '[data-tour="sidebar"]', title: 'Navigation', content: 'Access all features from the sidebar menu.', order: 2 },
      { id: 'workspace', targetSelector: '[data-tour="workspace-selector"]', title: 'Workspaces', content: 'Switch between workspaces to manage different teams.', order: 3 },
      { id: 'theme', targetSelector: '[data-tour="theme-toggle"]', title: 'Theme', content: 'Toggle between light and dark mode.', order: 4 },
    ],
  },
  {
    id: TOUR_IDS.AUDIT_PIPELINE,
    name: 'Audit Pipeline',
    description: 'Learn the 4-step payroll audit process',
    roles: ['admin', 'analyst'],
    steps: [
      { id: 'upload', targetSelector: '[data-tour="upload"]', title: 'Upload', content: 'Upload payroll files for auditing.', order: 1 },
      { id: 'mapping', targetSelector: '[data-tour="mapping"]', title: 'Mapping', content: 'Map columns to standard payroll fields.', order: 2 },
      { id: 'audit', targetSelector: '[data-tour="audit"]', title: 'Audit', content: 'AI agents analyze your payroll data.', order: 3 },
      { id: 'reconcile', targetSelector: '[data-tour="reconcile"]', title: 'Reconcile', content: 'Review findings and apply corrections.', order: 4 },
    ],
  },
  {
    id: TOUR_IDS.AI_CHAT,
    name: 'AI Chat',
    description: 'Ask questions about your payroll data in natural language',
    roles: ['admin', 'analyst', 'client'],
    steps: [
      { id: 'ai-sidebar', targetSelector: '[data-tour="ai-sidebar"]', title: 'AI Assistant', content: 'Open the AI sidebar to chat with Dianis.', order: 1 },
      { id: 'nlq', targetSelector: '[data-tour="nlq-input"]', title: 'Ask Questions', content: 'Type questions in natural language about your payroll.', order: 2 },
      { id: 'sources', targetSelector: '[data-tour="ai-sources"]', title: 'Data Sources', content: 'See which data was used to answer your question.', order: 3 },
    ],
  },
  {
    id: TOUR_IDS.REPORTS,
    name: 'Reports',
    description: 'Generate, schedule, and export payroll reports',
    roles: ['admin', 'analyst', 'client'],
    steps: [
      { id: 'reports-list', targetSelector: '[data-tour="reports"]', title: 'Reports', content: 'View and manage all your payroll reports.', order: 1 },
      { id: 'schedule', targetSelector: '[data-tour="schedule-report"]', title: 'Schedule', content: 'Set up automated report delivery.', order: 2 },
      { id: 'export', targetSelector: '[data-tour="export"]', title: 'Export', content: 'Export reports as PDF or Excel.', order: 3 },
    ],
  },
  {
    id: TOUR_IDS.ADMIN,
    name: 'Administration',
    description: 'Manage users, workspaces, and system settings',
    roles: ['admin'],
    steps: [
      { id: 'users', targetSelector: '[data-tour="admin-users"]', title: 'Users', content: 'Manage team members and their roles.', order: 1 },
      { id: 'settings', targetSelector: '[data-tour="admin-settings"]', title: 'Settings', content: 'Configure system-wide settings.', order: 2 },
      { id: 'sso', targetSelector: '[data-tour="admin-sso"]', title: 'SSO', content: 'Set up single sign-on for your organization.', order: 3 },
      { id: 'webhooks', targetSelector: '[data-tour="admin-webhooks"]', title: 'Webhooks', content: 'Configure event notifications to external systems.', order: 4 },
    ],
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TourProgressRow {
  id: string;
  user_id: string;
  tour_id: string;
  completed_steps: number;
  total_steps: number;
  is_completed: boolean;
  is_dismissed: boolean;
  started_at: string;
  completed_at: string | null;
}

export interface TourProgressSummary {
  tour_id: TourId;
  name: string;
  completed_steps: number;
  total_steps: number;
  is_completed: boolean;
  is_dismissed: boolean;
  started_at: string | null;
}

// ─── Get Tours for Role (Req 30.7) ─────────────────────────────────────────

/**
 * Return tour definitions available for a given user role.
 */
export function getToursForRole(role: UserRole): TourDefinition[] {
  return TOUR_DEFINITIONS.filter((t) => t.roles.includes(role));
}

// ─── Get Tour Progress (Req 30.4) ──────────────────────────────────────────

/**
 * Fetch progress for all tours for a user, merged with definitions.
 */
export async function getTourProgress(
  userId: string,
): Promise<TourProgressSummary[]> {
  if (!userId) throw new Error('userId is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('guided_tour_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch tour progress: ${error.message}`);
  }

  const rows = (data ?? []) as TourProgressRow[];
  const progressMap = new Map(rows.map((r) => [r.tour_id, r]));

  return TOUR_DEFINITIONS.map((def) => {
    const progress = progressMap.get(def.id);
    return {
      tour_id: def.id,
      name: def.name,
      completed_steps: progress?.completed_steps ?? 0,
      total_steps: def.steps.length,
      is_completed: progress?.is_completed ?? false,
      is_dismissed: progress?.is_dismissed ?? false,
      started_at: progress?.started_at ?? null,
    };
  });
}

// ─── Start Tour (Req 30.1) ─────────────────────────────────────────────────

/**
 * Start or resume a tour for a user. Creates a progress row if none exists.
 */
export async function startTour(
  userId: string,
  tourId: TourId,
): Promise<TourProgressRow> {
  if (!userId) throw new Error('userId is required');

  const def = TOUR_DEFINITIONS.find((t) => t.id === tourId);
  if (!def) throw new Error(`Unknown tour: ${tourId}`);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('guided_tour_progress')
    .upsert(
      {
        user_id: userId,
        tour_id: tourId,
        total_steps: def.steps.length,
        is_dismissed: false,
      },
      { onConflict: 'user_id,tour_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to start tour: ${error.message}`);
  }

  return data as TourProgressRow;
}

// ─── Advance Step (Req 30.3, 30.4) ─────────────────────────────────────────

/**
 * Advance tour progress by one step. Marks completed when all steps done.
 */
export async function advanceStep(
  userId: string,
  tourId: TourId,
): Promise<TourProgressRow> {
  if (!userId) throw new Error('userId is required');

  const def = TOUR_DEFINITIONS.find((t) => t.id === tourId);
  if (!def) throw new Error(`Unknown tour: ${tourId}`);

  const supabase = createAdminClient();

  // Fetch current progress
  const { data: current, error: fetchErr } = await supabase
    .from('guided_tour_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('tour_id', tourId)
    .single();

  if (fetchErr || !current) {
    throw new Error(`No tour progress found. Call startTour first.`);
  }

  const row = current as TourProgressRow;
  const newCompleted = Math.min(row.completed_steps + 1, def.steps.length);
  const isNowComplete = newCompleted >= def.steps.length;

  const { data, error } = await supabase
    .from('guided_tour_progress')
    .update({
      completed_steps: newCompleted,
      is_completed: isNowComplete,
      completed_at: isNowComplete ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('tour_id', tourId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to advance tour step: ${error.message}`);
  }

  return data as TourProgressRow;
}

// ─── Dismiss Tour (Req 30.3, 30.4) ─────────────────────────────────────────

/**
 * Dismiss (cancel) a tour. Records progress so it won't auto-show again.
 */
export async function dismissTour(
  userId: string,
  tourId: TourId,
): Promise<void> {
  if (!userId) throw new Error('userId is required');

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('guided_tour_progress')
    .upsert(
      {
        user_id: userId,
        tour_id: tourId,
        total_steps: TOUR_DEFINITIONS.find((t) => t.id === tourId)?.steps.length ?? 0,
        is_dismissed: true,
      },
      { onConflict: 'user_id,tour_id' },
    );

  if (error) {
    throw new Error(`Failed to dismiss tour: ${error.message}`);
  }
}

// ─── Reset Tours (Req 30.6) ────────────────────────────────────────────────

/**
 * Reset all tour progress for a user so tours can be replayed.
 */
export async function resetAllTours(userId: string): Promise<number> {
  if (!userId) throw new Error('userId is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('guided_tour_progress')
    .delete()
    .eq('user_id', userId)
    .select('id');

  if (error) {
    throw new Error(`Failed to reset tours: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Reset a single tour for a user.
 */
export async function resetTour(
  userId: string,
  tourId: TourId,
): Promise<void> {
  if (!userId) throw new Error('userId is required');

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('guided_tour_progress')
    .delete()
    .eq('user_id', userId)
    .eq('tour_id', tourId);

  if (error) {
    throw new Error(`Failed to reset tour: ${error.message}`);
  }
}

// ─── Pending Tours (Req 30.1, 30.7) ────────────────────────────────────────

/**
 * Get tours that a user hasn't completed or dismissed yet, filtered by role.
 * Used to auto-trigger tours on first access.
 */
export async function getPendingTours(
  userId: string,
  role: UserRole,
): Promise<TourDefinition[]> {
  if (!userId) throw new Error('userId is required');

  const available = getToursForRole(role);
  const progress = await getTourProgress(userId);

  const completedOrDismissed = new Set(
    progress
      .filter((p) => p.is_completed || p.is_dismissed)
      .map((p) => p.tour_id),
  );

  return available.filter((t) => !completedOrDismissed.has(t.id));
}
