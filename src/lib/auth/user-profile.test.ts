/**
 * Unit tests for RBAC permission logic in user-profile.ts
 *
 * Validates: Requirements 1.3, 1.4, 1.7, 16.7
 */
import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isPublicRoute,
  CLIENT_ALLOWED_ROUTES,
  ADMIN_ROUTE_PREFIX,
  PUBLIC_PATHS,
  PUBLIC_PREFIXES,
} from './user-profile';

describe('hasPermission', () => {
  // ─── admin: acceso total ──────────────────────────────────────────────
  describe('admin role', () => {
    it('should allow access to /dashboard', () => {
      expect(hasPermission('admin', '/dashboard')).toBe(true);
    });

    it('should allow access to /admin/users', () => {
      expect(hasPermission('admin', '/admin/users')).toBe(true);
    });

    it('should allow access to /admin/finance', () => {
      expect(hasPermission('admin', '/admin/finance')).toBe(true);
    });

    it('should allow access to /upload', () => {
      expect(hasPermission('admin', '/upload')).toBe(true);
    });

    it('should allow access to /reports', () => {
      expect(hasPermission('admin', '/reports')).toBe(true);
    });

    it('should allow access to /settings/providers', () => {
      expect(hasPermission('admin', '/settings/providers')).toBe(true);
    });

    it('should allow access to /rules', () => {
      expect(hasPermission('admin', '/rules')).toBe(true);
    });
  });

  // ─── analyst: todo excepto /admin/* ───────────────────────────────────
  describe('analyst role', () => {
    it('should allow access to /dashboard', () => {
      expect(hasPermission('analyst', '/dashboard')).toBe(true);
    });

    it('should allow access to /upload', () => {
      expect(hasPermission('analyst', '/upload')).toBe(true);
    });

    it('should allow access to /reconcile', () => {
      expect(hasPermission('analyst', '/reconcile')).toBe(true);
    });

    it('should allow access to /reports', () => {
      expect(hasPermission('analyst', '/reports')).toBe(true);
    });

    it('should allow access to /rules', () => {
      expect(hasPermission('analyst', '/rules')).toBe(true);
    });

    it('should allow access to /settings', () => {
      expect(hasPermission('analyst', '/settings')).toBe(true);
    });

    it('should allow access to /settings/providers', () => {
      expect(hasPermission('analyst', '/settings/providers')).toBe(true);
    });

    it('should deny access to /admin', () => {
      expect(hasPermission('analyst', '/admin')).toBe(false);
    });

    it('should deny access to /admin/users', () => {
      expect(hasPermission('analyst', '/admin/users')).toBe(false);
    });

    it('should deny access to /admin/finance', () => {
      expect(hasPermission('analyst', '/admin/finance')).toBe(false);
    });

    it('should deny access to /admin/countries', () => {
      expect(hasPermission('analyst', '/admin/countries')).toBe(false);
    });
  });

  // ─── client: solo /dashboard y /reports ───────────────────────────────
  describe('client role', () => {
    it('should allow access to /dashboard', () => {
      expect(hasPermission('client', '/dashboard')).toBe(true);
    });

    it('should allow access to /reports', () => {
      expect(hasPermission('client', '/reports')).toBe(true);
    });

    it('should allow access to /reports/detail', () => {
      expect(hasPermission('client', '/reports/detail')).toBe(true);
    });

    it('should deny access to /upload', () => {
      expect(hasPermission('client', '/upload')).toBe(false);
    });

    it('should deny access to /reconcile', () => {
      expect(hasPermission('client', '/reconcile')).toBe(false);
    });

    it('should deny access to /rules', () => {
      expect(hasPermission('client', '/rules')).toBe(false);
    });

    it('should deny access to /settings', () => {
      expect(hasPermission('client', '/settings')).toBe(false);
    });

    it('should deny access to /admin', () => {
      expect(hasPermission('client', '/admin')).toBe(false);
    });

    it('should deny access to /admin/users', () => {
      expect(hasPermission('client', '/admin/users')).toBe(false);
    });
  });
});

describe('isPublicRoute', () => {
  it('should return true for /', () => {
    expect(isPublicRoute('/')).toBe(true);
  });

  it('should return true for /pricing', () => {
    expect(isPublicRoute('/pricing')).toBe(true);
  });

  it('should return true for /contact', () => {
    expect(isPublicRoute('/contact')).toBe(true);
  });

  it('should return true for /about', () => {
    expect(isPublicRoute('/about')).toBe(true);
  });

  it('should return true for /manual', () => {
    expect(isPublicRoute('/manual')).toBe(true);
  });

  it('should return true for /login', () => {
    expect(isPublicRoute('/login')).toBe(true);
  });

  it('should return true for /login?redirectTo=/dashboard', () => {
    expect(isPublicRoute('/login?redirectTo=/dashboard')).toBe(true);
  });

  it('should return true for /auth/callback', () => {
    expect(isPublicRoute('/auth/callback')).toBe(true);
  });

  it('should return false for /dashboard', () => {
    expect(isPublicRoute('/dashboard')).toBe(false);
  });

  it('should return false for /upload', () => {
    expect(isPublicRoute('/upload')).toBe(false);
  });

  it('should return false for /admin', () => {
    expect(isPublicRoute('/admin')).toBe(false);
  });
});
