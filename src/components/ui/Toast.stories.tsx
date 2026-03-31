import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

function ToastDemo() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-sm">
      <p className="font-medium text-foreground">Notification</p>
      <p className="text-sm text-muted-foreground">Operation completed successfully.</p>
    </div>
  );
}

const meta: Meta = { title: 'Base/Toast', component: ToastDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
