// src/pages/FinancialStatisticsPage.jsx

import React, { useState } from 'react';
import { Tab, Tabs } from '@mui/material';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { MODULE_GROUPS } from '../components/layout/moduleGroups';
import IncomeStatisticsTab from '../components/financialStatistics/IncomeStatisticsTab';
import FuelStatisticsTab from '../components/financialStatistics/FuelStatisticsTab';

// Solo se monta la pestaña activa: PageRefreshProvider admite un único handler de refresco.
const FinancialStatisticsPage = () => {
    const [tab, setTab] = useState('ingresos');

    return (
        <PageContainer width="xl">
            <PageHeader
                eyebrow={MODULE_GROUPS.reportes}
                title="Estadísticas Financieras"
                tabs={(
                    <Tabs value={tab} onChange={(e, value) => setTab(value)}>
                        <Tab value="ingresos" label="Ingresos" sx={{ fontWeight: 600 }} />
                        <Tab value="combustible" label="Combustible" sx={{ fontWeight: 600 }} />
                    </Tabs>
                )}
            />

            {tab === 'ingresos' ? <IncomeStatisticsTab /> : <FuelStatisticsTab />}
        </PageContainer>
    );
};

export default FinancialStatisticsPage;
