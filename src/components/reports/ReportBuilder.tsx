'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Checkbox, Label } from '@/components/ui';

export type VisualizationType = 'table' | 'bar' | 'line' | 'pie';

export interface ReportField {
  key: string;
  label: string;
  selected: boolean;
}

export interface ReportBuilderConfig {
  fields: ReportField[];
  visualization: VisualizationType;
  templateId?: string;
}

export interface ReportBuilderProps {
  availableFields?: ReportField[];
  templates?: { id: string; name: string }[];
  onBuild?: (config: ReportBuilderConfig) => void;
  onSave?: (config: ReportBuilderConfig) => void;
  className?: string;
}

const defaultFields: ReportField[] = [
  { key: 'employee_name', label: 'Employee Name', selected: true },
  { key: 'document', label: 'Document', selected: true },
  { key: 'salary', label: 'Salary', selected: false },
  { key: 'deductions', label: 'Deductions', selected: false },
  { key: 'net_pay', label: 'Net Pay', selected: true },
  { key: 'risk_score', label: 'Risk Score', selected: false },
];

export function ReportBuilder({ availableFields = defaultFields, templates = [], onBuild, onSave, className }: ReportBuilderProps) {
  const [fields, setFields] = useState<ReportField[]>(availableFields);
  const [visualization, setVisualization] = useState<VisualizationType>('table');

  const toggleField = (key: string) => {
    setFields(fields.map((f) => f.key === key ? { ...f, selected: !f.selected } : f));
  };

  const config: ReportBuilderConfig = { fields, visualization };

  return (
    <div className={cn('space-y-6 rounded-xl border border-white/10 bg-[#181b26] p-6', className)}>
      <h3 className="text-lg font-semibold text-white">Report Builder</h3>

      {templates.length > 0 && (
        <div>
          <Label>Template</Label>
          <Select onValueChange={() => {}}>
            <SelectTrigger><SelectValue placeholder="Start from template..." /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>Fields</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.02] cursor-pointer">
              <Checkbox checked={f.selected} onCheckedChange={() => toggleField(f.key)} />
              <span className="text-sm text-white">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Visualization</Label>
        <Select value={visualization} onValueChange={(v) => setVisualization(v as VisualizationType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="bar">Bar Chart</SelectItem>
            <SelectItem value="line">Line Chart</SelectItem>
            <SelectItem value="pie">Pie Chart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => onBuild?.(config)}>Preview Report</Button>
        <Button variant="outline" onClick={() => onSave?.(config)}>Save Report</Button>
      </div>
    </div>
  );
}
