// src/pages/Dashboard.jsx

import React, { useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';

import StatsCard from '../components/dashboard/StatsCard';
import LineChartComponent from '../components/dashboard/LineChartComponent';
import BarChartComponent from '../components/dashboard/BarChartComponent';
import PieChartComponent from '../components/dashboard/PieChartComponent';
import Filters from '../components/dashboard/Filters';

const DashboardContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const Header = styled.div`
    ${tw`flex flex-col md:flex-row items-center justify-between mb-8`}
`;

const Title = tw.h1`text-3xl font-bold text-gray-800`;

const StatsGrid = tw.div`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`;

const ChartsGrid = tw.div`grid grid-cols-1 lg:grid-cols-2 gap-6`;

const Dashboard = () => {
    // State to handle filters
    const [filters, setFilters] = useState({
        colegio: '',
        ruta: '',
        mes: '',
        fechaInicio: '',
        fechaFin: '',
    });

    return (
        <DashboardContainer>
            <Header>
                <Title>Dashboard</Title>
                <Filters filters={filters} setFilters={setFilters} />
            </Header>
            <StatsGrid>
                <StatsCard
                    title="Usuarios Activos"
                    value={1500}
                    icon="Group"
                />
                <StatsCard
                    title="Pagos Completados"
                    value={3200}
                    icon="AttachMoney"
                />
                <StatsCard
                    title="Incidentes Reportados"
                    value={45}
                    icon="ReportProblem"
                />
                <StatsCard
                    title="Colegios Registrados"
                    value={75}
                    icon="School"
                />
            </StatsGrid>
            <ChartsGrid>
                <LineChartComponent filters={filters} />
                <BarChartComponent filters={filters} />
                <PieChartComponent filters={filters} />
            </ChartsGrid>
        </DashboardContainer>
    );
};

export default Dashboard;
