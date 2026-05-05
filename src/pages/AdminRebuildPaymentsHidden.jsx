import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, TextField, Switch, FormControlLabel,
    Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, CircularProgress,
    Alert, Snackbar, MenuItem
} from '@mui/material';
import api from '../utils/axiosConfig';
import RebuildPaymentModal from '../components/modals/RebuildPaymentModal';

const SEV_COLOR = { high: 'error', medium: 'warning', low: 'info' };
const TARIFF_OVERRIDE_MODE_LABELS = {
    SET: 'Fijar',
    INCREMENT: 'Aumentar',
    DECREMENT: 'Disminuir'
};

const ROUTE_TYPE_LABELS = {
    ALL: 'Todos',
    COMPLETA: 'Completa',
    MEDIA_AM: 'Media AM',
    MEDIA_PM: 'Media PM'
};

function parsePeriodsInput(value) {
    return [...new Set(String(value || '').split(/[\s,;]+/).map(p => p.trim()).filter(Boolean))];
}

function tariffOverrideLabel(key, override) {
    const [period, routeType] = key.includes('|') ? key.split('|', 2) : [key, 'ALL'];
    const modeLabel = TARIFF_OVERRIDE_MODE_LABELS[override?.mode] || 'Fijar';
    const rtLabel = ROUTE_TYPE_LABELS[routeType] || routeType;
    return `${period} [${rtLabel}]: ${modeLabel} Q${Number(override?.valuePerStudent || 0).toFixed(2)} por alumno`;
}

