import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './Dialog';
import { Button } from './Button';

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button>Open Dialog</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Dialog Title</DialogTitle></DialogHeader>
        <p className="text-muted-foreground">Dialog content goes here.</p>
      </DialogContent>
    </Dialog>
  );
}

const meta: Meta = { title: 'Base/Dialog', component: DialogDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
