// src/components/dashboard/BarChartComponent.jsx

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
} from 'recharts';
import { Typography } from '@mui/material';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const BarChartComponent = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        // Aquí deberías filtrar o cargar los datos según los filtros
        // Para este ejemplo, usamos datos estáticos
        const fetchData = () => {
            let filteredData = [
                { colegio: 'Colegio A', rutas: 10 },
                { colegio: 'Colegio B', rutas: 15 },
                { colegio: 'Colegio C', rutas: 8 },
                { colegio: 'Colegio D', rutas: 20 },
                { colegio: 'Colegio E', rutas: 12 },
            ];

            // Aplicar filtros si es necesario
            if (filters.colegio) {
                filteredData = filteredData.filter(
                    (item) => item.colegio === filters.colegio
                );
            }

            // Puedes añadir más lógica de filtrado aquí según los filtros disponibles

            setData(filteredData);
        };

        fetchData();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Rutas por Colegio
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="colegio" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="rutas" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default BarChartComponent;
