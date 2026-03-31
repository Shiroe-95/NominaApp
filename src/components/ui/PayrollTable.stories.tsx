import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/** Simplified PayrollTable story (composite component) */
function PayrollTableDemo() {
  const rows = [
    { id: '1', name: 'María García', doc: '12345678', salary: 3500, deductions: 700, net: 2800, risk: 'low' },
    { id: '2', name: 'Carlos López', doc: '87654321', salary: 4200, deductions: 840, net: 3360, risk: 'medium' },
    { id: '3', name: 'Ana Martínez', doc: '11223344', salary: 5100, deductions: 1020, net: 4080, risk: 'high' },
  ];

  const riskColor: Record<string, string> = {
    low: 'text-green-500', medium: 'text-yellow-500', high: 'text-red-500',
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {['Name', 'Document', 'Salary', 'Deductions', 'Net', 'Risk'].map((h) => (
              <th key={h} className="text-left p-3 text-sm font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-accent/50">
              <td className="p-3 font-medium">{r.name}</td>
              <td className="p-3 text-muted-foreground">{r.doc}</td>
              <td className="p-3">${r.salary.toLocaleString()}</td>
              <td className="p-3">${r.deductions.toLocaleString()}</td>
              <td className="p-3 font-medium">${r.net.toLocaleString()}</td>
              <td className={`p-3 font-medium ${riskColor[r.risk]}`}>{r.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const meta: Meta = { title: 'Composite/PayrollTable', component: PayrollTableDemo, tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = {};
