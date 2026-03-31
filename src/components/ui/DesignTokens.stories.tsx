import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

const colorTokens = [
  'background', 'foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground',
  'border', 'ring', 'card', 'card-foreground',
  'popover', 'popover-foreground', 'sidebar', 'sidebar-foreground',
];

function ColorSwatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded border border-border"
        style={{ backgroundColor: `hsl(var(--${token}))` }}
      />
      <code className="text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

function DesignTokensDemo() {
  return (
    <div className="space-y-8 p-4">
      <section>
        <h2 className="text-xl font-bold mb-4">Color Tokens</h2>
        <div className="grid grid-cols-4 gap-4">
          {colorTokens.map((t) => <ColorSwatch key={t} token={t} />)}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Typography</h2>
        <div className="space-y-2">
          <p className="text-3xl font-bold">Heading 1 (text-3xl bold)</p>
          <p className="text-2xl font-semibold">Heading 2 (text-2xl semibold)</p>
          <p className="text-xl font-medium">Heading 3 (text-xl medium)</p>
          <p className="text-base">Body (text-base)</p>
          <p className="text-sm text-muted-foreground">Small / Muted (text-sm)</p>
          <p className="text-xs text-muted-foreground">Caption (text-xs)</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Spacing</h2>
        <div className="flex gap-2 items-end">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="bg-primary" style={{ width: `${s * 4}px`, height: `${s * 4}px` }} />
              <code className="text-xs text-muted-foreground">{s}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Shadows</h2>
        <div className="flex gap-4">
          <div className="w-24 h-24 bg-card rounded-lg shadow-sm flex items-center justify-center text-xs">sm</div>
          <div className="w-24 h-24 bg-card rounded-lg shadow-md flex items-center justify-center text-xs">md</div>
          <div className="w-24 h-24 bg-card rounded-lg shadow-lg flex items-center justify-center text-xs">lg</div>
          <div className="w-24 h-24 bg-card rounded-lg shadow-xl flex items-center justify-center text-xs">xl</div>
        </div>
      </section>
    </div>
  );
}

const meta: Meta = {
  title: 'Design Tokens/Overview',
  component: DesignTokensDemo,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;
export const Default: Story = {};
