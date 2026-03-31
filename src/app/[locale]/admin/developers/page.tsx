/**
 * SDK Documentation Page — Developer section
 * Requirements: 19.6
 */
'use client';

import React from 'react';

const codeBlock = (code: string) => (
  <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono">
    <code>{code}</code>
  </pre>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-2xl font-semibold">{title}</h2>
    {children}
  </section>
);

const CONFIG_EXAMPLE = `const client = new NominaSmartClient({
  baseUrl: 'https://app.nominasmart.com',
  apiKey: 'ns_live_abc123',
  timeout: 15000,
  headers: { 'X-Custom': 'value' },
  onTokenRefresh: async () => {
    const res = await fetch('/auth/refresh');
    const { token } = await res.json();
    return token;
  },
});`;

const USAGE_EXAMPLE = `// List workspaces
const { data, error } = await client.listWorkspaces();

// Create a webhook
const { data: webhook } = await client.createWebhook({
  url: 'https://example.com/hook',
  events: ['payroll.uploaded', 'audit.completed'],
});

// Natural language query
const { data: nlq } = await client.queryNLQ({
  query: '¿Cuál es el total de nómina de enero?',
  locale: 'es',
  workspace_id: 'uuid-here',
});

// Health check
const { data: health } = await client.health();`;

export default function DevelopersPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-3xl font-bold">NominaSmart SDK</h1>
      <p className="text-muted-foreground">
        TypeScript SDK for programmatic access to the NominaSmart API v1.
        All types are derived from Zod schemas for full type safety.
      </p>

      <Section title="Installation">
        {codeBlock(`import { NominaSmartClient } from '@/lib/sdk/nominasmart-client';
import type { WorkspaceInput, APIResponse } from '@/lib/sdk/types';`)}
      </Section>

      <Section title="Configuration">
        {codeBlock(CONFIG_EXAMPLE)}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Option</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Default</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="px-4 py-2 font-mono text-xs">baseUrl</td><td className="px-4 py-2">string</td><td className="px-4 py-2">—</td><td className="px-4 py-2">Base URL of the NominaSmart instance</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2 font-mono text-xs">apiKey</td><td className="px-4 py-2">string</td><td className="px-4 py-2">—</td><td className="px-4 py-2">Bearer token for authentication</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2 font-mono text-xs">timeout</td><td className="px-4 py-2">number</td><td className="px-4 py-2">30000</td><td className="px-4 py-2">Request timeout in ms</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2 font-mono text-xs">maxRetries</td><td className="px-4 py-2">number</td><td className="px-4 py-2">3</td><td className="px-4 py-2">Max retries on 429</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2 font-mono text-xs">headers</td><td className="px-4 py-2">Record</td><td className="px-4 py-2">{'{}'}</td><td className="px-4 py-2">Custom headers</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">onTokenRefresh</td><td className="px-4 py-2">function</td><td className="px-4 py-2">—</td><td className="px-4 py-2">Callback for 401 token refresh</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Authentication">
        <p className="text-muted-foreground">
          The SDK uses Bearer token authentication. Pass your API key in the config.
          On 401 responses, the SDK calls <code className="bg-muted px-1 rounded">onTokenRefresh</code> once
          and retries with the new token. On 429 rate-limit responses, it retries with exponential backoff.
        </p>
      </Section>

      <Section title="Usage Examples">
        {codeBlock(USAGE_EXAMPLE)}
      </Section>

      <Section title="Error Handling">
        <p className="text-muted-foreground">
          Every method returns <code className="bg-muted px-1 rounded">{'APIResponse<T>'}</code> with
          <code className="bg-muted px-1 rounded">data</code>, <code className="bg-muted px-1 rounded">error</code>,
          <code className="bg-muted px-1 rounded">status</code>, and <code className="bg-muted px-1 rounded">requestId</code>.
          Check <code className="bg-muted px-1 rounded">error</code> for failures.
        </p>
        {codeBlock(`const { data, error, status, requestId } = await client.listWorkspaces();
if (error) {
  console.error(\`[\${status}] \${error} (requestId: \${requestId})\`);
}`)}
      </Section>

      <Section title="Available Methods">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td className="px-4 py-2 font-mono text-xs">listWorkspaces()</td><td className="px-4 py-2">List all workspaces</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">createWorkspace(data)</td><td className="px-4 py-2">Create a workspace</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">listWebhooks()</td><td className="px-4 py-2">List webhooks</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">createWebhook(data)</td><td className="px-4 py-2">Register a webhook</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">getAnomalies()</td><td className="px-4 py-2">List detected anomalies</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">queryNLQ(params)</td><td className="px-4 py-2">Natural language query</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">getForecast(params)</td><td className="px-4 py-2">Cost forecast</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">getAuditTrail(params?)</td><td className="px-4 py-2">Query audit trail</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">listAnnotations(type, id)</td><td className="px-4 py-2">List annotations</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">executeBulk(op, ids)</td><td className="px-4 py-2">Bulk operations</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">health()</td><td className="px-4 py-2">Health check</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="API Reference">
        <p className="text-muted-foreground">
          For the full interactive API reference with request/response schemas, visit{' '}
          <a href="/api/docs" className="text-primary underline hover:no-underline">/api/docs</a> (requires authentication).
        </p>
      </Section>
    </div>
  );
}
