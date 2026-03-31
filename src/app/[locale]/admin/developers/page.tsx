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

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-lg font-medium">{title}</h3>
    {children}
  </div>
);

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
        <ConfigTable />
      </Section>

      <Section title="Authentication">
        <p className="text-muted-foreground">
