import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Skeleton } from './Skeleton';

function SkeletonDemo() {
  return (
    <div className="space-y-3 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  );
}

const meta: Meta = { title: 'Base/Skeleton', component: SkeletonDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
