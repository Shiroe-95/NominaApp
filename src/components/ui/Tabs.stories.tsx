import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

function TabsDemo() {
  return (
    <Tabs defaultValue="tab1" className="w-80">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for tab 1</TabsContent>
      <TabsContent value="tab2">Content for tab 2</TabsContent>
    </Tabs>
  );
}

const meta: Meta = { title: 'Base/Tabs', component: TabsDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
