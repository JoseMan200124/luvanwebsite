// src/components/financialStatistics/FuelStatisticsTab.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
import FilterBar from '../filters/FilterBar';
import useFilters from '../../hooks/useFilters';
import { F } from '../filters/filterFields';
import { getCurrentDateSync } from '../../hooks/useCurrentDate';
import { getFuelFinancialStatistics, getFuelClients } from '../../services/fuelStatisticsService';
import {
    ALL_OPTION, FUEL_TYPES, FUELING_REASONS, GRANULARITIES, DATE_PRESETS, computePresetRange, monthRangeToDates,
    buildClientsParam, buildListParam, formatMoney, formatGallons, typesWithData
} from './fuelStatsUtils';
import FuelCharts from './FuelCharts';
import FuelBreakdownTables from './FuelBreakdownTables';
import { generateFuelStatsPdf } from './fuelStatsPdf';

const DEFAULT_PRESET = 'last6Months';

const fuelTypeLabel = (k) => FUEL_TYPES.find((t) => t.key === k)?.label || k;
const reasonItemLabel = (k) => FUELING_REASONS.find((r) => r.key === k)?.label || k;
const isAllSelected = (selected) => selected.length === 0 || selected.includes(ALL_OPTION);
const cardSx = { bgcolor: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 1, p: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };

const KpiCard = ({ label, value, sub, color = '#111827' }) => (
    <Box sx={cardSx}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600, mb: 0.75 }}>
            {label}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 26, color }}>{value}</Typography>
        {sub ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sub}</Typography> : null}
    </Box>
);

