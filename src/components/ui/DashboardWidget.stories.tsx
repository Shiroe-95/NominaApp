import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Simplified Dashboard Widget story (composite component) */
function DashboardWidgetDemo() {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      {[
        { title: 'Total Payroll', value: '$125,430', change: '+2.3%' },
        { title: 'Anomalies', value: '3', change: '-1' },
        { title: 'Employees', value: '245', change: '+5' },
        { title: 'Risk Score', value: '12%', change: '-3%' },
      ].map((w) => (
        <div key={w.title} className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">{w.title}</p>
          <p className="text-2xl font-bold mt-1">{w.value}</p>
          <p className="text-xs text-green-500 mt-1">{w.change}</p>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = { title: 'Composite/DashboardWidget', component: DashboardWidgetDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
