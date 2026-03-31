import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

function CardDemo() {
  return (
    <Card className="w-80">
      <CardHeader><CardTitle>Card Title</CardTitle></CardHeader>
      <CardContent><p className="text-muted-foreground">Card content.</p></CardContent>
    </Card>
  );
}

const meta: Meta = { title: 'Base/Card', component: CardDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
