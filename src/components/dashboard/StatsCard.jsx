// src/components/dashboard/StatsCard.jsx

import React from 'react';
import tw, { styled } from 'twin.macro';
import {
    Group,
    AttachMoney,
    ReportProblem,
    School,
    Notifications,
} from '@mui/icons-material';

// Mapeo de iconos
const iconMap = {
    Group: <Group fontSize="large" />,
    AttachMoney: <AttachMoney fontSize="large" />,
    ReportProblem: <ReportProblem fontSize="large" />,
    School: <School fontSize="large" />,
    Notifications: <Notifications fontSize="large" />,
    // Añade más iconos según tus necesidades
};

// Mapeo de colores de fondo según el título de la tarjeta
const bgColorMap = {
    'Usuarios Activos': tw`bg-blue-500`,
    'Pagos Completados': tw`bg-green-500`,
    'Incidentes Reportados': tw`bg-red-500`,
    'Colegios Registrados': tw`bg-yellow-500`,
    // Añade más mapeos si es necesario
};

// Contenedor de la tarjeta con estilos de Tailwind
const CardContainer = styled.div(({ bgColor }) => [
    tw`flex items-center p-6 rounded-lg shadow-md text-white`,
    bgColor,
]);

const IconContainer = tw.div`p-3 bg-white bg-opacity-20 rounded-full mr-4 flex items-center justify-center`;

const Content = tw.div`flex flex-col`;

const Title = tw.span`text-lg font-semibold`;
const Value = tw.span`text-2xl font-bold`;

// Componente StatsCard
const StatsCard = ({ title, value, icon }) => {
    return (
        <CardContainer bgColor={bgColorMap[title] || tw`bg-blue-500`}>
            <IconContainer>{iconMap[icon]}</IconContainer>
            <Content>
                <Title>{title}</Title>
                <Value>{value}</Value>
            </Content>
        </CardContainer>
    );
};

export default StatsCard;
