import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    TextField,
    Typography,
    Divider,
    Alert,
    IconButton,
    Checkbox,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    Paper,
    CircularProgress,
    InputAdornment,
    useMediaQuery,
    useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import moment from 'moment';
import api from '../../utils/axiosConfig';
import { ServiceStatusChip } from '../PaymentTable';
import { useCurrentDate } from '../../hooks/useCurrentDate';

const formatMoney = (value) => `Q ${Number(value || 0).toFixed(2)}`;

const emptyDetail = (creditBalance, todayStr) => ({
    refundDate: todayStr,
    referenceNumber: '',
    amount: Number(creditBalance || 0).toFixed(2),
    notes: ''
});

function validateDetail(detail, creditBalance, todayMoment) {
    const errors = {};

    if (!detail.refundDate) {
        errors.refundDate = 'Requerida';
    } else if (!moment(detail.refundDate, 'YYYY-MM-DD', true).isValid()) {
        errors.refundDate = 'Fecha inválida';
    } else if (moment(detail.refundDate, 'YYYY-MM-DD').isAfter(todayMoment, 'day')) {
        errors.refundDate = 'No puede ser futura';
    }

    if (!detail.referenceNumber || !detail.referenceNumber.trim()) {
        errors.referenceNumber = 'Requerido';
    }

    const amountNum = Number.parseFloat(detail.amount);
    const creditNum = Number(creditBalance || 0);
    if (detail.amount === '' || Number.isNaN(amountNum)) {
        errors.amount = 'Requerido';
    } else if (amountNum <= 0) {
        errors.amount = 'Debe ser mayor a 0';
    } else if (amountNum > creditNum + 0.001) {
        errors.amount = 'Excede el crédito disponible';
    } else if (Math.abs(Math.round(amountNum * 100) / 100 - amountNum) > 0.0001) {
        errors.amount = 'Máximo 2 decimales';
    }

    return errors;
}

