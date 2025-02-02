// frontend/src/components/dashboard/MonthlyRevenueChart.jsx

import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Typography } from '@mui/material';
import api from '../../utils/axiosConfig';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const MonthlyRevenueChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchMonthlyRevenue = async () => {
            try {
                const response = await api.get('/reports/monthly-revenue');
                setData(response.data.revenue);
            } catch (error) {
                console.error('Error fetching monthly revenue:', error);
            }
        };

        fetchMonthlyRevenue();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Ingresos Mensuales (USD)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="amount" name="Ingresos" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default MonthlyRevenueChart;
