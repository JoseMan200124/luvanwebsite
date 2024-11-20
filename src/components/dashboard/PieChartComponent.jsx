// src/components/dashboard/PieChartComponent.jsx

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

const ChartContainer = tw.div`bg-white p-4 rounded-lg shadow-md`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const PieChartComponent = ({ filters }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        // Aquí deberías filtrar o cargar los datos según los filtros
        // Para este ejemplo, usamos datos estáticos
        const fetchData = () => {
            let filteredData = [
                { name: 'Pagos Completados', value: 3200 },
                { name: 'Pagos Pendientes', value: 800 },
                { name: 'Moras', value: 200 },
            ];

            // Puedes añadir lógica de filtrado aquí si es necesario

            setData(filteredData);
        };

        fetchData();
    }, [filters]);

    return (
        <ChartContainer>
            <Typography variant="h6" gutterBottom>
                Estado de Pagos
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
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default PieChartComponent;
