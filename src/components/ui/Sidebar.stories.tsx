import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Minimal sidebar representation for Storybook */
function SidebarDemo() {
  return (
    <aside className="w-64 h-96 bg-sidebar text-sidebar-foreground border-r border-border p-4 space-y-2">
      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Navigation</h3>
      {['Dashboard', 'Reports', 'Upload', 'Rules', 'Settings'].map((item) => (
        <div key={item} className="px-3 py-2 rounded-md hover:bg-accent cursor-pointer text-sm">
          {item}
        </div>
      ))}
    </aside>
  );
}

const meta: Meta = { title: 'Base/Sidebar', component: SidebarDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
