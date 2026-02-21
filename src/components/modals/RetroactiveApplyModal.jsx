import React, { useEffect, useMemo, useState } from 'react';
import { alpha } from '@mui/material/styles';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Checkbox,
    Paper,
    Switch,
    FormControlLabel,
    Snackbar,
    Alert
} from '@mui/material';
import api from '../../utils/axiosConfig';
import moment from 'moment';

/**
 * Modal genérico para aplicar cambios de forma retroactiva con alcance por períodos.
 * Soporta 2 modos:
 * - mode="DISCOUNT": aplica descuento familiar (/payments/v2/:id/apply-family-discount)
 * - mode="ROUTE_TYPE": aplica tipo de ruta (/payments/v2/:id/apply-family-route-type)
 */
const RetroactiveApplyModal = ({
    open,
    onClose,
    mode = 'DISCOUNT',

    // Identificación del pago/familia
    payment: paymentProp = null,
    userId = null,

    // Inputs por modo
    currentDiscount = 0,
    routeType = '',

    onApplied = () => {}
}) => {
    const normalizedMode = String(mode || 'DISCOUNT').toUpperCase();

    const [option, setOption] = useState(null);
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [applying, setApplying] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // allow fetching full payment details if the provided `payment` prop is partial
    const [payment, setPayment] = useState(null);
    const [fullPayment, setFullPayment] = useState(null);

    const effectivePayment = (
        (fullPayment && (fullPayment.payment || fullPayment)) ||
        (payment && (payment.payment || payment)) ||
        (paymentProp && (paymentProp.payment || paymentProp)) ||
        null
    );

    const unpaidPeriods = useMemo(() => {
        try {
            const raw = effectivePayment?.unpaidPeriods || effectivePayment?.PaymentPeriods || [];
            if (!raw) return [];
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return [];
        }
    }, [effectivePayment]);

    const currentPeriod = effectivePayment?.currentPeriod || moment().format('YYYY-MM');

    const familyFromUser = effectivePayment?.User || effectivePayment?.user || null;
    const familyFromDetail = familyFromUser?.FamilyDetail || familyFromUser?.familyDetail || null;

    const currentFamilyRouteType = familyFromDetail?.routeType || '';

    useEffect(() => {
        setOption(null);
        setSelectedPeriods([]);
        setSelectAll(false);
        setApplying(false);
        setSnackbar({ open: false, message: '', severity: 'info' });
        setPayment(null);
        setFullPayment(null);
    }, [open]);

    useEffect(() => {
        const fetchPaymentByUser = async () => {
            try {
                if (!open) return;
                if (!userId) return;
                if (paymentProp?.id) return; // prefer explicit payment when provided

                const res = await api.get(`/payments/by-user/${userId}`);
                const p = res.data?.payment || res.data || null;
                setPayment(p);
            } catch (err) {
                console.error('Error fetching payment by user for modal:', err?.response?.data || err.message);
                setSnackbar({ open: true, message: 'No se pudo cargar el pago de la familia.', severity: 'error' });
            }
        };
        fetchPaymentByUser();
    }, [open, userId, paymentProp?.id]);

    useEffect(() => {
        // If modal opens and the effective payment lacks FamilyDetail, fetch full payment
        const fetchFull = async () => {
            try {
                if (!open) return;
                const hasFamily = effectivePayment?.User?.FamilyDetail || effectivePayment?.user?.FamilyDetail;
                if (hasFamily) return;

                const id = effectivePayment?.id || paymentProp?.id;
                if (!id) return;
                const res = await api.get(`/payments/${id}`);
                if (res?.data) setFullPayment(res.data.payment || res.data);
            } catch (e) {
                // ignore — we can still show what we have
            }
        };
        fetchFull();
    }, [open, effectivePayment?.id, paymentProp?.id]);

    const togglePeriod = (period) => {
        setSelectedPeriods(prev => prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]);
    };

    const handleToggleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            const ids = (unpaidPeriods || []).map(p => p.period);
            setSelectedPeriods(ids);
        } else {
            setSelectedPeriods([]);
        }
    };

    const getHeader = () => {
        if (normalizedMode === 'ROUTE_TYPE') return 'Aplicar Cambio de Tipo de Ruta';
        return 'Aplicar Descuento Familiar';
    };

    const getIntroTitle = () => {
        if (normalizedMode === 'ROUTE_TYPE') return '¿Cómo quieres aplicar el cambio de tipo de ruta?';
        return '¿Como quieres aplicar el descuento familiar?';
    };

    const getIntroBody = () => {
        if (normalizedMode === 'ROUTE_TYPE') {
            return (
                <>
                    <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                        Nuevo tipo de ruta: <strong>{String(routeType || '—')}</strong>
                        {currentFamilyRouteType ? <> (actual: <strong>{currentFamilyRouteType}</strong>)</> : null}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                        Puedes aplicar el cambio al mes actual y/o a los períodos pendientes, o bien a partir del siguiente período para afectar cargos futuros.
                    </Typography>
                </>
            );
        }

        return (
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                Selecciona la opción que mejor se adapte. Puedes aplicar el descuento al mes actual y/o a los períodos pendientes, o bien a partir del siguiente período para afectar cargos futuros.
            </Typography>
        );
    };

    const handleApply = async () => {
        const paymentId = effectivePayment?.id || paymentProp?.id;
        if (!paymentId) {
            setSnackbar({ open: true, message: 'No se encontró un pago asociado.', severity: 'warning' });
            return;
        }

        if (!option) {
            setSnackbar({ open: true, message: 'Por favor selecciona una opción antes de aplicar.', severity: 'warning' });
            return;
        }

        // Validación específica por modo
        if (normalizedMode === 'ROUTE_TYPE') {
            const newRouteType = String(routeType || '').trim();
            if (!newRouteType) {
                setSnackbar({ open: true, message: 'Selecciona un tipo de ruta antes de aplicar.', severity: 'warning' });
                return;
            }
        } else {
            const hasTypedDiscount = currentDiscount !== '' && currentDiscount !== null && typeof currentDiscount !== 'undefined';
            const typedDiscount = hasTypedDiscount ? Number(currentDiscount) : NaN;
            const configuredDiscount = Number(familyFromDetail?.specialFee ?? 0);

            const typedIsValid = Number.isFinite(typedDiscount) && typedDiscount >= 0;
            const configuredIsValid = Number.isFinite(configuredDiscount) && configuredDiscount >= 0;
            const familySpecial = typedIsValid ? typedDiscount : (configuredIsValid ? configuredDiscount : 0);

            if (!Number.isFinite(familySpecial) || familySpecial < 0) {
                setSnackbar({ open: true, message: 'Ingresa un descuento familiar válido (0 o mayor) antes de aplicar.', severity: 'warning' });
                return;
            }
        }

        if (option !== 'NEXT' && !selectAll && (!Array.isArray(selectedPeriods) || selectedPeriods.length === 0)) {
            setSnackbar({ open: true, message: 'Selecciona al menos un período antes de aplicar.', severity: 'warning' });
            return;
        }

        setApplying(true);
        try {
            let endpoint = '';
            let basePayload = {};

            if (normalizedMode === 'ROUTE_TYPE') {
                endpoint = `/payments/v2/${paymentId}/apply-family-route-type`;
                basePayload = { routeType: String(routeType || '').trim() };
            } else {
                endpoint = `/payments/v2/${paymentId}/apply-family-discount`;

                const hasTypedDiscount = currentDiscount !== '' && currentDiscount !== null && typeof currentDiscount !== 'undefined';
                const typedDiscount = hasTypedDiscount ? Number(currentDiscount) : NaN;
                const configuredDiscount = Number(familyFromDetail?.specialFee ?? 0);

                const typedIsValid = Number.isFinite(typedDiscount) && typedDiscount >= 0;
                const configuredIsValid = Number.isFinite(configuredDiscount) && configuredDiscount >= 0;
                const familySpecial = typedIsValid ? typedDiscount : (configuredIsValid ? configuredDiscount : 0);

                basePayload = { specialFee: Number(familySpecial) };
            }

            let payload = { ...basePayload };

            if (option === 'NEXT') {
                payload = { ...payload, scope: 'NEXT_FROM' };
            } else {
                if (selectAll) {
                    payload = { ...payload, scope: 'ALL_PENDING' };
                } else {
                    const onlyCurrent = selectedPeriods.length === 1 && selectedPeriods[0] === currentPeriod;
                    if (onlyCurrent) payload = { ...payload, scope: 'CURRENT' };
                    else payload = { ...payload, scope: 'SELECTED', periods: selectedPeriods };
                }
            }

            const res = await api.post(endpoint, payload);
            onApplied(res.data);
            onClose();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || '';
            const isExpectedValidation = typeof msg === 'string' && (
                msg.includes('Debe proporcionar periods') ||
                msg.includes('periods') ||
                msg.includes('Scope')
            );
            if (!isExpectedValidation) {
                console.error('Error applying scoped change:', err.response?.data || err.message);
            }

            const prefix = normalizedMode === 'ROUTE_TYPE'
                ? 'Error aplicando cambio de tipo de ruta: '
                : 'Error aplicando descuento: ';

            setSnackbar({
                open: true,
                message: prefix + (err.response?.data?.error || err.message),
                severity: 'error'
            });
        } finally {
            setApplying(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle><strong>{getHeader()}</strong></DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <Paper variant="outlined" sx={(theme) => ({
                        p: 2,
                        borderColor: theme.palette.warning.main,
                        backgroundColor: alpha(theme.palette.warning.main, 0.10)
                    })}>
                        <Typography variant="body1" sx={(theme) => ({ fontWeight: 700, color: theme.palette.warning.dark })}>
                            {getIntroTitle()}
                        </Typography>
                        {getIntroBody()}
                    </Paper>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ width: '100%' }}>
                        <Paper
                            variant="outlined"
                            sx={(theme) => ({
                                p: 2,
                                cursor: 'pointer',
                                borderColor: option === 'CURRENT_OR_PENDING' ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.5),
                                backgroundColor: option === 'CURRENT_OR_PENDING' ? alpha(theme.palette.primary.main, 0.06) : theme.palette.background.paper,
                                transition: 'transform 200ms, box-shadow 200ms, border-color 200ms, background-color 200ms',
                                boxShadow: option === 'CURRENT_OR_PENDING' ? theme.shadows[2] : 'none',
                                borderRadius: 2,
                                '&:hover': {
                                    transform: 'translateY(-3px)',
                                    boxShadow: theme.shadows[3],
                                    borderColor: theme.palette.primary.main,
                                    backgroundColor: option === 'CURRENT_OR_PENDING' ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.03)
                                }
                            })}
                            onClick={() => setOption('CURRENT_OR_PENDING')}
                        >
                            <Typography variant="subtitle1" sx={(theme) => ({ textTransform: 'uppercase', fontWeight: 700, color: theme.palette.primary.main, display: 'flex', alignItems: 'center' })}>
                                <Box component="span" sx={{ mr: 1, fontSize: 18 }}>📅</Box>
                                APLICAR AL PERIODO ACTUAL Y/O PERÍODOS PENDIENTES
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                Selecciona el periodo actual y/o los demás períodos pendientes a los que deseas aplicar. Puedes seleccionar todos.
                            </Typography>

                            <Box sx={{ mt: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                                    <FormControlLabel
                                        control={<Switch checked={selectAll} onChange={(e) => handleToggleSelectAll(e.target.checked)} />}
                                        label="Seleccionar todos los periodos pendientes"
                                    />
                                </Box>

                                <Box sx={{ maxHeight: 220, overflow: 'auto', borderTop: '1px solid rgba(0,0,0,0.06)', pt: 1 }}>
                                    {unpaidPeriods && unpaidPeriods.length ? (
                                        unpaidPeriods.map(p => {
                                            const original = Number(p.originalAmount ?? p.amount ?? 0);
                                            const net = Number(p.netAmount ?? p.net ?? p.amount ?? 0);

                                            const studentCountFromFamily = Number(
                                                familyFromDetail?.Students?.length || familyFromDetail?.studentsCount || effectivePayment?.studentCount || 1
                                            );
                                            const studentCount = Math.max(1, studentCountFromFamily || 1);

                                            const routeTypeForLabel = String(p.routeType || currentFamilyRouteType || routeType || '').trim();

                                            const baseFromPeriod = original / studentCount;
                                            const baseFee = Number.isFinite(baseFromPeriod) ? baseFromPeriod : 0;
                                            const monthlyFee = original;

                                            const discount = Math.max(0, monthlyFee - net) || Number(p.discountApplied ?? p.discount ?? 0);
                                            const monthRaw = p.period ? moment(p.period + '-01').locale('es').format('MMMM YYYY') : p.period;
                                            const monthLabel = monthRaw ? (monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)) : monthRaw;

                                            const studentsLabel = `${studentCount} estudiante${studentCount === 1 ? '' : 's'}`;

                                            // Keep old labels exactly as the previous modal
                                            const baseLabel = `Tarifa base${routeTypeForLabel ? ` (${routeTypeForLabel})` : ''}`;
                                            const monthlyLabel = `Tarifa mensual (${studentsLabel})`;

                                            return (
                                                <Box key={p.period} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, px: 1, borderBottom: '1px dashed rgba(0,0,0,0.06)' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                        <Checkbox checked={selectAll || selectedPeriods.includes(p.period)} onChange={() => togglePeriod(p.period)} disabled={selectAll} />
                                                        <Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography component="span" sx={{ fontWeight: p.period === currentPeriod ? 700 : 600 }}>{monthLabel}</Typography>
                                                                {p.period === currentPeriod && (
                                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>(Periodo actual)</Typography>
                                                                )}
                                                            </Box>

                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{baseLabel}</Typography>
                                                                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, minWidth: 120, textAlign: 'right' }}>{`Q ${Number(baseFee || 0).toFixed(2)}`}</Typography>
                                                                </Box>

                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{monthlyLabel}</Typography>
                                                                    <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${Number(monthlyFee || 0).toFixed(2)}`}</Typography>
                                                                </Box>

                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Descuento</Typography>
                                                                    <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${discount > 0 ? discount.toFixed(2) : '0.00'}`}</Typography>
                                                                </Box>

                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Typography component="span" sx={{ fontWeight: 700 }}>Subtotal período:</Typography>
                                                                    <Typography component="span" sx={{ ml: 1, color: 'primary.main', fontWeight: 700, minWidth: 120, textAlign: 'right' }}>Q {net.toFixed(2)}</Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                    <Box>
                                                        {p.isOverdue && <Typography variant="caption" color="error">Vencido</Typography>}
                                                    </Box>
                                                </Box>
                                            );
                                        })
                                    ) : (
                                        <Typography variant="body2">No hay períodos pendientes disponibles.</Typography>
                                    )}
                                </Box>
                            </Box>
                        </Paper>
                    </Box>

                    <Box sx={{ width: '100%' }}>
                        <Paper
                            variant="outlined"
                            sx={(theme) => ({
                                p: 2,
                                cursor: 'pointer',
                                borderColor: option === 'NEXT' ? theme.palette.secondary.main : alpha(theme.palette.secondary.main, 0.5),
                                backgroundColor: option === 'NEXT' ? alpha(theme.palette.secondary.main, 0.06) : theme.palette.background.paper,
                                transition: 'transform 200ms, box-shadow 200ms, border-color 200ms, background-color 200ms',
                                boxShadow: option === 'NEXT' ? theme.shadows[2] : 'none',
                                borderRadius: 2,
                                '&:hover': {
                                    transform: 'translateY(-3px)',
                                    boxShadow: theme.shadows[3],
                                    borderColor: theme.palette.secondary.main,
                                    backgroundColor: option === 'NEXT' ? alpha(theme.palette.secondary.main, 0.12) : alpha(theme.palette.secondary.main, 0.03)
                                }
                            })}
                            onClick={() => setOption('NEXT')}
                        >
                            <Typography variant="subtitle1" sx={(theme) => ({ textTransform: 'uppercase', fontWeight: 700, color: theme.palette.secondary.main, display: 'flex', alignItems: 'center' })}>
                                <Box component="span" sx={{ mr: 1, fontSize: 18 }}>📅</Box>
                                APLICAR AL SIGUIENTE PERIODO
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                {normalizedMode === 'ROUTE_TYPE'
                                    ? 'El cambio se aplicará en los cargos futuros a partir del siguiente período. No modifica períodos ya generados.'
                                    : 'El descuento se aplicará en los cargos futuros a partir del siguiente período. No modifica períodos ya generados.'}
                            </Typography>
                        </Paper>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={applying}>Cancelar</Button>
                <Button variant="contained" onClick={handleApply} disabled={applying}>
                    {applying ? 'Aplicando...' : 'Aplicar'}
                </Button>
            </DialogActions>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
};

export default RetroactiveApplyModal;
