// frontend/src/components/dashboard/PaymentStatusesChart.jsx

import React, { useEffect, useState } from 'react';
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
import api from '../../utils/axiosConfig';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const PaymentStatusesChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchPaymentStatuses = async () => {
            try {
                const response = await api.get('/reports/payment-statuses');
                setData(response.data.paymentStatuses);
            } catch (error) {
                console.error('Error fetching payment statuses:', error);
            }
        };

        fetchPaymentStatuses();
    }, [filters]);

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
                        fill="#8884d8"
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
