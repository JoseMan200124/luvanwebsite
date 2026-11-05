// src/components/generalStatistics/RequestsStatisticsTab.jsx
//
// Resumen global de solicitudes de usuarios: solo conteos (total, por estado, por prioridad y por tipo).
// Sin listado ni detalle; para gestionar solicitudes se entra al colegio o a la corporación.
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    CircularProgress,
    Alert
} from '@mui/material';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
import CicloEscolarFilter, { ALL_CYCLES_VALUE, getCicloEscolarFilterParams } from '../CicloEscolarFilter';
import { getRequestStatistics, REQUEST_TYPE_META } from '../../services/requestService';

const PRIORITY_LABELS_ES = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };

const initialDates = { startDate: '', endDate: '' };

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
    const [cicloEscolar, setCicloEscolar] = useState(ALL_CYCLES_VALUE);
    const [draftDates, setDraftDates] = useState(initialDates);
    const [dates, setDates] = useState(initialDates);

    const fetchStatistics = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { ...getCicloEscolarFilterParams(cicloEscolar) };
            if (dates.startDate) {
                params.startDate = dates.startDate;
            }
            if (dates.endDate) {
                params.endDate = dates.endDate;
            }
            setStatistics(await getRequestStatistics(params));
        } catch (err) {
            console.error('Error fetching statistics', err);
            setStatistics(null);
            setError('Error al obtener las estadísticas de solicitudes. Por favor, inténtalo de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    }, [cicloEscolar, dates.startDate, dates.endDate]);

    useEffect(() => { fetchStatistics(); }, [fetchStatistics]);

    useRegisterPageRefresh(fetchStatistics, [fetchStatistics]);

    const typeEntries = Object.entries(statistics?.typeCounts || {})
        .map(([key, count]) => ({ key, label: REQUEST_TYPE_META[key]?.label || key, count }))
        .sort((a, b) => b.count - a.count);

    return (
        <>
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs="auto">
                        <CicloEscolarFilter value={cicloEscolar} onChange={setCicloEscolar} sx={{ width: 190 }} />
                    </Grid>
                    <Grid item xs="auto">
                        <TextField sx={{ width: 150 }} size="small" type="date" label="Fecha Inicio" value={draftDates.startDate}
                            onChange={(e) => setDraftDates((prev) => ({ ...prev, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs="auto">
                        <TextField sx={{ width: 150 }} size="small" type="date" label="Fecha Fin" value={draftDates.endDate}
                            onChange={(e) => setDraftDates((prev) => ({ ...prev, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs="auto" sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => { setDraftDates(initialDates); setDates(initialDates); }}>Limpiar filtros</Button>
                        <Button size="small" variant="contained" onClick={() => setDates(draftDates)}>Buscar</Button>
                    </Grid>
                </Grid>
            </Paper>

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
