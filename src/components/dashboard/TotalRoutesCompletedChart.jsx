// frontend/src/components/dashboard/TotalRoutesCompletedChart.jsx

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

const COLORS = ['#0088FE', '#00C49F'];

const TotalRoutesCompletedChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchTotalRoutesCompleted = async () => {
            try {
                const response = await api.get('/reports/total-routes-completed');
                setData([
                    { name: 'Rutas Completadas', value: response.data.totalRoutesCompleted },
                    { name: 'Rutas Pendientes', value: 0 } // Puedes ajustar este valor si tienes datos
                ]);
            } catch (error) {
                console.error('Error fetching total routes completed:', error);
            }
        };

        fetchTotalRoutesCompleted();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Total de Rutas Completadas
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
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

export default TotalRoutesCompletedChart;
