// frontend/src/components/dashboard/OutstandingPaymentsChart.jsx

import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
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
import { Typography } from '@mui/material';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const OutstandingPaymentsChart = ({ data }) => {
    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Pagos Pendientes (Quetzales)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `Q${value.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="amount" name="Pagos Pendientes" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default OutstandingPaymentsChart;
