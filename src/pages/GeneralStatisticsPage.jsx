// src/pages/GeneralStatisticsPage.jsx

import React, { useState } from 'react';
import { Tab, Tabs, Typography } from '@mui/material';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import usePermissions from '../hooks/usePermissions';
import UsageStatisticsTab from '../components/generalStatistics/UsageStatisticsTab';
import RequestsStatisticsTab from '../components/generalStatistics/RequestsStatisticsTab';
import FamiliasActivasTab from '../components/generalStatistics/FamiliasActivasTab';

// Cada pestaña se muestra solo si el rol tiene su clave; la página entera exige 'estadisticas-generales'.
const TABS = [
    { value: 'uso', label: 'Uso', permission: 'reportes-uso', Component: UsageStatisticsTab },
    { value: 'solicitudes', label: 'Solicitudes', permission: 'estadisticas-solicitudes', Component: RequestsStatisticsTab },
    { value: 'familias-activas', label: 'Familias activas', permission: 'familias-activas-ver', Component: FamiliasActivasTab }
];

// Solo se monta la pestaña activa: PageRefreshProvider admite un único handler de refresco.
const GeneralStatisticsPage = () => {
    const { hasPermission } = usePermissions();
    const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
    const [tab, setTab] = useState(visibleTabs[0]?.value);

    const active = visibleTabs.find((t) => t.value === tab) || visibleTabs[0];

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.reportes}
                title="Estadísticas Generales"
                tabs={active && (
                    <Tabs value={active.value} onChange={(e, value) => setTab(value)}>
                        {visibleTabs.map((t) => (
                            <Tab key={t.value} value={t.value} label={t.label} sx={{ fontWeight: 600 }} />
                        ))}
                    </Tabs>
                )}
            />

            {active ? (
                <active.Component />
            ) : (
                <Typography color="textSecondary">No tienes acceso a ninguna estadística.</Typography>
            )}
        </PageContainer>
    );
};

export default GeneralStatisticsPage;
