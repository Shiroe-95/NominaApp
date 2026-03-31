'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Badge } from '@/components/ui';
import type { SSOProtocol, NominaSmartRole } from '@/lib/auth/sso-service';

export interface SSOConfig {
  id: string;
  protocol: SSOProtocol;
  metadataUrl: string;
  entityId: string;
  certificateX509: string;
  groupRoleMapping: Record<string, NominaSmartRole>;
  defaultRole: NominaSmartRole;
  isActive: boolean;
}

export type SSOStatus = 'active' | 'inactive' | 'error';

export interface SSOSettingsProps {
  config?: SSOConfig | null;
  status?: SSOStatus;
  onSave?: (data: Omit<SSOConfig, 'id' | 'isActive'>) => void;
  onTestConnection?: () => void;
  onToggle?: (active: boolean) => void;
  onDelete?: () => void;
  className?: string;
}

const protocols: SSOProtocol[] = ['saml', 'oidc'];
const roles: NominaSmartRole[] = ['admin', 'analyst', 'client'];

export function SSOSettings({ config, status = 'inactive', onSave, onTestConnection, onToggle, onDelete, className }: SSOSettingsProps) {
  const [protocol, setProtocol] = useState<SSOProtocol>(config?.protocol ?? 'saml');
  const [metadataUrl, setMetadataUrl] = useState(config?.metadataUrl ?? '');
  const [entityId, setEntityId] = useState(config?.entityId ?? '');
  const [certificateX509, setCertificateX509] = useState(config?.certificateX509 ?? '');
  const [defaultRole, setDefaultRole] = useState<NominaSmartRole>(config?.defaultRole ?? 'client');
  const [groupMappingText, setGroupMappingText] = useState(
    config?.groupRoleMapping ? JSON.stringify(config.groupRoleMapping, null, 2) : '{\n  "admins": "admin",\n  "analysts": "analyst"\n}'
  );
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    let groupRoleMapping: Record<string, NominaSmartRole> = {};
    try { groupRoleMapping = JSON.parse(groupMappingText); } catch { /* keep empty */ }
    onSave?.({ protocol, metadataUrl, entityId, certificateX509, groupRoleMapping, defaultRole });
  };

  const handleTest = () => {
    setTesting(true);
    onTestConnection?.();
    setTimeout(() => setTesting(false), 3000);
  };

  const statusVariant = status === 'active' ? 'default' : status === 'error' ? 'destructive' : 'outline';

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">SSO Authentication</h2>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-[#181b26] p-4">
        <div>
          <Label htmlFor="sso-protocol">Protocol</Label>
          <select
            id="sso-protocol"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as SSOProtocol)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e1117] px-3 py-2 text-sm text-white"
          >
            {protocols.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>

        <div>
          <Label htmlFor="sso-metadata">Metadata URL</Label>
          <Input id="sso-metadata" value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://idp.example.com/.well-known/openid-configuration" />
        </div>

        <div>
          <Label htmlFor="sso-entity">Entity ID</Label>
          <Input id="sso-entity" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="urn:example:idp" />
        </div>

        <div>
          <Label htmlFor="sso-cert">X.509 Certificate</Label>
          <textarea
            id="sso-cert"
            value={certificateX509}
            onChange={(e) => setCertificateX509(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e1117] px-3 py-2 text-sm text-white font-mono"
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </div>

        <div>
          <Label htmlFor="sso-default-role">Default Role (JIT Provisioning)</Label>
          <select
            id="sso-default-role"
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value as NominaSmartRole)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e1117] px-3 py-2 text-sm text-white"
          >
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <Label htmlFor="sso-mapping">Group → Role Mapping (JSON)</Label>
          <textarea
            id="sso-mapping"
            value={groupMappingText}
            onChange={(e) => setGroupMappingText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e1117] px-3 py-2 text-sm text-white font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave}>Save Configuration</Button>
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          {config && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onToggle?.(!config.isActive)}>
                {config.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
