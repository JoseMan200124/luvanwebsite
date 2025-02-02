// frontend/src/components/dashboard/IncidentsPerPilotChart.jsx

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

const IncidentsPerPilotChart = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchIncidentsPerPilot = async () => {
            try {
                const response = await api.get('/reports/incidents-per-pilot');
                setData(response.data.incidentsPerPilot);
            } catch (error) {
                console.error('Error fetching incidents per pilot:', error);
            }
        };

        fetchIncidentsPerPilot();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Incidentes por Piloto
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pilotName" />
                    <YAxis />
                    <Tooltip formatter={(value) => value} />
                    <Legend />
                    <Line type="monotone" dataKey="incidentCount" name="Incidentes" stroke="#FF0000" activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default IncidentsPerPilotChart;