const CreditRefundModal = ({ open, onClose, schoolId, cicloEscolarId, buildPaymentParams, onApplied }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { format: formatCurrentDate, moment: currentDateMoment } = useCurrentDate();

    const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'result'
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [cicloEscolar, setCicloEscolar] = useState(null);
    const [families, setFamilies] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [details, setDetails] = useState({}); // paymentId -> detail
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [results, setResults] = useState(null);

    const todayStr = formatCurrentDate('YYYY-MM-DD');

    const reset = useCallback(() => {
        setStep('form');
        setLoading(false);
        setLoadError('');
        setCicloEscolar(null);
        setFamilies([]);
        setSelected(new Set());
        setDetails({});
        setSearch('');
        setSubmitting(false);
        setSubmitError('');
        setResults(null);
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose && onClose();
    }, [reset, onClose]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        api.get('/payments/v2/credit-refunds/candidates', { params: buildPaymentParams ? buildPaymentParams() : { schoolId, cicloEscolarId } })
            .then((res) => {
                if (cancelled) return;
                const data = res?.data || {};
                setCicloEscolar(data.cicloEscolar || null);
                setFamilies(Array.isArray(data.families) ? data.families : []);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err?.response?.data?.error || 'Error al cargar las familias con crédito a favor');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, schoolId, cicloEscolarId]);

    const filteredFamilies = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return families;
        return families.filter((f) => (f.familyLastName || '').toLowerCase().includes(q));
    }, [families, search]);

    const familyById = useMemo(() => {
        const map = new Map();
        families.forEach((f) => map.set(f.paymentId, f));
        return map;
    }, [families]);

    const toggleFamily = (family) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(family.paymentId)) {
                next.delete(family.paymentId);
            } else {
                next.add(family.paymentId);
                setDetails((d) => (d[family.paymentId] ? d : {
                    ...d,
                    [family.paymentId]: emptyDetail(family.creditBalance, todayStr)
                }));
            }
            return next;
        });
    };

    const toggleAll = () => {
        const allIds = filteredFamilies.map((f) => f.paymentId);
        const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                allIds.forEach((id) => next.delete(id));
            } else {
                allIds.forEach((id) => next.add(id));
                setDetails((d) => {
                    const merged = { ...d };
                    allIds.forEach((id) => {
                        if (!merged[id]) {
                            const fam = familyById.get(id);
                            merged[id] = emptyDetail(fam?.creditBalance, todayStr);
                        }
                    });
                    return merged;
                });
            }
            return next;
        });
    };

    const updateDetail = (paymentId, field, value) => {
        setDetails((d) => ({
            ...d,
            [paymentId]: { ...(d[paymentId] || emptyDetail(0, todayStr)), [field]: value }
        }));
    };

    const selectedFamilies = useMemo(
        () => families.filter((f) => selected.has(f.paymentId)),
        [families, selected]
    );

    const detailErrorsById = useMemo(() => {
        const map = new Map();
        selectedFamilies.forEach((f) => {
            const detail = details[f.paymentId] || emptyDetail(f.creditBalance, todayStr);
            map.set(f.paymentId, validateDetail(detail, f.creditBalance, currentDateMoment()));
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFamilies, details, todayStr]);

    const validSelectedFamilies = useMemo(
        () => selectedFamilies.filter((f) => Object.keys(detailErrorsById.get(f.paymentId) || {}).length === 0),
        [selectedFamilies, detailErrorsById]
    );

    const validTotal = useMemo(
        () => validSelectedFamilies.reduce((sum, f) => {
            const detail = details[f.paymentId] || {};
            return sum + (Number.parseFloat(detail.amount) || 0);
        }, 0),
        [validSelectedFamilies, details]
    );

    const canSubmit = selectedFamilies.length > 0 && validSelectedFamilies.length === selectedFamilies.length;

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError('');
        try {
            const refunds = selectedFamilies.map((f) => {
                const detail = details[f.paymentId] || {};
                return {
                    paymentId: f.paymentId,
                    amount: Number.parseFloat(detail.amount),
                    refundDate: detail.refundDate,
                    referenceNumber: detail.referenceNumber.trim(),
                    notes: detail.notes ? detail.notes.trim() : ''
                };
            });
            const res = await api.post('/payments/v2/credit-refunds', {
                schoolId,
                cicloEscolarId,
                refunds
            });
            setResults(res?.data || null);
            setStep('result');
        } catch (err) {
            setSubmitError(err?.response?.data?.error || 'Error al registrar los reintegros');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinish = () => {
        const processed = results?.processed || 0;
        const message = processed > 0
            ? `Se reintegraron ${processed} crédito${processed === 1 ? '' : 's'} a favor por ${formatMoney(results?.totalRefunded)}`
            : null;
        reset();
        onClose && onClose();
        if (onApplied) onApplied(message);
    };

    const totalCreditBalance = families.reduce((sum, f) => sum + Number(f.creditBalance || 0), 0);
    const allFilteredSelected = filteredFamilies.length > 0 && filteredFamilies.every((f) => selected.has(f.paymentId));
    const someFilteredSelected = filteredFamilies.some((f) => selected.has(f.paymentId));

    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : handleClose}
            fullWidth
            maxWidth="sm"
            fullScreen={isMobile}
            PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 } } }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                backgroundColor: 'primary.main',
                color: 'white',
                py: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <ReplyIcon />
                    <Box>
                        <Typography variant="h6" component="div">
                            Reintegrar crédito a favor
                        </Typography>
                        {cicloEscolar && (
                            <Typography variant="body2" sx={{ opacity: 0.95 }}>
                                {cicloEscolar.label || cicloEscolar.nombre}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <IconButton onClick={handleClose} sx={{ color: 'white' }} size="small" disabled={submitting}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
                {step === 'form' && (
                    <>
                        {loading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={28} />
                            </Box>
                        )}

                        {!loading && loadError && (
                            <Alert severity="error" sx={{ mt: 1 }}>{loadError}</Alert>
                        )}

                        {!loading && !loadError && families.length === 0 && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                Ninguna familia de este ciclo tiene crédito a favor.
                            </Alert>
                        )}

                        {!loading && !loadError && families.length > 0 && (
                            <>
                                {cicloEscolar?.activo && (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        El ciclo escolar está activo. El crédito que se devuelva ya no se aplicará a los cargos de los meses siguientes.
                                    </Alert>
                                )}

                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    1. Seleccionar familias
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {families.length} familia{families.length === 1 ? '' : 's'} con crédito a favor · Total disponible {formatMoney(totalCreditBalance)}
                                </Typography>
                                <TextField
                                    placeholder="Buscar familia…"
                                    size="small"
                                    fullWidth
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    sx={{ mb: 2, maxWidth: { sm: 320 } }}
                                />

                                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 320 }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={allFilteredSelected}
                                                        indeterminate={!allFilteredSelected && someFilteredSelected}
                                                        onChange={toggleAll}
                                                    />
                                                </TableCell>
                                                <TableCell>Familia</TableCell>
                                                <TableCell>Estado del servicio</TableCell>
                                                <TableCell align="right">Crédito a favor</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredFamilies.map((family) => (
                                                <TableRow
                                                    key={family.paymentId}
                                                    hover
                                                    selected={selected.has(family.paymentId)}
                                                    onClick={() => toggleFamily(family)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell padding="checkbox">
                                                        <Checkbox checked={selected.has(family.paymentId)} onChange={() => toggleFamily(family)} onClick={(e) => e.stopPropagation()} />
                                                    </TableCell>
                                                    <TableCell>{family.familyLastName || '-'}</TableCell>
                                                    <TableCell>
                                                        <ServiceStatusChip serviceStatus={family.serviceStatus} isDeleted={false} />
                                                    </TableCell>
                                                    <TableCell align="right">{formatMoney(family.creditBalance)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        2. Detalles del reintegro
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {validSelectedFamilies.length} familia{validSelectedFamilies.length === 1 ? '' : 's'} · {formatMoney(validTotal)}
                                    </Typography>
                                </Box>

                                {selectedFamilies.length === 0 && (
                                    <Alert severity="info">Selecciona al menos una familia para capturar los datos del reintegro.</Alert>
                                )}

                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    {selectedFamilies.map((family) => {
                                        const detail = details[family.paymentId] || emptyDetail(family.creditBalance, todayStr);
                                        const errors = detailErrorsById.get(family.paymentId) || {};
                                        const hasErrors = Object.keys(errors).length > 0;
                                        const amountNum = Number.parseFloat(detail.amount);
                                        const isPartial = !Number.isNaN(amountNum) && amountNum > 0 && amountNum < Number(family.creditBalance || 0) - 0.001;
                                        const remaining = Number(family.creditBalance || 0) - (Number.isNaN(amountNum) ? 0 : amountNum);

                                        return (
                                            <Paper
                                                key={family.paymentId}
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    borderColor: hasErrors ? 'error.main' : undefined,
                                                    borderWidth: hasErrors ? 2 : 1
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                                    <Typography variant="subtitle2" fontWeight="bold">{family.familyLastName || '-'}</Typography>
                                                    <Typography variant="body2" color="text.secondary">Crédito {formatMoney(family.creditBalance)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                                                    <TextField
                                                        label="Fecha del reintegro"
                                                        type="date"
                                                        size="small"
                                                        fullWidth
                                                        InputLabelProps={{ shrink: true }}
                                                        value={detail.refundDate}
                                                        onChange={(e) => updateDetail(family.paymentId, 'refundDate', e.target.value)}
                                                        error={!!errors.refundDate}
                                                        helperText={errors.refundDate || ' '}
                                                    />
                                                    <TextField
                                                        label="No. de referencia"
                                                        size="small"
                                                        fullWidth
                                                        value={detail.referenceNumber}
                                                        onChange={(e) => updateDetail(family.paymentId, 'referenceNumber', e.target.value)}
                                                        error={!!errors.referenceNumber}
                                                        helperText={errors.referenceNumber || ' '}
                                                    />
                                                    <TextField
                                                        label="Monto a reintegrar"
                                                        type="number"
                                                        size="small"
                                                        fullWidth
                                                        inputProps={{ step: '0.01', min: 0 }}
                                                        InputProps={{ startAdornment: <InputAdornment position="start">Q</InputAdornment> }}
                                                        value={detail.amount}
                                                        onChange={(e) => updateDetail(family.paymentId, 'amount', e.target.value)}
                                                        error={!!errors.amount}
                                                        helperText={errors.amount || ' '}
                                                    />
                                                </Box>
                                                <TextField
                                                    label="Nota (opcional)"
                                                    size="small"
                                                    fullWidth
                                                    multiline
                                                    minRows={1}
                                                    sx={{ mt: 1 }}
                                                    value={detail.notes}
                                                    onChange={(e) => updateDetail(family.paymentId, 'notes', e.target.value)}
                                                />
                                                {isPartial && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                                        ⓘ Reintegro parcial · queda {formatMoney(remaining)} a favor
                                                    </Typography>
                                                )}
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            </>
                        )}
                    </>
                )}

                {step === 'confirm' && (
                    <Box>
                        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Familia</TableCell>
                                        <TableCell align="right">Monto</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {validSelectedFamilies.map((family) => {
                                        const detail = details[family.paymentId] || {};
                                        const amount = Number.parseFloat(detail.amount) || 0;
                                        return (
                                            <TableRow key={family.paymentId}>
                                                <TableCell>{family.familyLastName || '-'}</TableCell>
                                                <TableCell align="right">{formatMoney(amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    <TableRow sx={{ fontWeight: 'bold', backgroundColor: 'action.hover' }}>
                                        <TableCell>Total ({validSelectedFamilies.length} reintegro{validSelectedFamilies.length === 1 ? '' : 's'})</TableCell>
                                        <TableCell align="right">{formatMoney(validTotal)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {submitError && <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>}
                    </Box>
                )}

                {step === 'result' && results && (
                    <Box>
                        <Alert severity={results.failed > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                            {results.processed} reintegro{results.processed === 1 ? '' : 's'} registrado{results.processed === 1 ? '' : 's'} por {formatMoney(results.totalRefunded)}
                            {results.failed > 0 ? ` · ${results.failed} con error` : ''}
                        </Alert>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell></TableCell>
                                        <TableCell>Familia</TableCell>
                                        <TableCell align="right">Monto / Motivo</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(results.results || []).map((r) => (
                                        <TableRow key={r.paymentId}>
                                            <TableCell>
                                                {r.ok
                                                    ? <CheckCircleIcon fontSize="small" color="success" />
                                                    : <CancelIcon fontSize="small" color="error" />}
                                            </TableCell>
                                            <TableCell>{r.familyLastName || `Pago #${r.paymentId}`}</TableCell>
                                            <TableCell align="right">
                                                {r.ok ? formatMoney(r.amount) : r.error}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 3, py: 2 }}>
                {step === 'form' && (loading || loadError || families.length === 0) && (
                    <Button onClick={handleClose}>Cerrar</Button>
                )}
                {step === 'form' && !loading && !loadError && families.length > 0 && (
                    <>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!canSubmit}
                            onClick={() => setStep('confirm')}
                        >
                            Reintegrar crédito
                        </Button>
                    </>
                )}
                {step === 'confirm' && (
                    <>
                        <Button onClick={() => setStep('form')} disabled={submitting}>Cancelar</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting
                                ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={18} color="inherit" /><span>Procesando…</span></Box>
                                : 'Confirmar reintegro'}
                        </Button>
                    </>
                )}
                {step === 'result' && (
                    <Button variant="contained" color="primary" onClick={handleFinish}>Cerrar</Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(CreditRefundModal);