const FuelStatisticsTab = () => {
    const [clientOptions, setClientOptions] = useState({ schools: [], corporations: [], hasUnassigned: false });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Recibe los filtros aplicados. Listas vacías = todos.
    const fetchStats = useCallback(async (values) => {
        setLoading(true);
        setError(null);
        try {
            const { from, to } = monthRangeToDates(values.months.from, values.months.to, getCurrentDateSync());
            const data = await getFuelFinancialStatistics({
                from,
                to,
                granularity: values.granularity,
                clients: buildClientsParam(values.clients),
                fuelTypes: buildListParam(values.fuelTypes),
                fuelingReasons: buildListParam(values.reasons)
            });
            setResult(data);
        } catch (e) {
            console.error('fetchStats error', e);
            setError(e?.response?.data?.error || 'Error al obtener las estadísticas de combustible. Por favor, inténtalo de nuevo más tarde.');
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        getFuelClients()
            .then((data) => setClientOptions({ schools: data?.schools || [], corporations: data?.corporations || [], hasUnassigned: !!data?.hasUnassigned }))
            .catch((e) => console.error('getFuelClients error', e));
    }, []);

    // Colegios agrupados por ciclo (cada ciclo tiene su propia fila School).
    const schoolGroups = useMemo(() => {
        const map = new Map();
        for (const s of clientOptions.schools) {
            const year = s.cicloEscolarAnio || 0;
            if (!map.has(year)) {
                map.set(year, []);
            }
            map.get(year).push(s);
        }
        return [...map.entries()].sort(([a], [b]) => b - a);
    }, [clientOptions.schools]);

    const fuelClientOptions = [
        ...schoolGroups.flatMap(([year, schools]) => schools.map((s) => ({
            value: `school:${s.id}`,
            label: s.name,
            group: year ? `Colegios · Ciclo ${year}` : 'Colegios',
        }))),
        ...clientOptions.corporations.map((c) => ({ value: `corp:${c.id}`, label: c.name, group: 'Corporaciones' })),
        ...(clientOptions.hasUnassigned ? [{ value: 'none', label: 'Sin cliente asignado', group: 'Otros' }] : []),
    ];

    // Filtros: por defecto los últimos 6 meses agrupados por mes. Los atajos ajustan rango y agrupación.
    const defaultRange = () => computePresetRange(DEFAULT_PRESET, getCurrentDateSync());
    const pageFilters = useFilters({
        urlPrefix: 'fuel_',
        fields: [
            F.multiSelect('clients', { label: 'Cliente', width: 'lg', allLabel: 'Todos los clientes', options: fuelClientOptions }),
            F.monthRange('months', { initial: () => ({ from: defaultRange().fromMonth, to: defaultRange().toMonth }) }),
            F.multiSelect('fuelTypes', {
                label: 'Tipo de combustible',
                allLabel: 'Todos los tipos',
                options: FUEL_TYPES.map((type) => ({ value: type.key, label: type.label })),
            }),
            F.multiSelect('reasons', {
                label: 'Razón',
                allLabel: 'Todas las razones',
                options: FUELING_REASONS.map((reason) => ({ value: reason.key, label: reason.label })),
            }),
            F.toggle('granularity', {
                label: 'Agrupar por',
                initial: () => defaultRange().granularity,
                options: GRANULARITIES.map((g) => ({ value: g.key, label: g.label })),
            }),
        ],
        presets: DATE_PRESETS.map((preset) => ({
            key: preset.key,
            label: preset.label,
            values: () => {
                const range = computePresetRange(preset.key, getCurrentDateSync());
                return { months: { from: range.fromMonth, to: range.toMonth }, granularity: range.granularity };
            },
        })),
    });
    const fuelApplied = pageFilters.applied;
    const {
        clients: selectedClients,
        fuelTypes: selectedFuelTypes,
        reasons: selectedReasons,
    } = fuelApplied;

    useEffect(() => {
        fetchStats(fuelApplied);
    }, [fetchStats, fuelApplied]);

    useRegisterPageRefresh(async () => {
        await fetchStats(fuelApplied);
    }, [fetchStats, fuelApplied]);

    const clientName = useCallback((value) => {
        if (value === 'none') {
            return 'Sin cliente asignado';
        }
        const [type, rawId] = value.split(':');
        const id = Number(rawId);
        if (type === 'school') {
            const s = clientOptions.schools.find((x) => x.id === id);
            return s ? `${s.name}${s.cicloEscolarAnio ? ` (${s.cicloEscolarAnio})` : ''}` : value;
        }
        return clientOptions.corporations.find((x) => x.id === id)?.name || value;
    }, [clientOptions]);

    const visibleTypes = useMemo(() => (result ? typesWithData(result.totals.byType) : []), [result]);

    const filtersLabel = useMemo(() => {
        const parts = [];
        parts.push(isAllSelected(selectedClients) ? 'Todos los clientes' : selectedClients.map(clientName).join(', '));
        if (!isAllSelected(selectedFuelTypes)) {
            parts.push(selectedFuelTypes.map(fuelTypeLabel).join(', '));
        }
        if (!isAllSelected(selectedReasons)) {
            parts.push(selectedReasons.map(reasonItemLabel).join(', '));
        }
        return parts.join(' · ');
    }, [selectedClients, selectedFuelTypes, selectedReasons, clientName]);

    const rangeLabel = result
        ? `${moment(result.from).format('DD/MM/YYYY')} — ${moment(result.to).format('DD/MM/YYYY')}`
        : '';

    return (
        <>
            {/* Acciones */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={() => generateFuelStatsPdf(result, { visibleTypes, filtersLabel, rangeLabel })}
                    disabled={loading || !result}
                    sx={{ borderRadius: 1, fontWeight: 600 }}
                >
                    Exportar PDF
                </Button>
            </Box>

            <FilterBar {...pageFilters.barProps} loading={loading} />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
                    <CircularProgress />
                </Box>
            ) : result ? (
                <Box sx={{ backgroundColor: '#fff', p: 2, overflowX: 'auto' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{rangeLabel}</Typography>

                    {/* Tarjetas de resumen */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, mb: 2 }}>
                        <KpiCard label="Gasto total" value={formatMoney(result.totals.amount)} color="#E65100" />
                        <KpiCard label="Galones" value={formatGallons(result.totals.gallons)} color="#1976D2" />
                        <KpiCard label="Registros" value={String(result.totals.records)} />
                    </Box>

                    {/* Precio ponderado por tipo de combustible */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, mb: 3 }}>
                        {visibleTypes.length === 0 ? (
                            <Box sx={{ ...cardSx, color: 'text.secondary', fontSize: 13 }}>Sin cargas de combustible en el rango seleccionado.</Box>
                        ) : visibleTypes.map((t) => (
                            <KpiCard
                                key={t.key}
                                label={`Precio/galón · ${t.label}`}
                                value={formatMoney(result.totals.byType[t.key].price)}
                                sub={`${formatGallons(result.totals.byType[t.key].gallons)}`}
                                color={t.color}
                            />
                        ))}
                    </Box>

                    <FuelCharts series={result.series} visibleTypes={visibleTypes} />
                    <FuelBreakdownTables result={result} visibleTypes={visibleTypes} />
                </Box>
            ) : null}

            <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(null)}>
                <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>{error}</Alert>
            </Snackbar>
        </>
    );
};

export default FuelStatisticsTab;