export default function AdminRebuildPaymentsHidden() {
    const [filters, setFilters] = useState({
        schoolId: '', paymentId: '', cicloEscolarId: '', onlyActive: false, noPenalty: false
    });
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
    const [tariffOverrides, setTariffOverrides] = useState({});
    const [tariffOverrideForm, setTariffOverrideForm] = useState({ periods: '', mode: 'SET', routeType: 'ALL', valuePerStudent: '' });

    const handleChange = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
    const handleTariffOverrideFormChange = (k, v) => setTariffOverrideForm(prev => ({ ...prev, [k]: v }));

    const buildSimulateBody = () => {
        const body = {};
        if (filters.schoolId)  body.schoolId  = Number.parseInt(filters.schoolId, 10);
        if (filters.paymentId) body.paymentId = Number.parseInt(filters.paymentId, 10);
        if (filters.cicloEscolarId) body.cicloEscolarId = Number.parseInt(filters.cicloEscolarId, 10);
        body.onlyActive = !!filters.onlyActive;
        body.noPenalty  = !!filters.noPenalty;
        if (Object.keys(tariffOverrides).length > 0) body.tariffOverrides = tariffOverrides;
        return body;
    };

    const handleAddTariffOverride = () => {
        const periods = parsePeriodsInput(tariffOverrideForm.periods);
        const valuePerStudent = Number(tariffOverrideForm.valuePerStudent || 0);
        if (periods.length === 0 || periods.some(period => !/^\d{4}-\d{2}$/.test(period))) {
            setError('Ingresa períodos válidos en formato YYYY-MM, separados por coma.');
            return;
        }
        if (!Number.isFinite(valuePerStudent) || valuePerStudent <= 0) {
            setError('Ingresa un monto por alumno mayor a 0.');
            return;
        }
        const routeType = tariffOverrideForm.routeType || 'ALL';
        setTariffOverrides(prev => {
            const next = { ...prev };
            periods.forEach(period => {
                const key = `${period}|${routeType}`;
                next[key] = {
                    mode: tariffOverrideForm.mode || 'SET',
                    valuePerStudent
                };
            });
            return next;
        });
        setTariffOverrideForm({ periods: '', mode: tariffOverrideForm.mode || 'SET', routeType, valuePerStudent: '' });
        setError('');
    };

    const handleRemoveTariffOverride = (key) => {
        setTariffOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSimulate = async () => {
        setLoading(true);
        setError('');
        setResults(null);
        try {
            const body = buildSimulateBody();

            if (!body.schoolId && !body.paymentId && !body.cicloEscolarId) {
                setError('Debes proveer al menos uno: schoolId, paymentId o cicloEscolarId.');
                setLoading(false);
                return;
            }

            const { data } = await api.post('/payments/rebuild/simulate', body);
            setResults(data);
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error al simular.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplied = (paymentId, applyResult) => {
        // Marcar la fila como aplicada y refrescar sus snapshots con el "after"
        setResults(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                payments: prev.payments.map(p => {
                    if (p.paymentId !== paymentId) return p;
                    return {
                        ...p,
                        applied: true,
                        beforeSnapshot: applyResult.after,
                        currentState: applyResult.after?.payment || p.currentState,
                        diff: { ...p.diff, hasChanges: false, paymentChanges: [], periodChanges: [], txToCreate: [], txToDelete: [], ledgerToCreate: [], ledgerToDelete: [] }
                    };
                })
            };
        });
        setSnack({ open: true, severity: 'success', message: `Pago ${paymentId} aplicado.` });
    };

    const handleCtxChanged = () => {
        setSelected(null);
        setSnack({ open: true, severity: 'warning', message: 'Re-ejecutando simulación…' });
        handleSimulate();
    };

    const handleReplaceRow = (freshRow) => {
        setResults(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                payments: prev.payments.map(p => p.paymentId === freshRow.paymentId ? freshRow : p)
            };
        });
        setSelected(freshRow);
    };

    const visiblePayments = results?.payments || [];

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Reconstrucción de Estado de Pagos</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Herramienta administrativa oculta. Equivalente a <code>scripts/rebuildPaymentState.js</code>.
                Simula primero, revisa diffs y anomalías por pago, edita si es necesario, y aplica con verificación de concurrencia (ctxHash).
            </Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Filtros</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
                        <TextField
                            label="schoolId" type="number" size="small"
                            value={filters.schoolId} onChange={e => handleChange('schoolId', e.target.value)}
                        />
                        <TextField
                            label="paymentId" type="number" size="small"
                            value={filters.paymentId} onChange={e => handleChange('paymentId', e.target.value)}
                        />
                        <TextField
                            label="cicloEscolarId" type="number" size="small"
                            value={filters.cicloEscolarId} onChange={e => handleChange('cicloEscolarId', e.target.value)}
                        />
                        <FormControlLabel
                            control={<Switch checked={filters.onlyActive} onChange={e => handleChange('onlyActive', e.target.checked)} />}
                            label="Solo activos"
                        />
                        <FormControlLabel
                            control={<Switch checked={filters.noPenalty} onChange={e => handleChange('noPenalty', e.target.checked)} />}
                            label="--no-penalty"
                        />
                    </Box>
                    <Box sx={{ mt: 2, p: 1.5, border: '1px solid #ddd', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Cambio de tarifa por alumno</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1fr) 140px 140px 160px auto' }, gap: 1, alignItems: 'start' }}>
                            <TextField
                                label="Período/s"
                                size="small"
                                value={tariffOverrideForm.periods}
                                onChange={e => handleTariffOverrideFormChange('periods', e.target.value)}
                                helperText="Ej: 2026-03, 2026-04"
                            />
                            <TextField
                                select
                                label="Tipo de ruta"
                                size="small"
                                value={tariffOverrideForm.routeType}
                                onChange={e => handleTariffOverrideFormChange('routeType', e.target.value)}
                            >
                                <MenuItem value="ALL">Todos</MenuItem>
                                <MenuItem value="COMPLETA">Completa</MenuItem>
                                <MenuItem value="MEDIA_AM">Media AM</MenuItem>
                                <MenuItem value="MEDIA_PM">Media PM</MenuItem>
                            </TextField>
                            <TextField
                                select
                                label="Modo"
                                size="small"
                                value={tariffOverrideForm.mode}
                                onChange={e => handleTariffOverrideFormChange('mode', e.target.value)}
                            >
                                <MenuItem value="SET">Fijar</MenuItem>
                                <MenuItem value="INCREMENT">Aumentar</MenuItem>
                                <MenuItem value="DECREMENT">Disminuir</MenuItem>
                            </TextField>
                            <TextField
                                label="Monto por alumno"
                                type="number"
                                size="small"
                                value={tariffOverrideForm.valuePerStudent}
                                onChange={e => handleTariffOverrideFormChange('valuePerStudent', e.target.value)}
                                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                            />
                            <Button variant="outlined" onClick={handleAddTariffOverride} disabled={loading}>
                                Agregar
                            </Button>
                        </Box>
                        {Object.keys(tariffOverrides).length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {Object.entries(tariffOverrides).map(([period, override]) => (
                                    <Chip
                                        key={period}
                                        label={tariffOverrideLabel(period, override)}
                                        onDelete={() => handleRemoveTariffOverride(period)}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Button
                            variant="contained" color="primary"
                            disabled={loading} onClick={handleSimulate}
                        >
                            {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Simular'}
                        </Button>
                        {error && <Alert severity="error" sx={{ flexGrow: 1 }}>{error}</Alert>}
                    </Box>
                </CardContent>
            </Card>

            {results && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Resultados ({results.totals.payments} pagos · {results.totals.withChanges} con cambios · {results.totals.anomalies} anomalías)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            TX: borrar {results.totals.txToDelete} · crear {results.totals.txToCreate} · Ledger: borrar {results.totals.ledgerToDelete} · crear {results.totals.ledgerToCreate}
                        </Typography>

                        <Table size="small" sx={{ mt: 2 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>paymentId</TableCell>
                                    <TableCell>Familia / Usuario</TableCell>
                                    <TableCell>Colegio</TableCell>
                                    <TableCell>finalStatus</TableCell>
                                    <TableCell>Cambios</TableCell>
                                    <TableCell>Anomalías</TableCell>
                                    <TableCell>Acción</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {visiblePayments.map(p => {
                                    const totalChanges =
                                        (p.diff?.paymentChanges?.length || 0) +
                                        (p.diff?.periodChanges?.length || 0) +
                                        (p.diff?.txToCreate?.length || 0) +
                                        (p.diff?.txToDelete?.length || 0);
                                    return (
                                        <TableRow key={p.paymentId} sx={{ bgcolor: p.applied ? '#e8f5e9' : undefined }}>
                                            <TableCell>{p.paymentId}</TableCell>
                                            <TableCell>
                                                {p.userName} {p.familyLastName}<br/>
                                                <Typography variant="caption" color="text.secondary">{p.userEmail}</Typography>
                                            </TableCell>
                                            <TableCell>{p.schoolName}</TableCell>
                                            <TableCell>{p.finalStatus}</TableCell>
                                            <TableCell>{totalChanges}</TableCell>
                                            <TableCell>
                                                {(p.anomalies || []).map((a, i) => (
                                                    <Chip
                                                        key={`${p.paymentId}-${a.code}-${i}`}
                                                        size="small"
                                                        label={a.code}
                                                        color={SEV_COLOR[a.severity] || 'default'}
                                                        sx={{ mr: 0.5, mb: 0.5 }}
                                                    />
                                                ))}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="small"
                                                    variant={p.applied ? 'outlined' : 'contained'}
                                                    onClick={() => setSelected(p)}
                                                    disabled={!p.hasChanges && (p.anomalies || []).length === 0}
                                                >
                                                    {p.applied ? 'Ver' : 'Revisar'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <RebuildPaymentModal
                open={!!selected}
                payment={selected}
                onClose={() => setSelected(null)}
                onApplied={handleApplied}
                onCtxChanged={handleCtxChanged}
                onReplaceRow={handleReplaceRow}
                tariffOverrides={tariffOverrides}
                noPenalty={!!filters.noPenalty}
            />

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
