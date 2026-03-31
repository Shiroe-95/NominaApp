import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

function TableDemo() {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left p-2 text-foreground">Name</th>
          <th className="text-left p-2 text-foreground">Role</th>
          <th className="text-right p-2 text-foreground">Salary</th>
        </tr>
      </thead>
      <tbody>
        {['Alice', 'Bob', 'Carol'].map((name, i) => (
          <tr key={name} className="border-b border-border">
            <td className="p-2">{name}</td>
            <td className="p-2">Analyst</td>
            <td className="p-2 text-right">${(3000 + i * 500).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const meta: Meta = { title: 'Base/Table', component: TableDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
