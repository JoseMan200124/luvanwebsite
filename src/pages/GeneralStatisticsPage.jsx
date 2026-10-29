// src/pages/GeneralStatisticsPage.jsx

import React, { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import tw from 'twin.macro';
import usePermissions from '../hooks/usePermissions';
import UsageStatisticsTab from '../components/generalStatistics/UsageStatisticsTab';
import RequestsStatisticsTab from '../components/generalStatistics/RequestsStatisticsTab';

const PageContainer = tw.div`
  p-8 w-full bg-gray-100 flex flex-col min-h-screen
`;

// Cada pestaña se muestra solo si el rol tiene su clave; la página entera exige 'estadisticas-generales'.
const TABS = [
    { value: 'uso', label: 'Uso', permission: 'reportes-uso', Component: UsageStatisticsTab },
    { value: 'solicitudes', label: 'Solicitudes', permission: 'estadisticas-solicitudes', Component: RequestsStatisticsTab }
];

// Solo se monta la pestaña activa: PageRefreshProvider admite un único handler de refresco.
const GeneralStatisticsPage = () => {
    const { hasPermission } = usePermissions();
    const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
    const [tab, setTab] = useState(visibleTabs[0]?.value);

    const active = visibleTabs.find((t) => t.value === tab) || visibleTabs[0];

    return (
        <PageContainer>
            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1976D2', fontWeight: 700, mb: 0.5 }}>
                    Reportes
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 0.5 }}>
                    Estadísticas Generales
                </Typography>
            </Box>

            {active ? (
                <>
                    <Tabs value={active.value} onChange={(e, value) => setTab(value)} sx={{ mb: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                        {visibleTabs.map((t) => (
                            <Tab key={t.value} value={t.value} label={t.label} sx={{ fontWeight: 600 }} />
                        ))}
                    </Tabs>
                    <active.Component />
                </>
            ) : (
                <Typography color="textSecondary">No tienes acceso a ninguna estadística.</Typography>
            )}
        </PageContainer>
    );
};

export default GeneralStatisticsPage;
