import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Simplified Rule Editor story (composite component) */
function RuleEditorDemo() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 max-w-lg space-y-4">
      <h3 className="font-semibold text-lg">Edit Rule</h3>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Country</label>
        <select className="w-full border border-border rounded px-3 py-2 bg-background">
          <option>Colombia (CO)</option>
          <option>Mexico (MX)</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Year</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background" defaultValue="2024" />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Rule Expression</label>
        <textarea className="w-full border border-border rounded px-3 py-2 bg-background h-20 font-mono text-sm"
          defaultValue="salary_base * 0.12" />
      </div>
      <div className="flex gap-2 justify-end">
        <button className="px-4 py-2 rounded border border-border text-sm">Cancel</button>
        <button className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm">Save</button>
      </div>
    </div>
  );
}

const meta: Meta = { title: 'Composite/RuleEditor', component: RuleEditorDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
