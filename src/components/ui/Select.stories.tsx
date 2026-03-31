import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Minimal Select story wrapper */
function SelectDemo() {
  return (
    <select className="border rounded px-3 py-2 bg-background text-foreground">
      <option>Option 1</option>
      <option>Option 2</option>
      <option>Option 3</option>
    </select>
  );
}

const meta: Meta = {
  title: 'Base/Select',
  component: SelectDemo,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
