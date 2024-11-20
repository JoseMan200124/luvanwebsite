// src/components/dashboard/LineChartComponent.jsx

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
} from 'recharts';
import { Typography } from '@mui/material';

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const LineChartComponent = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        // Aquí deberías filtrar o cargar los datos según los filtros
        // Para este ejemplo, usamos datos estáticos
        const fetchData = () => {
            let filteredData = [
                { month: 'Ene', usuarios: 400 },
                { month: 'Feb', usuarios: 300 },
                { month: 'Mar', usuarios: 500 },
                { month: 'Abr', usuarios: 700 },
                { month: 'May', usuarios: 600 },
                { month: 'Jun', usuarios: 800 },
                { month: 'Jul', usuarios: 750 },
                { month: 'Ago', usuarios: 900 },
                { month: 'Sep', usuarios: 850 },
                { month: 'Oct', usuarios: 1000 },
                { month: 'Nov', usuarios: 950 },
                { month: 'Dic', usuarios: 1100 },
            ];

            // Aplicar filtros si es necesario
            // Por ejemplo, filtrar por mes
            if (filters.mes) {
                filteredData = filteredData.filter((item) => item.month === filters.mes);
            }

            // Puedes añadir más lógica de filtrado aquí según los filtros disponibles

            setData(filteredData);
        };

        fetchData();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Usuarios Activos por Mes
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line
                        type="monotone"
                        dataKey="usuarios"
                        stroke="#8884d8"
                        activeDot={{ r: 8 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default LineChartComponent;
