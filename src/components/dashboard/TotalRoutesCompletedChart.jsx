// frontend/src/components/dashboard/TotalRoutesCompletedChart.jsx

import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Typography } from '@mui/material';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;
const COLORS = ['#0088FE', '#00C49F'];

const TotalRoutesCompletedChart = ({ data }) => {
    // Convert the numeric "data" to a small array for a PieChart
    const chartData = [
        { name: 'Rutas Completadas', value: data },
        { name: 'Rutas Pendientes', value: 0 },
    ];

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Total de Rutas Completadas
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value) => value} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default TotalRoutesCompletedChart;
