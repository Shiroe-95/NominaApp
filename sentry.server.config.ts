/**
 * Sentry Server Configuration — API route error capture, source maps.
 *
 * This file is loaded by Next.js on the server side.
 * Requires SENTRY_DSN environment variable.
 *
 * Requirements: 22.1, 22.2, 22.3
 * @module sentry.server.config
 */

import { createServerConfig } from '@/lib/monitoring/sentry-config';

const config = createServerConfig();

// In production, this would call Sentry.init(config)
// For now, we export the config for reference
export default config;
