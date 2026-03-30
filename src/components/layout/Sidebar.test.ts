/**
 * Unit tests for Sidebar helpers and RBAC filtering logic.
 *
 * Tests the exported `getFlowIndex` function and verifies that
 * navigation filtering via `hasPermission` works correctly for
 * all three roles (admin, analyst, client).
 */
import { describe, it, expect } from 'vitest';
import { getFlowIndex } from './Sidebar';
import { hasPermission, type UserRole } from '@/lib/auth/user-profile';

// ─── getFlowIndex ───────────────────────────────────────────────────────────

describe('getFlowIndex', () => {
  it('returns 1 for /upload', () => {
    expect(getFlowIndex('/upload')).toBe(1);
  });

  it('returns 1 for /upload/sub-path', () => {
    expect(getFlowIndex('/upload/step2')).toBe(1);
  });

  it('returns 2 for /reconcile', () => {
    expect(getFlowIndex('/reconcile')).toBe(2);
  });

  it('returns 3 for /reports', () => {
    expect(getFlowIndex('/reports')).toBe(3);
  });

  it('returns 3 for /reports/detail', () => {
    expect(getFlowIndex('/reports/detail')).toBe(3);
  });

  it('returns 0 for /dashboard (outside flow)', () => {
    expect(getFlowIndex('/dashboard')).toBe(0);
  });

  it('returns 0 for /settings (outside flow)', () => {
    expect(getFlowIndex('/settings')).toBe(0);
  });

  it('returns 0 for /rules (outside flow)', () => {
    expect(getFlowIndex('/rules')).toBe(0);
  });

  it('returns 0 for root path', () => {
    expect(getFlowIndex('/')).toBe(0);
  });
});

// ─── RBAC navigation filtering ─────────────────────────────────────────────

const navRoutes = ['/dashboard', '/upload', '/reconcile', '/reports', '/rules', '/settings'];

describe('Sidebar RBAC filtering', () => {
  it('admin sees all navigation links', () => {
    const visible = navRoutes.filter((r) => hasPermission('admin', r));
    expect(visible).toEqual(navRoutes);
  });

  it('analyst sees all links except /admin/* routes', () => {
    const visible = navRoutes.filter((r) => hasPermission('analyst', r));
    // All sidebar routes are non-admin, so analyst sees everything
    expect(visible).toEqual(navRoutes);
  });

  it('analyst cannot see /admin/finance', () => {
    expect(hasPermission('analyst', '/admin/finance')).toBe(false);
  });

  it('client sees only /dashboard and /reports', () => {
    const visible = navRoutes.filter((r) => hasPermission('client', r));
    expect(visible).toEqual(['/dashboard', '/reports']);
  });

  it('client cannot see /upload', () => {
    expect(hasPermission('client', '/upload')).toBe(false);
  });

  it('client cannot see /reconcile', () => {
    expect(hasPermission('client', '/reconcile')).toBe(false);
  });

  it('client cannot see /rules', () => {
    expect(hasPermission('client', '/rules')).toBe(false);
  });

  it('client cannot see /settings', () => {
    expect(hasPermission('client', '/settings')).toBe(false);
  });
});
