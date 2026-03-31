import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Simplified AI Sidebar story (composite component) */
function AISidebarDemo() {
  return (
    <aside className="w-80 h-[500px] bg-card border-l border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">AI Assistant</h3>
        <p className="text-xs text-muted-foreground">Ask questions about your payroll data</p>
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <div className="bg-muted rounded-lg p-3 text-sm max-w-[80%]">
          ¿Cuál es el total de nómina de enero?
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-sm max-w-[80%] ml-auto">
          El total de nómina de enero es $125,430.00 para 45 empleados.
        </div>
      </div>
      <div className="p-4 border-t border-border">
        <input className="w-full bg-muted rounded-lg px-3 py-2 text-sm" placeholder="Ask a question..." />
      </div>
    </aside>
  );
}

const meta: Meta = { title: 'Composite/AISidebar', component: AISidebarDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
