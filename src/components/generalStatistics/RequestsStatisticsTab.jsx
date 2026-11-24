// src/components/generalStatistics/RequestsStatisticsTab.jsx
//
// Resumen global de solicitudes de usuarios: solo conteos (total, por estado, por prioridad y por tipo).
// Sin listado ni detalle; para gestionar solicitudes se entra al colegio o a la corporación.
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert
} from '@mui/material';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../../utils/cicloEscolarFilterParams';
import FilterBar from '../filters/FilterBar';
import useFilters from '../../hooks/useFilters';
import { F } from '../filters/filterFields';
import { getRequestStatistics, REQUEST_TYPE_META } from '../../services/requestService';
import { Assignment as AssignmentIcon, HourglassEmpty as HourglassEmptyIcon, Autorenew as AutorenewIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Flag as FlagIcon, Category as CategoryIcon } from '@mui/icons-material';
import { StatCard, StatCardGrid } from '../StatCard';

const PRIORITY_LABELS_ES = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };

const RequestsStatisticsTab = () => {
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Resumen global de Luvan: arranca en "Todos los ciclos", no en el ciclo seleccionado del menú.
    const pageFilters = useFilters({
        urlPrefix: 'req_',
        fields: [F.cycle({ initial: ALL_CYCLES_VALUE }), F.dateRange('dates')],
    });
    const { cycle: cicloEscolar, dates } = pageFilters.applied;

    const fetchStatistics = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { ...getCicloEscolarFilterParams(cicloEscolar) };
            if (dates.from) {
                params.startDate = dates.from;
            }
            if (dates.to) {
                params.endDate = dates.to;
            }
            setStatistics(await getRequestStatistics(params));
        } catch (err) {
            console.error('Error fetching statistics', err);
            setStatistics(null);
            setError('Error al obtener las estadísticas de solicitudes. Por favor, inténtalo de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    }, [cicloEscolar, dates.from, dates.to]);

    useEffect(() => { fetchStatistics(); }, [fetchStatistics]);

    useRegisterPageRefresh(fetchStatistics, [fetchStatistics]);

    const typeEntries = Object.entries(statistics?.typeCounts || {})
        .map(([key, count]) => ({ key, label: REQUEST_TYPE_META[key]?.label || key, count }))
        .sort((a, b) => b.count - a.count);

    return (
        <>
            <FilterBar {...pageFilters.barProps} loading={loading} />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading && !statistics ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : statistics && (
                <>
                    <Typography variant="h6" sx={{ mb: 1 }}>Por estado</Typography>
                    <StatCardGrid columns={{ md: 3, lg: 5 }} sx={{ mb: 1 }}>
                        <StatCard label="Total" value={statistics.totalRequests ?? 0} icon={<AssignmentIcon />} format="number" />
                        <StatCard label="Pendientes" value={statistics.pendingRequests ?? 0} icon={<HourglassEmptyIcon />} format="number" />
                        <StatCard label="En revisión" value={statistics.inReviewRequests ?? 0} icon={<AutorenewIcon />} format="number" />
                        <StatCard label="Completadas" value={statistics.approvedRequests ?? 0} icon={<CheckCircleIcon />} format="number" />
                        <StatCard label="Rechazadas" value={statistics.rejectedRequests ?? 0} icon={<CancelIcon />} format="number" />
                    </StatCardGrid>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 3 }}>
                        El total incluye las solicitudes canceladas. Las de corporaciones se cuentan siempre, sin importar el ciclo escolar elegido.
                    </Typography>

                    <Typography variant="h6" sx={{ mb: 1 }}>Por prioridad</Typography>
                    <StatCardGrid columns={4}>
                        {['urgent', 'high', 'medium', 'low'].map((p) => (
                            <StatCard key={p} label={PRIORITY_LABELS_ES[p]} value={statistics.priorityCounts?.[p] ?? 0} icon={<FlagIcon />} format="number" />
                        ))}
                    </StatCardGrid>

                    <Typography variant="h6" sx={{ mb: 1 }}>Por tipo</Typography>
                    <StatCardGrid columns={4} sx={{ mb: 0 }}>
                        {typeEntries.map(({ key, label, count }) => (
                            <StatCard key={key} label={label} value={count ?? 0} icon={<CategoryIcon />} format="number" />
                        ))}
                    </StatCardGrid>
                </>
            )}
        </>
    );
};

export default RequestsStatisticsTab;
