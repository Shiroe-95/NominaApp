/**
 * Sentry Client Configuration — React error boundary, breadcrumbs, Web Vitals.
 *
 * This file is loaded by Next.js on the client side.
 * Requires NEXT_PUBLIC_SENTRY_DSN environment variable.
 *
 * Requirements: 22.1, 22.2, 22.4, 22.6
 * @module sentry.client.config
 */

import { createClientConfig } from '@/lib/monitoring/sentry-config';

const config = createClientConfig();

// In production, this would call Sentry.init(config)
// For now, we export the config for reference
export default config;
