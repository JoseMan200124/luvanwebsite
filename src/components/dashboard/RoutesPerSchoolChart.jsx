// frontend/src/components/dashboard/RoutesPerSchoolChart.jsx

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
    Cell
} from 'recharts';
import { Typography } from '@mui/material';
import api from '../../utils/axiosConfig';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const COLORS = ['#8884d8', '#82ca9d', '#FFBB28', '#FF8042', '#00C49F', '#0088FE'];

const RoutesPerSchoolChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchRoutesPerSchool = async () => {
            try {
                const response = await api.get('/reports/routes-per-school');
                setData(response.data.routesPerSchool);
            } catch (error) {
                console.error('Error fetching routes per school:', error);
            }
        };

        fetchRoutesPerSchool();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Rutas por Colegio
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="schoolName" />
                    <YAxis />
                    <Tooltip formatter={(value) => value} />
                    <Legend />
                    <Bar dataKey="routeCount" name="Rutas" fill="#8884d8">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default RoutesPerSchoolChart;
