import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, TextField, Switch, FormControlLabel,
    Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, CircularProgress,
    Alert, Snackbar
} from '@mui/material';
import api from '../utils/axiosConfig';
import RebuildPaymentModal from '../components/modals/RebuildPaymentModal';

const SEV_COLOR = { high: 'error', medium: 'warning', low: 'info' };

export default function AdminRebuildPaymentsHidden() {
    const [filters, setFilters] = useState({
        schoolId: '', paymentId: '', year: '', onlyActive: false, noPenalty: false
    });
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

    const handleChange = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const handleSimulate = async () => {
        setLoading(true);
        setError('');
        setResults(null);
        try {
            const body = {};
            if (filters.schoolId)  body.schoolId  = Number.parseInt(filters.schoolId, 10);
            if (filters.paymentId) body.paymentId = Number.parseInt(filters.paymentId, 10);
            if (filters.year)      body.year      = filters.year;
            body.onlyActive = !!filters.onlyActive;
            body.noPenalty  = !!filters.noPenalty;

            if (!body.schoolId && !body.paymentId && !body.year) {
                setError('Debes proveer al menos uno: schoolId, paymentId o year.');
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
                            label="schoolYear (ej: 2025-2026)" size="small"
                            value={filters.year} onChange={e => handleChange('year', e.target.value)}
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
