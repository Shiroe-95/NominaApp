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

const monthData = [
    { name: 'May', errors: 45, internal: 120, pila: 110, ugpp: 125 },
    { name: 'Jun', errors: 38, internal: 125, pila: 125, ugpp: 125 },
    { name: 'Jul', errors: 22, internal: 130, pila: 125, ugpp: 130 },
    { name: 'Aug', errors: 30, internal: 132, pila: 130, ugpp: 135 },
    { name: 'Sep', errors: 15, internal: 135, pila: 135, ugpp: 135 },
    { name: 'Oct', errors: 12, internal: 140, pila: 138, ugpp: 140 },
];

export function ErrorTrendChart() {
    return (
        <div className="h-[300px] w-full mt-4">
            <BarChart
                data={monthData}
                responsive
                style={{ width: '100%', height: '100%' }}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="errors" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Inconsistencies" />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="internal" stroke="#7C3AED" strokeWidth={2} dot={false} name="Nómina Interna" />
                <Line type="monotone" dataKey="pila" stroke="#E11D48" strokeWidth={2} dot={false} name="PILA" />
                <Line type="monotone" dataKey="ugpp" stroke="#10B981" strokeWidth={2} dot={false} name="UGPP" />
            </LineChart>
        </div>
    );
}
