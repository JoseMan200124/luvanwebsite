// src/components/financialStatistics/FuelStatisticsTab.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, InputLabel, ListItemText,
    ListSubheader, MenuItem, Select, Snackbar, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { Download } from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
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
    const initial = useMemo(() => computePresetRange(DEFAULT_PRESET, getCurrentDateSync()), []);
    const [preset, setPreset] = useState(DEFAULT_PRESET);
    const [fromMonth, setFromMonth] = useState(initial.fromMonth);
    const [toMonth, setToMonth] = useState(initial.toMonth);
    const [granularity, setGranularity] = useState(initial.granularity);
    const [selectedClients, setSelectedClients] = useState([]);
    const [selectedFuelTypes, setSelectedFuelTypes] = useState([]);
    const [selectedReasons, setSelectedReasons] = useState([]);
    const [clientOptions, setClientOptions] = useState({ schools: [], corporations: [], hasUnassigned: false });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const applyPreset = (key) => {
        const range = computePresetRange(key, getCurrentDateSync());
        if (!range) return;
        setPreset(key);
        setFromMonth(range.fromMonth);
        setToMonth(range.toMonth);
        setGranularity(range.granularity);
    };

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { from, to } = monthRangeToDates(fromMonth, toMonth, getCurrentDateSync());
            const data = await getFuelFinancialStatistics({
                from,
                to,
                granularity,
                clients: buildClientsParam(selectedClients),
                fuelTypes: buildListParam(selectedFuelTypes),
                fuelingReasons: buildListParam(selectedReasons)
            });
            setResult(data);
        } catch (e) {
            console.error('fetchStats error', e);
            setError(e?.response?.data?.error || 'Error al obtener las estadísticas de combustible. Por favor, inténtalo de nuevo más tarde.');
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, [fromMonth, toMonth, granularity, selectedClients, selectedFuelTypes, selectedReasons]);

    useEffect(() => {
        getFuelClients()
            .then((data) => setClientOptions({ schools: data?.schools || [], corporations: data?.corporations || [], hasUnassigned: !!data?.hasUnassigned }))
            .catch((e) => console.error('getFuelClients error', e));
    }, []);

    useEffect(() => {
        fetchStats();
    }, []);

    useRegisterPageRefresh(async () => {
        await fetchStats();
    }, [fetchStats]);

    // Colegios agrupados por ciclo (cada ciclo tiene su propia fila School).
    const schoolGroups = useMemo(() => {
        const map = new Map();
        for (const s of clientOptions.schools) {
            const year = s.cicloEscolarAnio || 0;
            if (!map.has(year)) map.set(year, []);
            map.get(year).push(s);
        }
        return [...map.entries()].sort(([a], [b]) => b - a);
    }, [clientOptions.schools]);

    const clientName = useCallback((value) => {
        if (value === 'none') return 'Sin cliente asignado';
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
        if (!isAllSelected(selectedFuelTypes)) parts.push(selectedFuelTypes.map(fuelTypeLabel).join(', '));
        if (!isAllSelected(selectedReasons)) parts.push(selectedReasons.map(reasonItemLabel).join(', '));
        return parts.join(' · ');
    }, [selectedClients, selectedFuelTypes, selectedReasons, clientName]);

    const rangeLabel = result
        ? `${moment(result.from).format('DD/MM/YYYY')} — ${moment(result.to).format('DD/MM/YYYY')}`
        : '';

    // Mismo comportamiento que el selector de colegios de Ingresos: elegir "Todos" limpia lo demás.
    const multiSelectProps = (value, setter, allLabel, renderItem) => ({
        multiple: true,
        value,
        onChange: (e) => {
            const next = e.target.value;
            setter(next.includes(ALL_OPTION) ? [ALL_OPTION] : next);
        },
        renderValue: (selected) => (isAllSelected(selected) ? allLabel : selected.map(renderItem).join(', ')),
        sx: { bgcolor: '#fff', borderRadius: 1 }
    });

    const allMenuItem = (selected, label) => (
        <MenuItem value={ALL_OPTION}>
            <Checkbox checked={selected.includes(ALL_OPTION)} size="small" />
            <ListItemText primary={label} />
        </MenuItem>
    );

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

            {/* Atajos de fecha */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {DATE_PRESETS.map((p) => (
                    <Chip
                        key={p.key}
                        label={p.label}
                        size="small"
                        clickable
                        color={preset === p.key ? 'primary' : 'default'}
                        variant={preset === p.key ? 'filled' : 'outlined'}
                        onClick={() => applyPreset(p.key)}
                    />
                ))}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', mb: 3 }}>
                <FormControl size="small" sx={{ width: 280 }}>
                    <InputLabel id="fuel-client-label">Cliente</InputLabel>
                    <Select labelId="fuel-client-label" label="Cliente" {...multiSelectProps(selectedClients, setSelectedClients, 'Todos los clientes', clientName)}>
                        {allMenuItem(selectedClients, 'Todos los clientes')}
                        {schoolGroups.map(([year, schools]) => [
                            <ListSubheader key={`h-${year}`} sx={{ fontWeight: 700, color: '#1976d2', lineHeight: '32px' }}>
                                {year ? `Colegios · Ciclo ${year}` : 'Colegios'}
                            </ListSubheader>,
                            ...schools.map((s) => (
                                <MenuItem key={`school:${s.id}`} value={`school:${s.id}`} sx={{ pl: 4 }}>
                                    <Checkbox size="small" checked={selectedClients.includes(`school:${s.id}`)} />
                                    <ListItemText primary={s.name} />
                                </MenuItem>
                            ))
                        ])}
                        {clientOptions.corporations.length > 0 && (
                            <ListSubheader sx={{ fontWeight: 700, color: '#1976d2', lineHeight: '32px' }}>Corporaciones</ListSubheader>
                        )}
                        {clientOptions.corporations.map((c) => (
                            <MenuItem key={`corp:${c.id}`} value={`corp:${c.id}`} sx={{ pl: 4 }}>
                                <Checkbox size="small" checked={selectedClients.includes(`corp:${c.id}`)} />
                                <ListItemText primary={c.name} />
                            </MenuItem>
                        ))}
                        {clientOptions.hasUnassigned && (
                            <ListSubheader sx={{ fontWeight: 700, color: '#1976d2', lineHeight: '32px' }}>Otros</ListSubheader>
                        )}
                        {clientOptions.hasUnassigned && (
                            <MenuItem value="none" sx={{ pl: 4 }}>
                                <Checkbox size="small" checked={selectedClients.includes('none')} />
                                <ListItemText primary="Sin cliente asignado" />
                            </MenuItem>
                        )}
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    type="month"
                    label="Desde"
                    value={fromMonth}
                    onChange={(e) => { setFromMonth(e.target.value); setPreset(null); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 150, bgcolor: '#fff', borderRadius: 1 }}
                />
                <TextField
                    size="small"
                    type="month"
                    label="Hasta"
                    value={toMonth}
                    onChange={(e) => { setToMonth(e.target.value); setPreset(null); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 150, bgcolor: '#fff', borderRadius: 1 }}
                />

                <FormControl size="small" sx={{ width: 200 }}>
                    <InputLabel id="fuel-type-label">Tipo de combustible</InputLabel>
                    <Select
                        labelId="fuel-type-label" label="Tipo de combustible"
                        {...multiSelectProps(selectedFuelTypes, setSelectedFuelTypes, 'Todos los tipos', fuelTypeLabel)}
                    >
                        {allMenuItem(selectedFuelTypes, 'Todos los tipos')}
                        {FUEL_TYPES.map((t) => (
                            <MenuItem key={t.key} value={t.key}>
                                <Checkbox size="small" checked={selectedFuelTypes.includes(t.key)} />
                                <ListItemText primary={t.label} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ width: 200 }}>
                    <InputLabel id="fuel-reason-label">Razón</InputLabel>
                    <Select
                        labelId="fuel-reason-label" label="Razón"
                        {...multiSelectProps(selectedReasons, setSelectedReasons, 'Todas las razones', reasonItemLabel)}
                    >
                        {allMenuItem(selectedReasons, 'Todas las razones')}
                        {FUELING_REASONS.map((r) => (
                            <MenuItem key={r.key} value={r.key}>
                                <Checkbox size="small" checked={selectedReasons.includes(r.key)} />
                                <ListItemText primary={r.label} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">Agrupar por</Typography>
                    <ToggleButtonGroup size="small" exclusive value={granularity} onChange={(e, v) => { if (v) setGranularity(v); }}>
                        {GRANULARITIES.map((g) => <ToggleButton key={g.key} value={g.key}>{g.label}</ToggleButton>)}
                    </ToggleButtonGroup>
                </Box>

                <Button variant="contained" color="primary" onClick={fetchStats} disabled={loading} sx={{ borderRadius: 1, fontWeight: 600, height: 40 }}>
                    {loading ? 'Aplicando…' : 'Aplicar filtros'}
                </Button>
            </Box>

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
