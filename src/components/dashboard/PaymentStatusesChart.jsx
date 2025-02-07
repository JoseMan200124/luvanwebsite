// frontend/src/components/dashboard/PaymentStatusesChart.jsx

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
const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

const PaymentStatusesChart = ({ data }) => {
    // data = array con { status: 'PENDIENTE', count: 5 }, etc.

    // Si no hay datos, la gráfica quedará vacía. Podríamos mostrar un fallback
    // pero preferimos mostrar la gráfica vacía.
    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Estados de Pagos
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                    >
                        {data.map((entry, index) => (
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

export default PaymentStatusesChart;
