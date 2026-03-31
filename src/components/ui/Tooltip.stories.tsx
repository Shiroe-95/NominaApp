import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import { Button } from './Button';

function TooltipDemo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger>
        <TooltipContent><p>Tooltip content</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta: Meta = { title: 'Base/Tooltip', component: TooltipDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
