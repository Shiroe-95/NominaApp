'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LineChart,
    Line,
    Legend
} from 'recharts';
import { colors, elevation } from '@/lib/design-tokens';

const monthData = [
    { name: 'May', errors: 45, internal: 120, pila: 110, ugpp: 125 },
    { name: 'Jun', errors: 38, internal: 125, pila: 125, ugpp: 125 },
    { name: 'Jul', errors: 22, internal: 130, pila: 125, ugpp: 130 },
    { name: 'Aug', errors: 30, internal: 132, pila: 130, ugpp: 135 },
    { name: 'Sep', errors: 15, internal: 135, pila: 135, ugpp: 135 },
    { name: 'Oct', errors: 12, internal: 140, pila: 138, ugpp: 140 },
];

const tooltipStyle = {
    borderRadius: '12px',
    border: `1px solid ${colors.surfaceContainer.high}`,
    background: colors.surfaceContainer.default,
    boxShadow: elevation.medium,
    color: colors.onSurface,
};

export function ErrorTrendChart() {
    return (
        <div className="h-[300px] w-full mt-4">
            <BarChart
                data={monthData}
                responsive
                style={{ width: '100%', height: '100%' }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.surfaceContainer.high} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} />
                <Tooltip
                    cursor={{ fill: colors.surfaceContainer.low }}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: colors.onSurface }}
                    labelStyle={{ color: colors.onSurface, opacity: 0.7, marginBottom: '4px' }}
                />
                <Bar dataKey="errors" fill={colors.primary} radius={[4, 4, 0, 0]} name="Inconsistencias" animationDuration={400} />
            </BarChart>
        </div>
    );
}

export function TripleMatchChart() {
    return (
        <div className="h-[300px] w-full mt-4">
            <LineChart
                data={monthData}
                responsive
                style={{ width: '100%', height: '100%' }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.surfaceContainer.high} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} />
                <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: colors.onSurface }}
                    labelStyle={{ color: colors.onSurface, opacity: 0.7, marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.onSurface }} />
                <Line type="monotone" dataKey="internal" stroke={colors.primary} strokeWidth={2} dot={false} name="Nómina Interna" animationDuration={400} />
                <Line type="monotone" dataKey="pila" stroke={colors.error} strokeWidth={2} dot={false} name="PILA" animationDuration={400} />
                <Line type="monotone" dataKey="ugpp" stroke={colors.success} strokeWidth={2} dot={false} name="UGPP" animationDuration={400} />
            </LineChart>
        </div>
    );
}
