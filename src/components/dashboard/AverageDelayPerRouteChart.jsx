// frontend/src/components/dashboard/AverageDelayPerRouteChart.jsx

import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import { Typography } from '@mui/material';
import { CircularProgress } from '@mui/material';
import api from '../../utils/axiosConfig';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md flex flex-col items-center justify-center`;

const AverageDelayPerRouteChart = ({ filters }) => {
    const [averageDelay, setAverageDelay] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAverageDelay = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get('/reports/average-delay-per-route');
                setAverageDelay(response.data.averageDelayPerRoute);
            } catch (err) {
                console.error('Error fetching average delay:', err);
                setError('Error al obtener el promedio de retraso.');
            } finally {
                setLoading(false);
            }
        };

        fetchAverageDelay();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Promedio de Retraso por Ruta (min)
            </Typography>
            {loading ? (
                <CircularProgress />
            ) : error ? (
                <Typography color="error">{error}</Typography>
            ) : (
                <Typography variant="h4" tw="font-bold">
                    {averageDelay} minutos
                </Typography>
            )}
        </ChartContainer>
    );
};

export default AverageDelayPerRouteChart;
