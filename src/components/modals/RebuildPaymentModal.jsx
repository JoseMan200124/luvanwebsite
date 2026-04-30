import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Switch, FormControlLabel, TextField,
    Divider, Chip, Snackbar, Alert, IconButton, Tooltip,
    Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
    CircularProgress, Card, CardContent, Grid
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import api from '../../utils/axiosConfig';

const SEV = {
    high:   { label: 'ALTA',   color: '#d32f2f', bg: '#ffebee' },
    medium: { label: 'MEDIA',  color: '#ed6c02', bg: '#fff4e5' },
    low:    { label: 'INFO',   color: '#0288d1', bg: '#e3f2fd' }
};

function fmtVal(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (Array.isArray(v) || (typeof v === 'object')) return JSON.stringify(v);
    return String(v);
}

function parseInputValue(s) {
    const t = (s || '').trim();
    if (t === '') return '';
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (!Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return t;
}

function isEqualLoose(a, b) {
    if (a === b) return true;
    if (a === null || a === undefined) return b === null || b === undefined || b === '';
    if (b === null || b === undefined) return a === null || a === undefined || a === '';
    if (typeof a === 'number' || typeof b === 'number') {
        return Number(a) === Number(b);
    }
    return String(a) === String(b);
}

function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function applyOverrides(target, overrides) {
    const out = { ...target };
    Object.keys(overrides || {}).forEach(k => {
        if (overrides[k] !== '' && overrides[k] !== undefined) out[k] = overrides[k];
    });
    return out;
}

function diffObjects(current, expected, fieldsOrder) {
    const fields = fieldsOrder || Array.from(new Set([...Object.keys(current || {}), ...Object.keys(expected || {})]));
    const changes = [];
    fields.forEach(f => {
        if (!isEqualLoose(current?.[f], expected?.[f])) {
            changes.push({ field: f, current: current?.[f], expected: expected?.[f] });
        }
    });
    return changes;
}

const AUTO_CREDIT_REBUILD_TYPES = new Set(['CREDIT_AUTO_TARIFF', 'CREDIT_AUTO_PENALTY']);
const AUTO_CREDIT_RECEIPT_NUMBER = '003';

function isSyntheticAutoCredit(row) {
    return !!row?.synthetic && AUTO_CREDIT_REBUILD_TYPES.has(row.type || row.kind);
}

function isSavedAutoCredit(row) {
    return row?.type === 'CREDITO' && row?.source === 'CREDIT_AUTO';
}

function autoCreditDate(row) {
    return row?.date || row?.realPaymentDate || '';
}

function autoCreditAmount(row) {
    return Number(row?.amount || 0).toFixed(2);
}

function autoCreditPeriod(row) {
    if (row?.period) return row.period;
    const match = /per[ií]odo\s+(\d{4}-\d{2})/i.exec(String(row?.notes || ''));
    return match?.[1] || null;
}

function areEquivalentAutoCreditRows(savedRow, syntheticRow) {
    if (autoCreditDate(savedRow) !== autoCreditDate(syntheticRow)) return false;
    if (autoCreditAmount(savedRow) !== autoCreditAmount(syntheticRow)) return false;

    const savedPeriod = autoCreditPeriod(savedRow);
    const syntheticPeriod = autoCreditPeriod(syntheticRow);
    return !savedPeriod || !syntheticPeriod || savedPeriod === syntheticPeriod;
}

function findEquivalentAutoCreditRows(beforeRows, afterRows, deleteIds) {
    const beforeCandidates = (beforeRows || []).filter(row => deleteIds.has(row.id) && isSavedAutoCredit(row));
    const beforeIds = new Set();
    const afterIds = new Set();

    (afterRows || []).forEach(afterRow => {
        if (!isSyntheticAutoCredit(afterRow)) return;
        const matchedBeforeRow = beforeCandidates.find(beforeRow => (
            !beforeIds.has(beforeRow.id) && areEquivalentAutoCreditRows(beforeRow, afterRow)
        ));
        if (!matchedBeforeRow) return;
        beforeIds.add(matchedBeforeRow.id);
        afterIds.add(afterRow.id);
    });

    return { beforeIds, afterIds };
}

function getTransactionDisplay(row) {
    if (isSyntheticAutoCredit(row)) {
        return {
            type: 'CREDITO',
            source: 'CREDIT_AUTO',
            periodLabel: `#${row.receiptNumber || AUTO_CREDIT_RECEIPT_NUMBER}`
        };
    }

    return {
        type: row?.type || row?.kind || '—',
        source: row?.source || '—',
        periodLabel: row?.period || (row?.receiptNumber ? `#${row.receiptNumber}` : '—')
    };
}

export default function RebuildPaymentModal({ open, onClose, payment, onApplied, onCtxChanged, onReplaceRow }) {
    const [tab, setTab] = useState(0);
    const [editPayment, setEditPayment] = useState({});
    const [editPeriods, setEditPeriods] = useState({});
    const [anomalyDecisions, setAnomalyDecisions] = useState({});
    const [creditAutoDecisions, setCreditAutoDecisions] = useState({});
    const [applying, setApplying] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [appliedResult, setAppliedResult] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info', action: null });

    // Boletas
    const [receiptsOpen, setReceiptsOpen] = useState(false);
    const [receipts, setReceipts] = useState([]);
    const [receiptsLoading, setReceiptsLoading] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    // Colegio
    const [schoolOpen, setSchoolOpen] = useState(false);
    const [schoolData, setSchoolData] = useState(null);
    const [schoolLoading, setSchoolLoading] = useState(false);

    // Reset state when target payment changes
    useEffect(() => {
        setEditPayment({});
        setEditPeriods({});
        setCreditAutoDecisions({});
        setAppliedResult(null);
        setTab(0);
        const init = {};
        (payment?.anomalies || []).forEach(a => {
            if (a.askApply) init[a.code] = true;
        });
        setAnomalyDecisions(init);
    }, [payment?.paymentId, payment?.ctxHash]); // eslint-disable-line react-hooks/exhaustive-deps

    const before    = payment?.beforeSnapshot || {};
    const expected  = payment?.expectedSnapshot || {};
    const beforePay = before.payment || {};
    const expPay    = expected.payment || {};

    // Effective expected after user overrides
    const effectiveExpectedPayment = useMemo(
        () => applyOverrides(expPay, editPayment),
        [expPay, editPayment]
    );
    const effectiveExpectedPeriods = useMemo(() => {
        const arr = expected.periods || [];
        return arr.map(p => {
            const ov = editPeriods[p.period];
            return ov ? applyOverrides(p, ov) : p;
        });
    }, [expected.periods, editPeriods]);

    // Live recomputed diff (current vs effective expected)
    const livePaymentChanges = useMemo(
        () => diffObjects(beforePay, effectiveExpectedPayment),
        [beforePay, effectiveExpectedPayment]
    );
    const livePeriodChanges = useMemo(() => {
        const beforePeriods = before.periods || [];
        const beforeMap = new Map(beforePeriods.map(p => [p.period, p]));
        return effectiveExpectedPeriods.map(ep => {
            const cur = beforeMap.get(ep.period) || {};
            const changes = diffObjects(cur, ep);
            return changes.length > 0 ? { period: ep.period, changes } : null;
        }).filter(Boolean);
    }, [before.periods, effectiveExpectedPeriods]);

    // Field lists for the editable form
    const paymentFields = useMemo(
        () => Array.from(new Set([...Object.keys(beforePay), ...Object.keys(expPay)])),
        [beforePay, expPay]
    );
    const periodFieldKeys = useMemo(() => {
        const set = new Set();
        (before.periods || []).forEach(p => Object.keys(p).forEach(k => set.add(k)));
        (expected.periods || []).forEach(p => Object.keys(p).forEach(k => set.add(k)));
        set.delete('period');
        return Array.from(set);
    }, [before.periods, expected.periods]);

    const txAfter = expected.transactionsAfter || [];
    const txBefore = before.transactions || [];
    const ledgerBefore = before.ledger || [];
    const ledgerAfter = expected.ledgerAfter || [];
    const txDisplayMarks = useMemo(() => {
        const keptIds = new Set((txAfter || []).filter(row => !row.synthetic).map(row => row.id));
        const deleteIds = new Set((txBefore || []).filter(row => !keptIds.has(row.id)).map(row => row.id));
        const updateIds = new Set((expected.transactionsToUpdate || []).map(row => row.id));
        const equivalentAutoCreditRows = findEquivalentAutoCreditRows(txBefore, txAfter, deleteIds);
        const beforeMarkIds = new Set([...deleteIds].filter(id => !equivalentAutoCreditRows.beforeIds.has(id)));

        return {
            beforeMarkIds,
            updateIds,
            equivalentAfterIds: equivalentAutoCreditRows.afterIds
        };
    }, [expected.transactionsToUpdate, txBefore, txAfter]);

    if (!payment) return null;

    const handlePaymentEdit = (field, value) => {
        setEditPayment(prev => ({ ...prev, [field]: parseInputValue(value) }));
    };
    const handlePeriodEdit = (period, field, value) => {
        setEditPeriods(prev => ({
            ...prev,
            [period]: { ...(prev[period] || {}), [field]: parseInputValue(value) }
        }));
    };
    const toggleAnomaly = (code, val) => setAnomalyDecisions(p => ({ ...p, [code]: val }));

    const handleResimulate = async () => {
        setRefreshing(true);
        try {
            const { data } = await api.post('/payments/rebuild/simulate', { paymentId: payment.paymentId, creditAutoDecisions });
            const fresh = (data?.payments || []).find(p => p.paymentId === payment.paymentId);
            if (!fresh) {
                setSnackbar({ open: true, severity: 'warning', message: 'No se encontró el pago en la nueva simulación.' });
            } else {
                if (onReplaceRow) onReplaceRow(fresh);
                setEditPayment({});
                setEditPeriods({});
                setAppliedResult(null);
                setSnackbar({ open: true, severity: 'success', message: 'Reconstrucción actualizada desde la base de datos.' });
            }
        } catch (err) {
            setSnackbar({ open: true, severity: 'error', message: err?.response?.data?.message || err.message || 'Error al re-simular.' });
        } finally {
            setRefreshing(false);
        }
    };

    const handleCreditAutoDecisionChange = async (decisionKey, noAplica) => {
        if (!decisionKey) return;
        const next = { ...creditAutoDecisions };
        if (noAplica) next[decisionKey] = false;
        else delete next[decisionKey];
        setCreditAutoDecisions(next);
        setRefreshing(true);
        try {
            const { data } = await api.post('/payments/rebuild/simulate', { paymentId: payment.paymentId, creditAutoDecisions: next });
            const fresh = (data?.payments || []).find(p => p.paymentId === payment.paymentId);
            if (!fresh) {
                setSnackbar({ open: true, severity: 'warning', message: 'No se encontró el pago en la nueva simulación.' });
            } else {
                if (onReplaceRow) onReplaceRow(fresh);
                setEditPayment({});
                setEditPeriods({});
                setAppliedResult(null);
                setSnackbar({ open: true, severity: 'success', message: 'Reconstrucción recalculada con la decisión de crédito automático.' });
            }
        } catch (err) {
            setSnackbar({ open: true, severity: 'error', message: err?.response?.data?.message || err.message || 'Error al recalcular.' });
        } finally {
            setRefreshing(false);
        }
    };

    const handleApply = async () => {
        setApplying(true);
        try {
            const payloadPayment = {};
            Object.keys(editPayment).forEach(k => {
                if (editPayment[k] !== '') payloadPayment[k] = editPayment[k];
            });

            const payloadPeriods = Object.keys(editPeriods).map(period => {
                const fields = editPeriods[period] || {};
                const cleaned = { period };
                Object.keys(fields).forEach(k => {
                    if (fields[k] !== '') cleaned[k] = fields[k];
                });
                return cleaned;
            }).filter(p => Object.keys(p).length > 1);

            const body = {
                paymentId: payment.paymentId,
                ctxHash: payment.ctxHash,
                expectedPayment: Object.keys(payloadPayment).length > 0 ? payloadPayment : undefined,
                expectedPeriods: payloadPeriods.length > 0 ? payloadPeriods : undefined,
                anomalyDecisions,
                creditAutoDecisions
            };

            const { data } = await api.post('/payments/rebuild/apply', body);
            setAppliedResult(data);
            setSnackbar({ open: true, severity: 'success', message: 'Cambios aplicados correctamente.' });
            if (onApplied) onApplied(payment.paymentId, data);
        } catch (err) {
            const status = err?.response?.status;
            const data = err?.response?.data;
            if (status === 409) {
                setSnackbar({
                    open: true,
                    severity: 'warning',
                    message: data?.message || 'Los datos cambiaron desde la simulación.',
                    action: (
                        <Button color="inherit" size="small" onClick={() => { setSnackbar(s => ({ ...s, open: false })); if (onCtxChanged) onCtxChanged(); }}>
                            Volver a simular
                        </Button>
                    )
                });
            } else {
                setSnackbar({ open: true, severity: 'error', message: data?.message || err.message || 'Error al aplicar.' });
            }
        } finally {
            setApplying(false);
        }
    };

    const handleDownloadResult = () => {
        if (!appliedResult) return;
        const ts = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
        downloadJson(appliedResult, `apply-payment-${payment.paymentId}-${ts}.json`);
    };

    // Boletas
    const openReceipts = async () => {
        setReceiptsOpen(true);
        if (!payment.userId) return;
        setReceiptsLoading(true);
        try {
            const { data } = await api.get(`/parents/${payment.userId}/receipts`);
            setReceipts(data?.receipts || []);
        } catch (err) {
            setSnackbar({ open: true, severity: 'error', message: err?.response?.data?.message || 'No se pudieron cargar las boletas.' });
        } finally {
            setReceiptsLoading(false);
        }
    };

    const openSchoolDetails = async () => {
        setSchoolOpen(true);
        if (!payment.schoolId) return;
        setSchoolLoading(true);
        try {
            const { data } = await api.get(`/schools/${payment.schoolId}`);
            setSchoolData(data?.school || null);
        } catch (err) {
            setSnackbar({ open: true, severity: 'error', message: err?.response?.data?.message || 'No se pudo cargar el colegio.' });
        } finally {
            setSchoolLoading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        Reconstrucción · paymentId={payment.paymentId}
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                            {payment.userName} {payment.familyLastName} · {payment.userEmail} · {payment.schoolName}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Volver a calcular desde la base de datos (descarta tus ediciones)">
                            <span>
                                <Button startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={handleResimulate} disabled={refreshing || applying}>
                                    Re-simular
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip title="Ver boletas subidas por el padre">
                            <span>
                                <Button startIcon={<ReceiptIcon />} onClick={openReceipts}>Boletas</Button>
                            </span>
                        </Tooltip>
                        <Tooltip title="Ver detalles financieros del colegio">
                            <span>
                                <Button startIcon={<AccountBalanceIcon />} onClick={openSchoolDetails}>Colegio</Button>
                            </span>
                        </Tooltip>
                        <IconButton onClick={onClose}><CloseIcon /></IconButton>
                    </Box>
                </DialogTitle>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
                    <Tab label="Resumen" />
                    <Tab label={`Editar (${(editPayment && Object.keys(editPayment).length) + Object.keys(editPeriods).length} con override)`} />
                    <Tab label={`Diff (${livePaymentChanges.length + livePeriodChanges.length} cambios)`} />
                    <Tab label={`Historial (${txBefore.length} → ${txAfter.length})`} />
                    <Tab label={`Ledger (${ledgerBefore.length} → ${ledgerAfter.length})`} />
                    <Tab label="JSON" />
                </Tabs>

                <DialogContent dividers sx={{ minHeight: 480 }}>
                    {tab === 0 && (
                        <Box>
                            {/* ANOMALÍAS */}
                            {(payment.anomalies && payment.anomalies.length > 0) ? (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h6" gutterBottom>Anomalías ({payment.anomalies.length})</Typography>
                                    {payment.anomalies.map((a, i) => {
                                        const sev = SEV[a.severity] || SEV.low;
                                        return (
                                            <Box key={`${a.code}-${i}`} sx={{ p: 1.5, mb: 1, border: `1px solid ${sev.color}`, borderRadius: 1, bgcolor: sev.bg }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <Chip size="small" label={sev.label} sx={{ mr: 1, bgcolor: sev.color, color: '#fff' }} />
                                                        <Typography component="span" sx={{ fontWeight: 600 }}>{a.title}</Typography>
                                                    </Box>
                                                    {a.askApply && !appliedResult && (
                                                        <FormControlLabel
                                                            control={<Switch checked={!!anomalyDecisions[a.code]} onChange={e => toggleAnomaly(a.code, e.target.checked)} />}
                                                            label={anomalyDecisions[a.code] ? 'Aplicar' : 'Omitir'}
                                                        />
                                                    )}
                                                </Box>
                                                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{a.detail}</Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ) : (
                                <Alert severity="info" sx={{ mb: 2 }}>Sin anomalías detectadas.</Alert>
                            )}

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="subtitle2" color="error">ESTADO ACTUAL</Typography>
                                            <Typography variant="body2">balanceDue: {fmtVal(beforePay.balanceDue)}</Typography>
                                            <Typography variant="body2">creditBalance: {fmtVal(beforePay.creditBalance)}</Typography>
                                            <Typography variant="body2">penaltyDue: {fmtVal(beforePay.penaltyDue)}</Typography>
                                            <Typography variant="body2">finalStatus: {fmtVal(beforePay.finalStatus)}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="subtitle2" color="success.main">ESPERADO (con tus ediciones)</Typography>
                                            <Typography variant="body2">balanceDue: {fmtVal(effectiveExpectedPayment.balanceDue)}</Typography>
                                            <Typography variant="body2">creditBalance: {fmtVal(effectiveExpectedPayment.creditBalance)}</Typography>
                                            <Typography variant="body2">penaltyDue: {fmtVal(effectiveExpectedPayment.penaltyDue)}</Typography>
                                            <Typography variant="body2">finalStatus: {fmtVal(effectiveExpectedPayment.finalStatus)}</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {tab === 1 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Edita cualquier campo. Deja vacío para mantener el valor esperado por la reconstrucción.
                                Usa <code>true</code>/<code>false</code>/<code>null</code> o números directos.
                            </Alert>

                            <Typography variant="h6" gutterBottom>Payment</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Campo</TableCell>
                                        <TableCell>Actual</TableCell>
                                        <TableCell>Esperado</TableCell>
                                        <TableCell>Editar</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paymentFields.map(f => {
                                        const changed = !isEqualLoose(beforePay[f], effectiveExpectedPayment[f]);
                                        return (
                                            <TableRow key={f} sx={{ bgcolor: changed ? '#fff8e1' : undefined }}>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{f}</TableCell>
                                                <TableCell sx={{ fontSize: 12 }}>{fmtVal(beforePay[f])}</TableCell>
                                                <TableCell sx={{ fontSize: 12, color: 'success.main' }}>{fmtVal(expPay[f])}</TableCell>
                                                <TableCell>
                                                    <TextField
                                                        size="small"
                                                        placeholder={fmtVal(expPay[f])}
                                                        value={editPayment[f] === undefined ? '' : String(editPayment[f])}
                                                        onChange={e => handlePaymentEdit(f, e.target.value)}
                                                        disabled={!!appliedResult}
                                                        sx={{ minWidth: 160 }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Periodos</Typography>
                            {(expected.periods || []).map((ep, idx) => {
                                const cur = (before.periods || []).find(p => p.period === ep.period) || {};
                                const eff = effectiveExpectedPeriods[idx] || ep;
                                return (
                                    <Box key={ep.period} sx={{ mt: 2, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{ep.period}</Typography>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Campo</TableCell>
                                                    <TableCell>Actual</TableCell>
                                                    <TableCell>Esperado</TableCell>
                                                    <TableCell>Editar</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {periodFieldKeys.map(f => {
                                                    const changed = !isEqualLoose(cur[f], eff[f]);
                                                    return (
                                                        <TableRow key={f} sx={{ bgcolor: changed ? '#fff8e1' : undefined }}>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{f}</TableCell>
                                                            <TableCell sx={{ fontSize: 12 }}>{fmtVal(cur[f])}</TableCell>
                                                            <TableCell sx={{ fontSize: 12, color: 'success.main' }}>{fmtVal(ep[f])}</TableCell>
                                                            <TableCell>
                                                                <TextField
                                                                    size="small"
                                                                    placeholder={fmtVal(ep[f])}
                                                                    value={editPeriods[ep.period]?.[f] === undefined ? '' : String(editPeriods[ep.period][f])}
                                                                    onChange={e => handlePeriodEdit(ep.period, f, e.target.value)}
                                                                    disabled={!!appliedResult}
                                                                    sx={{ minWidth: 160 }}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    {tab === 2 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Comparación ESTADO ACTUAL vs ESPERADO. Las filas en amarillo cambiarán al aplicar.
                            </Alert>
                            <Typography variant="h6">Payment ({livePaymentChanges.length} cambios)</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Campo</TableCell>
                                        <TableCell>Actual</TableCell>
                                        <TableCell>Esperado</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paymentFields.map(f => {
                                        const changed = !isEqualLoose(beforePay[f], effectiveExpectedPayment[f]);
                                        return (
                                            <TableRow key={f} sx={{ bgcolor: changed ? '#fff8e1' : undefined }}>
                                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: changed ? 700 : 400 }}>{f}</TableCell>
                                                <TableCell sx={{ color: changed ? 'error.main' : 'text.primary' }}>{fmtVal(beforePay[f])}</TableCell>
                                                <TableCell sx={{ color: changed ? 'success.main' : 'text.secondary' }}>{fmtVal(effectiveExpectedPayment[f])}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            <Typography variant="h6" sx={{ mt: 3 }}>Periodos ({livePeriodChanges.length} con cambios)</Typography>
                            {effectiveExpectedPeriods.map((ep, idx) => {
                                const cur = (before.periods || []).find(p => p.period === ep.period) || {};
                                const changesInPeriod = diffObjects(cur, ep).length;
                                return (
                                    <Box key={ep.period} sx={{ mt: 2, p: 1, border: changesInPeriod > 0 ? '1px solid #f9a825' : '1px solid #eee', borderRadius: 1 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: changesInPeriod > 0 ? 'warning.dark' : 'text.primary' }}>
                                            {ep.period} {changesInPeriod > 0 ? `(${changesInPeriod} cambios)` : ''}
                                        </Typography>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Campo</TableCell>
                                                    <TableCell>Actual</TableCell>
                                                    <TableCell>Esperado</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {periodFieldKeys.map(f => {
                                                    const changed = !isEqualLoose(cur[f], ep[f]);
                                                    return (
                                                        <TableRow key={f} sx={{ bgcolor: changed ? '#fff8e1' : undefined }}>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: changed ? 700 : 400 }}>{f}</TableCell>
                                                            <TableCell sx={{ fontSize: 12, color: changed ? 'error.main' : 'text.primary' }}>{fmtVal(cur[f])}</TableCell>
                                                            <TableCell sx={{ fontSize: 12, color: changed ? 'success.main' : 'text.secondary' }}>{fmtVal(ep[f])}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    {tab === 3 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Historial de Pagos antes vs después. Las filas marcadas en verde se crearán; las marcadas en rojo se borrarán; las marcadas en amarillo se actualizarán.
                            </Alert>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" color="error" sx={{ mb: 1 }}>ANTES ({txBefore.length})</Typography>
                                    <TxTable
                                        rows={txBefore}
                                        markIds={txDisplayMarks.beforeMarkIds}
                                        updateIds={txDisplayMarks.updateIds}
                                        markStyle={{ bgcolor: '#ffebee' }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" color="success.main" sx={{ mb: 1 }}>DESPUÉS ({txAfter.length})</Typography>
                                    <TxTable
                                        rows={txAfter}
                                        updateIds={txDisplayMarks.updateIds}
                                        markFn={row => row.synthetic && !txDisplayMarks.equivalentAfterIds.has(row.id)}
                                        markStyle={{ bgcolor: '#e8f5e9' }}
                                        creditAutoDecisions={creditAutoDecisions}
                                        onCreditAutoDecisionChange={handleCreditAutoDecisionChange}
                                        disableCreditAutoDecision={!!appliedResult || applying || refreshing}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {tab === 4 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Ledger antes vs después. Después se reconstruye completamente.
                            </Alert>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" color="error" sx={{ mb: 1 }}>ANTES ({ledgerBefore.length})</Typography>
                                    <LedgerTable rows={ledgerBefore} />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" color="success.main" sx={{ mb: 1 }}>DESPUÉS ({ledgerAfter.length})</Typography>
                                    <LedgerTable rows={ledgerAfter} />
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {tab === 5 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="error">ANTES (snapshot completo)</Typography>
                                <pre style={{ fontSize: 11, background: '#fff5f5', padding: 8, maxHeight: 480, overflow: 'auto' }}>
{JSON.stringify(before, null, 2)}
                                </pre>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="success.main">DESPUÉS (esperado + ediciones)</Typography>
                                <pre style={{ fontSize: 11, background: '#f5fff5', padding: 8, maxHeight: 480, overflow: 'auto' }}>
{JSON.stringify({ ...expected, payment: effectiveExpectedPayment, periods: effectiveExpectedPeriods }, null, 2)}
                                </pre>
                            </Grid>
                        </Grid>
                    )}

                    {appliedResult && (
                        <Box sx={{ mt: 2, p: 2, border: '2px solid #2e7d32', borderRadius: 1, bgcolor: '#e8f5e9' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                    ✓ Aplicado a las {new Date(appliedResult.appliedAt).toLocaleString()}
                                </Typography>
                                <Button startIcon={<DownloadIcon />} onClick={handleDownloadResult} variant="outlined">
                                    Descargar JSON
                                </Button>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="caption">Snapshot DESPUÉS (post-aplicación):</Typography>
                            <pre style={{ fontSize: 11, background: '#fff', padding: 8, maxHeight: 220, overflow: 'auto' }}>
{JSON.stringify(appliedResult.after, null, 2)}
                            </pre>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Tooltip title="Cierra el modal sin aplicar">
                        <Button onClick={onClose}>{appliedResult ? 'Cerrar' : 'Saltar'}</Button>
                    </Tooltip>
                    {!appliedResult && (
                        <Button onClick={handleApply} variant="contained" color="primary" disabled={applying || refreshing}>
                            {applying ? 'Aplicando…' : 'Aplicar'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Boletas dialog */}
            <Dialog open={receiptsOpen} onClose={() => { setReceiptsOpen(false); setSelectedReceipt(null); }} maxWidth="md" fullWidth>
                <DialogTitle>
                    Boletas de {payment.userName}
                    <IconButton onClick={() => { setReceiptsOpen(false); setSelectedReceipt(null); }} sx={{ float: 'right' }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {receiptsLoading && <Box sx={{ textAlign: 'center', p: 3 }}><CircularProgress /></Box>}
                    {!receiptsLoading && receipts.length === 0 && <Alert severity="info">Sin boletas subidas.</Alert>}
                    {!receiptsLoading && receipts.length > 0 && !selectedReceipt && (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Fecha</TableCell>
                                    <TableCell>Archivo</TableCell>
                                    <TableCell>Monto</TableCell>
                                    <TableCell>Notas</TableCell>
                                    <TableCell>Acción</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {receipts.map(r => (
                                    <TableRow key={r.id || r.fileUrl}>
                                        <TableCell>{(r.uploadedAt || r.createdAt) ? new Date(r.uploadedAt || r.createdAt).toLocaleString() : '—'}</TableCell>
                                        <TableCell sx={{ wordBreak: 'break-all', fontSize: 11 }}>{r.fileName || r.fileUrl}</TableCell>
                                        <TableCell>{r.amount ?? '—'}</TableCell>
                                        <TableCell sx={{ fontSize: 11, maxWidth: 200 }}>{r.notes || '—'}</TableCell>
                                        <TableCell>
                                            <Button size="small" onClick={() => setSelectedReceipt(r)}>Ver</Button>
                                            {r.fileUrl && <Button size="small" href={r.fileUrl} target="_blank" rel="noopener noreferrer">Abrir</Button>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {selectedReceipt && (
                        <Box>
                            <Button size="small" onClick={() => setSelectedReceipt(null)} sx={{ mb: 1 }}>← Volver al listado</Button>
                            <Box sx={{ textAlign: 'center' }}>
                                {selectedReceipt.fileUrl && /\.(png|jpe?g|gif|webp)$/i.test(selectedReceipt.fileUrl) ? (
                                    <img src={selectedReceipt.fileUrl} alt={selectedReceipt.fileName || 'Boleta'} style={{ maxWidth: '100%', maxHeight: 600 }} />
                                ) : selectedReceipt.fileUrl ? (
                                    <iframe title="boleta" src={selectedReceipt.fileUrl} style={{ width: '100%', height: 600, border: 0 }} />
                                ) : (
                                    <Alert severity="warning">Sin URL disponible.</Alert>
                                )}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Colegio dialog */}
            <Dialog open={schoolOpen} onClose={() => setSchoolOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Detalles del colegio
                    <IconButton onClick={() => setSchoolOpen(false)} sx={{ float: 'right' }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {schoolLoading && <Box sx={{ textAlign: 'center', p: 3 }}><CircularProgress /></Box>}
                    {!schoolLoading && !schoolData && <Alert severity="warning">No se encontraron datos del colegio.</Alert>}
                    {!schoolLoading && schoolData && (
                        <Box>
                            <Typography variant="h6" gutterBottom>{schoolData.name}</Typography>
                            <Divider sx={{ mb: 2 }} />

                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Contacto</Typography>
                            <Table size="small" sx={{ mb: 2 }}>
                                <TableBody>
                                    {[
                                        ['Dirección',   schoolData.address],
                                        ['Ciudad',      schoolData.city],
                                        ['Responsable', schoolData.contactPerson],
                                        ['Email',       schoolData.contactEmail],
                                        ['Teléfono',    schoolData.contactPhone],
                                        ['WhatsApp',    schoolData.whatsappLink],
                                    ].map(([label, val]) => val ? (
                                        <TableRow key={label}>
                                            <TableCell sx={{ fontWeight: 600, width: 140, fontSize: 13 }}>{label}</TableCell>
                                            <TableCell sx={{ fontSize: 13 }}>{val}</TableCell>
                                        </TableRow>
                                    ) : null)}
                                </TableBody>
                            </Table>

                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Tarifas y mora</Typography>
                            <Table size="small" sx={{ mb: 2 }}>
                                <TableBody>
                                    {[
                                        ['Tarifa completa (mensual)',  schoolData.transportFeeComplete != null ? `Q ${Number(schoolData.transportFeeComplete).toFixed(2)}` : null],
                                        ['Tarifa media (mensual)',     schoolData.transportFeeHalf     != null ? `Q ${Number(schoolData.transportFeeHalf).toFixed(2)}`     : null],
                                        ['Mora diaria',               schoolData.dailyPenalty          != null ? `Q ${Number(schoolData.dailyPenalty).toFixed(2)}`          : null],
                                        ['Mora pausada',              schoolData.penaltyPaused != null  ? (schoolData.penaltyPaused ? 'Sí' : 'No')                         : null],
                                        ['Día límite de pago',        schoolData.duePaymentDay != null  ? `Día ${schoolData.duePaymentDay} de cada mes`                    : null],
                                    ].map(([label, val]) => val != null ? (
                                        <TableRow key={label}>
                                            <TableCell sx={{ fontWeight: 600, width: 200, fontSize: 13 }}>{label}</TableCell>
                                            <TableCell sx={{ fontSize: 13 }}>{val}</TableCell>
                                        </TableRow>
                                    ) : null)}
                                </TableBody>
                            </Table>

                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Año escolar</Typography>
                            <Table size="small" sx={{ mb: 2 }}>
                                <TableBody>
                                    {[
                                        ['Inicio año escolar', schoolData.schoolYearStart],
                                        ['Fin año escolar',    schoolData.schoolYearEnd],
                                    ].map(([label, val]) => val ? (
                                        <TableRow key={label}>
                                            <TableCell sx={{ fontWeight: 600, width: 200, fontSize: 13 }}>{label}</TableCell>
                                            <TableCell sx={{ fontSize: 13 }}>{val}</TableCell>
                                        </TableRow>
                                    ) : null)}
                                </TableBody>
                            </Table>

                            {(schoolData.bankName || schoolData.bankAccount) && (
                                <>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Datos bancarios</Typography>
                                    <Table size="small" sx={{ mb: 2 }}>
                                        <TableBody>
                                            {[
                                                ['Banco',   schoolData.bankName],
                                                ['Cuenta',  schoolData.bankAccount],
                                            ].map(([label, val]) => val ? (
                                                <TableRow key={label}>
                                                    <TableCell sx={{ fontWeight: 600, width: 140, fontSize: 13 }}>{label}</TableCell>
                                                    <TableCell sx={{ fontSize: 13 }}>{val}</TableCell>
                                                </TableRow>
                                            ) : null)}
                                        </TableBody>
                                    </Table>
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.severity === 'warning' ? null : 5000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    action={snackbar.action}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

function TxTable({ rows, markIds, updateIds, markFn, markStyle, creditAutoDecisions, onCreditAutoDecisionChange, disableCreditAutoDecision }) {
    const showCreditAutoDecision = !!onCreditAutoDecisionChange;
    const sorted = [...(rows || [])].sort((a, b) => {
        const da = (a.date || a.realPaymentDate || '').toString();
        const db = (b.date || b.realPaymentDate || '').toString();
        return da.localeCompare(db);
    });
    const hasExtraDiscount = sorted.some(r => Number(r.extraordinaryDiscount || 0) > 0);
    return (
        <Table size="small" sx={{ '& td, & th': { fontSize: 11 } }}>
            <TableHead>
                <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Origen</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    {hasExtraDiscount && <TableCell align="right">Desc. Extra</TableCell>}
                    <TableCell>Periodo / Boleta</TableCell>
                    {showCreditAutoDecision && <TableCell align="center">No aplica</TableCell>}
                </TableRow>
            </TableHead>
            <TableBody>
                {sorted.map((row, index) => {
                    const marked = (markIds && markIds.has(row.id)) || (markFn && markFn(row));
                    const updated = updateIds && updateIds.has(row.id);
                    const fecha = row.date || row.realPaymentDate || '—';
                    const display = getTransactionDisplay(row);
                    const canSkipCreditAuto = row.synthetic && row.type === 'CREDIT_AUTO_TARIFF' && row.decisionKey && row.canSkipCreditAuto;
                    const extraDiscount = Number(row.extraordinaryDiscount || 0);
                    return (
                        <TableRow key={`${row.id || 'new'}-${index}`} sx={marked ? markStyle : (updated ? { bgcolor: '#fff8e1' } : undefined)}>
                            <TableCell>{fecha}</TableCell>
                            <TableCell>{display.type}</TableCell>
                            <TableCell>{display.source}</TableCell>
                            <TableCell align="right">{row.amount ?? '—'}</TableCell>
                            {hasExtraDiscount && (
                                <TableCell align="right" sx={extraDiscount > 0 ? { color: 'success.main', fontWeight: 600 } : { color: 'text.disabled' }}>
                                    {extraDiscount > 0 ? `-${extraDiscount.toFixed(2)}` : '—'}
                                </TableCell>
                            )}
                            <TableCell>{display.periodLabel}</TableCell>
                            {showCreditAutoDecision && (
                                <TableCell align="center">
                                    {canSkipCreditAuto ? (
                                        <Tooltip title="Marcar cuando este crédito automático no aplica y el pago origen debe tomarse como pago del período">
                                            <span>
                                                <Switch
                                                    size="small"
                                                    checked={creditAutoDecisions?.[row.decisionKey] === false}
                                                    disabled={disableCreditAutoDecision}
                                                    onChange={event => onCreditAutoDecisionChange(row.decisionKey, event.target.checked)}
                                                />
                                            </span>
                                        </Tooltip>
                                    ) : '—'}
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

function LedgerTable({ rows }) {
    return (
        <Table size="small" sx={{ '& td, & th': { fontSize: 11 } }}>
            <TableHead>
                <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Operación</TableCell>
                    <TableCell align="right">balanceDue→</TableCell>
                    <TableCell>Descripción</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map((l, i) => (
                    <TableRow key={`l-${i}`}>
                        <TableCell>{l.date ? String(l.date).slice(0, 10) : '—'}</TableCell>
                        <TableCell>{l.operation || '—'}</TableCell>
                        <TableCell align="right">{l.balanceDueBefore} → {l.balanceDueAfter}</TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>{l.description || '—'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
