// src/pages/FinancialStatisticsPage.jsx

import React, { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import tw from 'twin.macro';
import IncomeStatisticsTab from '../components/financialStatistics/IncomeStatisticsTab';
import FuelStatisticsTab from '../components/financialStatistics/FuelStatisticsTab';

const PageContainer = tw.div`
  p-8 w-full bg-gray-100 flex flex-col min-h-screen
`;

// Solo se monta la pestaña activa: PageRefreshProvider admite un único handler de refresco.
const FinancialStatisticsPage = () => {
    const [tab, setTab] = useState('ingresos');

    return (
        <PageContainer>
            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1976D2', fontWeight: 700, mb: 0.5 }}>
                    Finanzas · Reporte
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 0.5 }}>
                    Estadísticas Financieras
                </Typography>
            </Box>

            <Tabs value={tab} onChange={(e, value) => setTab(value)} sx={{ mb: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <Tab value="ingresos" label="Ingresos" sx={{ fontWeight: 600 }} />
                <Tab value="combustible" label="Combustible" sx={{ fontWeight: 600 }} />
            </Tabs>

            {tab === 'ingresos' ? <IncomeStatisticsTab /> : <FuelStatisticsTab />}
        </PageContainer>
    );
};

export default FinancialStatisticsPage;
