// src/components/generalStatistics/RequestsStatisticsTab.jsx
//
// Resumen global de solicitudes de usuarios: solo conteos (total, por estado, por prioridad y por tipo).
// Sin listado ni detalle; para gestionar solicitudes se entra al colegio o a la corporación.
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CircularProgress,
    Alert
} from '@mui/material';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
import { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../../utils/cicloEscolarFilterParams';
import FilterBar from '../filters/FilterBar';
import useFilters from '../../hooks/useFilters';
import { F } from '../filters/filterFields';
import { getRequestStatistics, REQUEST_TYPE_META } from '../../services/requestService';

const PRIORITY_LABELS_ES = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };

const CountCard = ({ label, value }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Typography color="textSecondary" gutterBottom>{label}</Typography>
            <Typography variant="h4">{value ?? 0}</Typography>
        </CardContent>
    </Card>
);

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
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={2.4}><CountCard label="Total" value={statistics.totalRequests} /></Grid>
                        <Grid item xs={12} sm={6} md={2.4}><CountCard label="Pendientes" value={statistics.pendingRequests} /></Grid>
                        <Grid item xs={12} sm={6} md={2.4}><CountCard label="En revisión" value={statistics.inReviewRequests} /></Grid>
                        <Grid item xs={12} sm={6} md={2.4}><CountCard label="Completadas" value={statistics.approvedRequests} /></Grid>
                        <Grid item xs={12} sm={6} md={2.4}><CountCard label="Rechazadas" value={statistics.rejectedRequests} /></Grid>
                    </Grid>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 3 }}>
                        El total incluye las solicitudes canceladas. Las de corporaciones se cuentan siempre, sin importar el ciclo escolar elegido.
                    </Typography>

                    <Typography variant="h6" sx={{ mb: 1 }}>Por prioridad</Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {['urgent', 'high', 'medium', 'low'].map((p) => (
                            <Grid item xs={6} md={3} key={p}>
                                <CountCard label={PRIORITY_LABELS_ES[p]} value={statistics.priorityCounts?.[p]} />
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="h6" sx={{ mb: 1 }}>Por tipo</Typography>
                    <Grid container spacing={2}>
                        {typeEntries.map(({ key, label, count }) => (
                            <Grid item xs={6} md={3} key={key}>
                                <CountCard label={label} value={count} />
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}
        </>
    );
};

export default RequestsStatisticsTab;
