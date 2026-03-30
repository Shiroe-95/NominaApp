'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Column {
  key: string;
  label: string;
  fixed?: boolean;
  width?: number;
}

export interface ResponsivePayrollEditorProps {
  columns: Column[];
  data: Record<string, React.ReactNode>[];
  className?: string;
}

export function ResponsivePayrollEditor({ columns, data, className }: ResponsivePayrollEditorProps) {
  const fixedCols = columns.filter((c) => c.fixed);
  const scrollCols = columns.filter((c) => !c.fixed);

  return (
    <div className={cn('relative flex w-full overflow-hidden rounded-lg border border-white/10', className)}>
      {/* Fixed columns */}
      {fixedCols.length > 0 && (
        <div className="shrink-0 border-r border-white/10 bg-[#13151e]">
          <table className="text-sm">
            <thead>
              <tr>
                {fixedCols.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-left text-xs font-medium text-slate-400"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  {fixedCols.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-3 py-2 text-white" style={{ width: col.width }}>
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scrollable columns */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {scrollCols.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-left text-xs font-medium text-slate-400"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-white/5">
                {scrollCols.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-2 text-white" style={{ minWidth: col.width }}>
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
