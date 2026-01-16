// frontend/src/components/dashboard/IncidentsPerPilotChart.jsx

import React, { useMemo, useState } from 'react';
import tw from 'twin.macro';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const truncateLabel = (str, max = 16) => {
    if (!str) return '';
    const s = String(str);
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
};

const buildTopNWithOthers = (arr, topN) => {
    const normalized = (Array.isArray(arr) ? arr : [])
        .map((it) => ({
            pilotName: it?.pilotName ?? 'Desconocido',
            incidentCount: toNumber(it?.incidentCount),
        }))
        .filter((it) => it.incidentCount > 0)
        .sort((a, b) => b.incidentCount - a.incidentCount);

    if (topN === 'all') return normalized;

    const n = Math.max(1, Number(topN) || 10);
    const top = normalized.slice(0, n);
    const rest = normalized.slice(n);

    if (rest.length === 0) return top;

    const restSum = rest.reduce((acc, it) => acc + it.incidentCount, 0);
    return [...top, { pilotName: 'Otros pilotos', incidentCount: restSum }];
};

const calcDynamicHeight = (rowsCount) => {
    const min = 280;
    const max = 620;
    const perRow = 34;
    const h = rowsCount * perRow + 80;
    return Math.max(min, Math.min(max, h));
};

const IncidentsPerPilotChart = ({ data }) => {
    const [topN, setTopN] = useState(15);

    // data = array de incidentes con .piloto
    const aggregated = useMemo(() => {
        const map = {};
        (data || []).forEach((inc) => {
            const pilotName = inc?.piloto?.name || 'Desconocido';
            map[pilotName] = (map[pilotName] || 0) + 1;
        });

        return Object.entries(map).map(([pilotName, incidentCount]) => ({
            pilotName,
            incidentCount
        }));
    }, [data]);

    const chartData = useMemo(() => buildTopNWithOthers(aggregated, topN), [aggregated, topN]);
    const height = useMemo(() => calcDynamicHeight(chartData.length), [chartData.length]);

    return (
        <ChartContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom style={{ marginBottom: 0 }}>
                    Incidentes por Piloto
                </Typography>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Top pilotos</InputLabel>
                    <Select
                        label="Top pilotos"
                        value={topN}
                        onChange={(e) => setTopN(e.target.value)}
                    >
                        <MenuItem value={10}>Top 10</MenuItem>
                        <MenuItem value={15}>Top 15</MenuItem>
                        <MenuItem value={20}>Top 20</MenuItem>
                        <MenuItem value="all">Todo</MenuItem>
                    </Select>
                </FormControl>
            </div>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Mostrando {topN === 'all' ? 'todo' : `Top ${topN}`} (resto agrupado como “Otros pilotos”).
            </Typography>

            {chartData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No hay datos de incidentes para mostrar.
                </Typography>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                            type="category"
                            dataKey="pilotName"
                            width={160}
                            tickFormatter={(v) => truncateLabel(v, 18)}
                        />
                        <Tooltip
                            formatter={(value) => `${toNumber(value)} incidentes`}
                            labelFormatter={(label) => `Piloto: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="incidentCount" name="Incidentes" fill="#FF0000" />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartContainer>
    );
};

export default IncidentsPerPilotChart;
