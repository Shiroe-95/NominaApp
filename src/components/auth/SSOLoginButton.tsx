'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import { SSO_TIMEOUT_MS } from '@/lib/auth/sso-service';

export interface SSOLoginButtonProps {
  /** Whether the organization has SSO configured */
  ssoEnabled?: boolean;
  /** Callback to initiate SSO login flow */
  onSSOLogin?: () => Promise<void>;
  /** Fallback callback for email/password login */
  onFallbackLogin?: () => void;
  className?: string;
}

/**
 * Conditional SSO login button shown when the organization has SSO configured.
 * Implements 10s timeout with fallback to email/password login (Req 14.5).
 */
export function SSOLoginButton({ ssoEnabled = false, onSSOLogin, onFallbackLogin, className }: SSOLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const handleSSOLogin = useCallback(async () => {
    setLoading(true);
    setTimedOut(false);

    const timeout = setTimeout(() => {
      setTimedOut(true);
      setLoading(false);
    }, SSO_TIMEOUT_MS);

    try {
      await onSSOLogin?.();
    } catch {
      setTimedOut(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [onSSOLogin]);

  useEffect(() => {
    return () => setLoading(false);
  }, []);

  if (!ssoEnabled) return null;

  return (
    <div className={className}>
      <Button
        variant="primary"
        className="w-full"
        onClick={handleSSOLogin}
        disabled={loading}
        aria-label="Sign in with corporate SSO"
      >
        {loading ? 'Connecting to IdP…' : 'Sign in with Corporate SSO'}
      </Button>

      {timedOut && (
        <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          <p>Identity Provider did not respond within 10 seconds.</p>
          <button
            onClick={onFallbackLogin}
            className="mt-1 text-yellow-400 underline hover:text-yellow-300"
          >
            Sign in with email/password instead
          </button>
        </div>
      )}
    </div>
  );
}
