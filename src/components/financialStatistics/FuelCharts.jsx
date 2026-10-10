// src/components/financialStatistics/FuelCharts.jsx

import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { toPriceChartData, toSpendChartData, formatMoney } from './fuelStatsUtils';

const cardSx = { bgcolor: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 1, p: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const titleSx = { fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600, mb: 1.5 };
const axisTick = { fontSize: 11, fill: '#6B7280' };
const gridStroke = '#e5e7eb';

const STACK_ORDER = ['ion_diesel', 'diesel', 'super', 'regular'];
const LINE_DASH = { diesel: undefined, ion_diesel: '8 4', super: '2 3', regular: '10 3 2 3' };

const FuelCharts = ({ series, visibleTypes }) => {
    const priceData = useMemo(() => toPriceChartData(series), [series]);
    const spendData = useMemo(() => toSpendChartData(series), [series]);
    const stackedTypes = useMemo(
        () => STACK_ORDER.map((key) => visibleTypes.find((t) => t.key === key)).filter(Boolean),
        [visibleTypes]
    );

    if (!series.length || !visibleTypes.length) return null;

    const showDots = series.length <= 31;

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 3 }}>
            <Box sx={cardSx}>
                <Typography sx={titleSx}>Precio por galón (ponderado)</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={priceData} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                        <XAxis dataKey="label" tick={axisTick} minTickGap={16} />
                        <YAxis tick={axisTick} domain={['auto', 'auto']} tickFormatter={(v) => `Q ${v}`} width={64} />
                        <Tooltip formatter={(value) => formatMoney(value)} />
                        <Legend iconType="plainline" />
                        {visibleTypes.map((t) => (
                            <Line
                                key={t.key}
                                type="monotone"
                                dataKey={t.key}
                                name={t.label}
                                stroke={t.color}
                                strokeWidth={2}
                                strokeDasharray={LINE_DASH[t.key]}
                                dot={showDots ? { r: 3 } : false}
                                activeDot={{ r: 5 }}
                                connectNulls={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </Box>

            <Box sx={cardSx}>
                <Typography sx={titleSx}>Gasto por período</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={spendData} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                        <XAxis dataKey="label" tick={axisTick} minTickGap={16} />
                        <YAxis tick={axisTick} tickFormatter={(v) => `Q ${Number(v).toLocaleString('es-GT')}`} width={80} />
                        <Tooltip formatter={(value) => formatMoney(value)} />
                        <Legend />
                        {stackedTypes.map((t) => (
                            <Bar key={t.key} dataKey={t.key} name={t.label} stackId="gasto" fill={t.color} stroke="#fff" strokeWidth={1} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        </Box>
    );
};

export default FuelCharts;
