import React, { useState, useEffect } from 'react';
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
    FormGroup,
    Grid,
    Paper,
    Switch,
    FormControlLabel,
    Snackbar,
    Alert
} from '@mui/material';
import api from '../../utils/axiosConfig';
import moment from 'moment';

const PaymentDiscountModal = ({ open, onClose, payment = {}, currentDiscount = 0, onApplied = () => {} }) => {
    const [option, setOption] = useState(null);
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [applying, setApplying] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // allow fetching full payment details if the provided `payment` prop is partial
    const [fullPayment, setFullPayment] = useState(null);
    // `res.data` from backend may be { payment } or the payment object itself
    const effectivePayment = (fullPayment && (fullPayment.payment || fullPayment)) || payment;

    // unpaidPeriods may come as JSON string from backend mapping
    const unpaidPeriods = React.useMemo(() => {
        try {
            const raw = effectivePayment?.unpaidPeriods || effectivePayment?.PaymentPeriods || [];
            if (!raw) return [];
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return [];
        }
    }, [effectivePayment]);

    const currentPeriod = effectivePayment?.currentPeriod || moment().format('YYYY-MM');

    // Follow same logic as SchoolPaymentsPage for students and routeType
    const studentsArr = Array.isArray(effectivePayment?.User?.FamilyDetail?.Students) ? effectivePayment.User.FamilyDetail.Students : [];
    const derivedStudentCount = studentsArr.length || effectivePayment?.studentCount || 0;
    const familyRouteType = effectivePayment?.User?.FamilyDetail?.routeType || '';

    useEffect(() => {
        setOption(null);
        setSelectedPeriods([]);
        setSelectAll(false);
        setSnackbar({ open: false, message: '', severity: 'info' });
    }, [open]);

    useEffect(() => {
        // If modal opens and the passed payment lacks FamilyDetail, fetch full payment
        const fetchFull = async () => {
            try {
                if (!open) return;
                const hasFamily = payment?.User?.FamilyDetail;
                if (hasFamily) return; // already complete
                const id = payment?.id || effectivePayment?.id;
                if (!id) return;
                const res = await api.get(`/payments/${id}`);
                if (res?.data) setFullPayment(res.data.payment || res.data);
            } catch (e) {
                // ignore — we can still show what we have
                console.error('Error fetching full payment for modal', e);
            }
        };
        fetchFull();
    }, [open, payment]);

    const togglePeriod = (period) => {
        setSelectedPeriods(prev => prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]);
    };

    const handleToggleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            // include all pending periods
            const ids = (unpaidPeriods || []).map(p => p.period);
            setSelectedPeriods(ids);
        } else {
            setSelectedPeriods([]);
        }
    };

    const handleApply = async () => {
        if (!payment?.id) return;
        if (!option) {
            setSnackbar({ open: true, message: 'Por favor selecciona una opción antes de aplicar el descuento.', severity: 'warning' });
            return;
        }
        // Prefer the value typed in ManagePaymentsModal (currentDiscount).
        // IMPORTANT: do not use nullish coalescing with specialFee because it may be 0 by default.
        const familyFromUser = effectivePayment?.User || effectivePayment?.user || null;
        const familyFromDetail = familyFromUser?.FamilyDetail || familyFromUser?.familyDetail || null;

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

        // Si la opción es aplicar a períodos actuales/pendientes, el usuario debe
        // seleccionar al menos un período (o activar "seleccionar todos").
        if (option !== 'NEXT' && !selectAll && (!Array.isArray(selectedPeriods) || selectedPeriods.length === 0)) {
            setSnackbar({ open: true, message: 'Selecciona al menos un período antes de aplicar el descuento.', severity: 'warning' });
            return;
        }

        setApplying(true);
        try {
            let payload = { specialFee: Number(familySpecial) };
            if (option === 'NEXT') {
                payload = { ...payload, scope: 'NEXT_FROM' };
            } else {
                if (selectAll) {
                    payload = { ...payload, scope: 'ALL_PENDING' };
                } else {
                    // determine if only current selected
                    const onlyCurrent = selectedPeriods.length === 1 && selectedPeriods[0] === currentPeriod;
                    if (onlyCurrent) payload = { ...payload, scope: 'CURRENT' };
                    else payload = { ...payload, scope: 'SELECTED', periods: selectedPeriods };
                }
            }

            const res = await api.post(`/payments/v2/${payment.id}/apply-family-discount`, payload);
            onApplied(res.data);
            onClose();
        } catch (err) {
            // Evitar ruido en consola para errores de validación esperados.
            const msg = err.response?.data?.error || err.message || '';
            const isExpectedValidation = typeof msg === 'string' && (
                msg.includes('Debe proporcionar periods') ||
                msg.includes('periods')
            );
            if (!isExpectedValidation) {
                console.error('Error applying discount:', err.response?.data || err.message);
            }
            setSnackbar({
                open: true,
                message: 'Error aplicando descuento: ' + (err.response?.data?.error || err.message),
                severity: 'error'
            });
        } finally {
            setApplying(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle><strong>Aplicar Descuento Familiar</strong></DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <Paper variant="outlined" sx={(theme) => ({
                        p: 2,
                        borderColor: theme.palette.warning.main,
                        backgroundColor: alpha(theme.palette.warning.main, 0.10)
                    })}>
                        <Typography variant="body1" sx={(theme) => ({ fontWeight: 700, color: theme.palette.warning.dark })}>
                            ¿Como quieres aplicar el descuento familiar?
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                            Selecciona la opción que mejor se adapte. Puedes aplicar el descuento al mes actual y/o a los períodos pendientes, o bien a partir del siguiente período para afectar cargos futuros.
                        </Typography>
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
                                APLICAR AL MES ACTUAL
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                Selecciona el periodo actual y/o los demás períodos pendientes a los que deseas aplicar el descuento. Puedes seleccionar todos.
                            </Typography>

                            <Box sx={{ mt: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                                    <FormControlLabel control={<Switch checked={selectAll} onChange={(e) => handleToggleSelectAll(e.target.checked)} />} label="Seleccionar todos los periodos pendientes" />
                                </Box>

                                <Box sx={{ maxHeight: 220, overflow: 'auto', borderTop: '1px solid rgba(0,0,0,0.06)', pt: 1 }}>
                                    {unpaidPeriods && unpaidPeriods.length ? (
                                        unpaidPeriods.map(p => {
                                            const original = Number(p.originalAmount ?? p.amount ?? 0);
                                            const net = Number(p.netAmount ?? p.net ?? p.amount ?? 0);
                                            const discount = Math.max(0, original - net) || Number(p.discountApplied ?? p.discount ?? 0);
                                            const monthRaw = p.period ? moment(p.period + '-01').locale('es').format('MMMM YYYY') : p.period;
                                            const monthLabel = monthRaw ? (monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)) : monthRaw;
                                            const routeType = p.routeType || p.routeName || (p.route && (p.route.name || p.route.type)) || '—';
                                            return (
                                                <Box key={p.period} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, px: 1, borderBottom: '1px dashed rgba(0,0,0,0.06)' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                        <Checkbox checked={selectAll || selectedPeriods.includes(p.period)} onChange={() => togglePeriod(p.period)} disabled={selectAll} />
                                                        <Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography component="span" sx={{ fontWeight: p.period === currentPeriod ? 700 : 600 }}>{monthLabel}</Typography>
                                                                {p.period === currentPeriod && (
                                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>Periodo actual</Typography>
                                                                )}
                                                            </Box>
                                                            {(() => {
                                                                // base amount fallbacks
                                                                const baseAmount = Number(p.baseAmount ?? p.baseFee ?? p.baseTariff ?? p.routeBase ?? p.base ?? p.feeBase ?? 0);

                                                                // route/label fallbacks (many variants found in codebases)
                                                                const family = effectivePayment?.User?.FamilyDetail || {};
                                                                const routeLabelRaw = p.routeType
                                                                                        ?? p.routeName
                                                                                        ?? p.route_label
                                                                                        ?? p.routeLabel
                                                                                        ?? p.route?.name
                                                                                        ?? p.route?.label
                                                                                        ?? p.route?.type
                                                                                        ?? p.route?.description
                                                                                        ?? p.route?.title
                                                                                        ?? p.route?.displayName
                                                                                        ?? p.tariffLabel
                                                                                        ?? p.tariffName
                                                                                        ?? family.routeType
                                                                                        ?? family.routeName
                                                                                        ?? null;
                                                                const routeLabel = routeLabelRaw && String(routeLabelRaw).trim() ? String(routeLabelRaw).trim() : null;

                                                                // student count fallbacks
                                                                const studentCountRaw = p.studentCount
                                                                    ?? p.studentsCount
                                                                    ?? p.students
                                                                    ?? p.passengers
                                                                    ?? p.enrollments
                                                                    ?? p.n_students
                                                                    ?? p.countStudents
                                                                    ?? p.student_list
                                                                    ?? family.Students
                                                                    ?? family.students
                                                                    ?? null;
                                                                let studentCount = 0;
                                                                if (typeof studentCountRaw === 'number') studentCount = studentCountRaw;
                                                                else if (Array.isArray(studentCountRaw)) studentCount = studentCountRaw.length;
                                                                else if (studentCountRaw && typeof studentCountRaw === 'object' && typeof studentCountRaw.length === 'number') studentCount = studentCountRaw.length;
                                                                else studentCount = Number(studentCountRaw) || 0;

                                                                const effectiveStudentCount = studentCount || derivedStudentCount || 0;
                                                                const displayBase = baseAmount > 0
                                                                    ? baseAmount
                                                                    : (original > 0 && effectiveStudentCount > 0 ? (original / effectiveStudentCount) : 0);

                                                                return (
                                                                    <>
                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{`Tarifa base${routeLabel ? ` (${routeLabel})` : ''}`}</Typography>
                                                                                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, minWidth: 120, textAlign: 'right' }}>{`Q ${displayBase.toFixed(2)}`}</Typography>
                                                                            </Box>

                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{`Tarifa mensual${effectiveStudentCount ? ` (${effectiveStudentCount} ${effectiveStudentCount > 1 ? 'estudiantes' : 'estudiante'})` : ''}`}</Typography>
                                                                                <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${original.toFixed(2)}`}</Typography>
                                                                            </Box>
                                                                        </Box>
                                                                    </>
                                                                );
                                                            })()}
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Descuento</Typography>
                                                                <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${discount > 0 ? discount.toFixed(2) : '0.00'}`}</Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                                                <Typography component="span" sx={{ fontWeight: 700 }}>Subtotal período:</Typography>
                                                                <Typography component="span" sx={{ ml: 1, color: 'primary.main', fontWeight: 700, minWidth: 120, textAlign: 'right' }}>Q {net.toFixed(2)}</Typography>
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
                                El descuento se aplicará en los cargos futuros a partir del siguiente período. No modifica períodos ya generados.
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

export default PaymentDiscountModal;
