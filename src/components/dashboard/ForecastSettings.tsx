'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';

export interface ForecastParams {
  horizon: '3' | '6' | '12';
  growthRate: number;
  salaryIncrease: number;
  regulatoryImpact: number;
}

export interface ForecastSettingsProps {
  initialParams?: Partial<ForecastParams>;
  onApply?: (params: ForecastParams) => void;
  className?: string;
}

const defaults: ForecastParams = { horizon: '6', growthRate: 3, salaryIncrease: 5, regulatoryImpact: 0 };

export function ForecastSettings({ initialParams, onApply, className }: ForecastSettingsProps) {
  const [params, setParams] = useState<ForecastParams>({ ...defaults, ...initialParams });

  const handleApply = () => onApply?.(params);

  return (
    <div className={cn('space-y-4 rounded-xl border border-white/10 bg-[#181b26] p-4', className)}>
      <h3 className="text-sm font-semibold text-white">Forecast Parameters</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="horizon">Horizon (months)</Label>
          <Select value={params.horizon} onValueChange={(v) => setParams({ ...params, horizon: v as ForecastParams['horizon'] })}>
            <SelectTrigger id="horizon"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="growth">Growth Rate (%)</Label>
          <Input id="growth" type="number" value={params.growthRate} onChange={(e) => setParams({ ...params, growthRate: Number(e.target.value) })} />
        </div>

        <div>
          <Label htmlFor="salary">Salary Increase (%)</Label>
          <Input id="salary" type="number" value={params.salaryIncrease} onChange={(e) => setParams({ ...params, salaryIncrease: Number(e.target.value) })} />
        </div>

        <div>
          <Label htmlFor="regulatory">Regulatory Impact (%)</Label>
          <Input id="regulatory" type="number" value={params.regulatoryImpact} onChange={(e) => setParams({ ...params, regulatoryImpact: Number(e.target.value) })} />
        </div>
      </div>

      <Button variant="primary" size="sm" onClick={handleApply}>Apply Parameters</Button>
    </div>
  );
}
