// frontend/src/components/dashboard/OnTimeRoutesPerPilotChart.jsx

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

const OnTimeRoutesPerPilotChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchOnTimeRoutesPerPilot = async () => {
            try {
                const response = await api.get('/reports/on-time-routes-per-pilot');
                setData(response.data.onTimeRoutesPerPilot);
            } catch (error) {
                console.error('Error fetching on-time routes per pilot:', error);
            }
        };

        fetchOnTimeRoutesPerPilot();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Rutas Puntuales por Piloto (%)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pilotName" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="onTimePercentage" name="Rutas Puntuales (%)" fill="#FFBB28" />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default OnTimeRoutesPerPilotChart;
