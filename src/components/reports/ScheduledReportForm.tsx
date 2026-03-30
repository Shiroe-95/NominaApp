'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';

export interface ScheduledReportConfig {
  name: string;
  reportType: 'executive' | 'risk_detail' | 'comparative' | 'compliance' | 'cost_analysis' | 'custom';
  outputFormat: 'excel' | 'pdf';
  cronExpression: string;
  recipients: string[];
}

export interface ScheduledReportFormProps {
  initialValues?: Partial<ScheduledReportConfig>;
  onSubmit?: (config: ScheduledReportConfig) => void;
  onCancel?: () => void;
  className?: string;
}

export function ScheduledReportForm({ initialValues, onSubmit, onCancel, className }: ScheduledReportFormProps) {
  const [config, setConfig] = useState<ScheduledReportConfig>({
    name: '',
    reportType: 'executive',
    outputFormat: 'pdf',
    cronExpression: '0 8 * * 1',
    recipients: [],
    ...initialValues,
  });
  const [recipientInput, setRecipientInput] = useState('');

  const addRecipient = () => {
    if (recipientInput.trim() && !config.recipients.includes(recipientInput.trim())) {
      setConfig({ ...config, recipients: [...config.recipients, recipientInput.trim()] });
      setRecipientInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(config);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4 rounded-xl border border-white/10 bg-[#181b26] p-6', className)}>
      <h3 className="text-lg font-semibold text-white">Schedule Report</h3>

      <div><Label htmlFor="rpt-name">Report Name</Label><Input id="rpt-name" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} required /></div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rpt-type">Type</Label>
          <Select value={config.reportType} onValueChange={(v) => setConfig({ ...config, reportType: v as ScheduledReportConfig['reportType'] })}>
            <SelectTrigger id="rpt-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="risk_detail">Risk Detail</SelectItem>
              <SelectItem value="comparative">Comparative</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="cost_analysis">Cost Analysis</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="rpt-format">Format</Label>
          <Select value={config.outputFormat} onValueChange={(v) => setConfig({ ...config, outputFormat: v as 'excel' | 'pdf' })}>
            <SelectTrigger id="rpt-format"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div><Label htmlFor="rpt-cron">Frequency (cron)</Label><Input id="rpt-cron" value={config.cronExpression} onChange={(e) => setConfig({ ...config, cronExpression: e.target.value })} placeholder="0 8 * * 1" /></div>

      <div>
        <Label>Recipients</Label>
        <div className="flex items-center gap-2">
          <Input value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} placeholder="email@example.com" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())} />
          <Button type="button" variant="outline" size="sm" onClick={addRecipient}>Add</Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {config.recipients.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#262a35] px-2 py-0.5 text-xs text-white">
              {r}
              <button type="button" onClick={() => setConfig({ ...config, recipients: config.recipients.filter((_, j) => j !== i) })} className="text-[#958da1] hover:text-white">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Schedule</Button>
      </div>
    </form>
  );
}
