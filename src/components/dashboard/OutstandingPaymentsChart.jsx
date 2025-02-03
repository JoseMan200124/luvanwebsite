// frontend/src/components/dashboard/OutstandingPaymentsChart.jsx

import React, { useEffect, useState } from 'react';
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
import api from '../../utils/axiosConfig';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const OutstandingPaymentsChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchOutstandingPayments = async () => {
            try {
                const response = await api.get('/reports/outstanding-payments');
                setData(response.data.outstandingPayments);
            } catch (error) {
                console.error('Error fetching outstanding payments:', error);
            }
        };

        fetchOutstandingPayments();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Pagos Pendientes (Quetzales) - Últimos 6 Meses
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
