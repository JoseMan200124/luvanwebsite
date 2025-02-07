// frontend/src/components/dashboard/IncidentsPerPilotChart.jsx
import React, { useMemo } from 'react';
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

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const IncidentsPerPilotChart = ({ data }) => {
    // data = array de "incidents" con .piloto
    const chartData = useMemo(() => {
        const aggregator = {};
        (data || []).forEach((inc) => {
            const pilotName = inc?.piloto?.name || 'Desconocido';
            if (!aggregator[pilotName]) {
                aggregator[pilotName] = { pilotName, incidentCount: 0 };
            }
            aggregator[pilotName].incidentCount += 1;
        });
        return Object.values(aggregator);
    }, [data]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Incidentes por Piloto
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pilotName" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="incidentCount"
                        name="Incidentes"
                        stroke="#FF0000"
                        activeDot={{ r: 8 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default IncidentsPerPilotChart;
