import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

function AvatarDemo() {
  return (
    <div className="flex gap-2 items-center">
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
        AB
      </div>
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-medium">
        CD
      </div>
    </div>
  );
}

const meta: Meta = { title: 'Base/Avatar', component: AvatarDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
