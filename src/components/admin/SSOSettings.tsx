'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';

export interface SSOSettingsProps {
  workspaceId: string;
  className?: string;
  onSave?: (config: SSOConfig) => void;
}

export interface SSOConfig {
  protocol: 'saml' | 'oidc';
  metadataUrl: string;
  entityId: string;
  certificateX509: string;
  defaultRole: 'admin' | 'analyst' | 'client';
  groupRoleMapping: Record<string, string>;
  isActive: boolean;
}

export function SSOSettings({ workspaceId, className, onSave }: SSOSettingsProps) {
  const [config, setConfig] = useState<SSOConfig>({
    protocol: 'saml',
    metadataUrl: '',
    entityId: '',
    certificateX509: '',
    defaultRole: 'analyst',
    groupRoleMapping: {},
    isActive: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(config);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6 rounded-xl border border-white/10 bg-[#181b26] p-6', className)}>
      <h2 className="text-lg font-semibold text-white">SSO / Identity Provider Configuration</h2>
      <p className="text-sm text-[#958da1]">Workspace: {workspaceId}</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="protocol">Protocol</Label>
          <Select value={config.protocol} onValueChange={(v) => setConfig({ ...config, protocol: v as SSOConfig['protocol'] })}>
            <SelectTrigger id="protocol"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="saml">SAML 2.0</SelectItem>
              <SelectItem value="oidc">OpenID Connect</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="metadataUrl">Metadata URL</Label>
          <Input id="metadataUrl" value={config.metadataUrl} onChange={(e) => setConfig({ ...config, metadataUrl: e.target.value })} placeholder="https://idp.example.com/.well-known/metadata" />
        </div>

        <div>
          <Label htmlFor="entityId">Entity ID</Label>
          <Input id="entityId" value={config.entityId} onChange={(e) => setConfig({ ...config, entityId: e.target.value })} placeholder="urn:example:idp" />
        </div>

        <div>
          <Label htmlFor="defaultRole">Default Role</Label>
          <Select value={config.defaultRole} onValueChange={(v) => setConfig({ ...config, defaultRole: v as SSOConfig['defaultRole'] })}>
            <SelectTrigger id="defaultRole"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" variant="primary">Save SSO Configuration</Button>
      </div>
    </form>
  );
}
