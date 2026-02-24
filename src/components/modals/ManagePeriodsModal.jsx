import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { esES } from '@mui/x-date-pickers/locales';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Chip,
    IconButton,
    Divider,
    TextField,
    MenuItem,
    Alert,
    CircularProgress,
    Paper
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import moment from 'moment';
import 'moment/locale/es';
import api from '../../utils/axiosConfig';

const PERIOD_RE = /^\d{4}-\d{2}$/;

const normalizePeriod = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    if (!PERIOD_RE.test(s)) return '';
    return s;
};

const ManagePeriodsModal = ({ open, onClose, payment, onChanged }) => {
    const paymentId = payment?.id;

    const autoFilledCurrentRef = useRef(false);

    const [loading, setLoading] = useState(false);
    const [serverPayment, setServerPayment] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [periodToAdd, setPeriodToAdd] = useState('');
    const [routeTypeToAdd, setRouteTypeToAdd] = useState('');
    const [discountToAdd, setDiscountToAdd] = useState('');

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);

    const currentPeriod = useMemo(() => moment().format('YYYY-MM'), []);

    const periods = useMemo(() => {
        const arr = serverPayment?.periods || serverPayment?.PaymentPeriods || [];
        return Array.isArray(arr) ? arr : [];
    }, [serverPayment]);

    const familyFromUser = serverPayment?.User || serverPayment?.user || null;
    const familyFromDetail = familyFromUser?.FamilyDetail || familyFromUser?.familyDetail || null;

    const futureRouteType = useMemo(() => {
        const v = familyFromDetail?.routeType;
        return String(v || '').trim();
    }, [familyFromDetail]);

    const futureDiscount = useMemo(() => {
        const n = Number(familyFromDetail?.specialFee ?? familyFromDetail?.discount ?? 0);
        return Number.isFinite(n) ? n : 0;
    }, [familyFromDetail]);

    const studentCountFromFamily = useMemo(() => {
        const n = Number(
            familyFromDetail?.Students?.length ||
            familyFromDetail?.studentsCount ||
            serverPayment?.studentCount ||
            1
        );
        return Math.max(1, Number.isFinite(n) ? n : 1);
    }, [familyFromDetail, serverPayment]);

    

    const existingPeriodSet = useMemo(() => {
        const set = new Set();
        periods.forEach(p => {
            if (p?.period) set.add(String(p.period));
        });
        return set;
    }, [periods]);

    const currentExists = existingPeriodSet.has(currentPeriod);

    const sortedPeriods = useMemo(() => {
        const arr = [...periods];
        arr.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
        return arr;
    }, [periods]);

    const refresh = async () => {
        if (!paymentId) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/payments/${paymentId}`);
            setServerPayment(res.data?.payment || res.data);
        } catch (e) {
            console.error('Error loading payment detail for periods', e);
            setServerPayment(null);
            setError(e?.response?.data?.error || e?.response?.data?.message || 'Error cargando períodos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        setPeriodToAdd('');
        setRouteTypeToAdd('');
        setDiscountToAdd('');
        autoFilledCurrentRef.current = false;
        setDeleteTarget(null);
        setDeleteConfirmText('');
        setError('');
        setSuccess('');
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, paymentId]);

    useEffect(() => {
        if (!open) return;
        if (loading) return;
        if (!serverPayment) return;
        if (autoFilledCurrentRef.current) return;
        if (currentExists) return;
        if (periodToAdd) return;

        setPeriodToAdd(currentPeriod);
        autoFilledCurrentRef.current = true;
    }, [open, loading, serverPayment, currentExists, periodToAdd, currentPeriod]);

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(''), 7000);
        return () => clearTimeout(t);
    }, [success]);

    const validateAdd = useCallback((period) => {
        const p = normalizePeriod(period);
        if (!p) return { ok: false, message: 'Período inválido (formato YYYY-MM)' };
        if (existingPeriodSet.has(p)) return { ok: false, message: 'Ese período ya existe' };
        if (p > currentPeriod) return { ok: false, message: 'No se puede agregar un período futuro' };
        return { ok: true };
    }, [currentPeriod, existingPeriodSet]);

    const addValidation = useMemo(() => {
        if (!periodToAdd) return { ok: false, message: '' };
        return validateAdd(periodToAdd);
    }, [periodToAdd, validateAdd]);

    const primaryAddAction = useMemo(() => {
        if (!currentExists) {
            const selected = normalizePeriod(periodToAdd);
            if (!selected || selected === currentPeriod) {
                return {
                    period: currentPeriod,
                    label: `Agregar período actual (${currentPeriod})`
                };
            }
        }

        return { period: periodToAdd, label: 'Agregar' };
    }, [currentExists, currentPeriod, periodToAdd]);

    const primaryAddValidation = useMemo(() => {
        const p = normalizePeriod(primaryAddAction.period);
        if (!p) return { ok: false, message: '' };
        return validateAdd(p);
    }, [primaryAddAction.period, validateAdd]);

    const pickerPopperSx = useMemo(() => ({
        // Compact without breaking layout: scale the whole popper content
        '& .MuiPaper-root': {
            transform: 'scale(0.9)',
            transformOrigin: 'top left'
        },
        // Prevent header label wrapping after scaling
        '& .MuiPickersCalendarHeader-label': {
            whiteSpace: 'nowrap'
        }
    }), []);

    const periodPickerValue = useMemo(() => {
        const p = normalizePeriod(periodToAdd);
        if (!p) return null;
        const m = moment(p + '-01');
        return m.isValid() ? m : null;
    }, [periodToAdd]);

    const handleAdd = async (periodOverride) => {
        const p = normalizePeriod(periodOverride || periodToAdd);
        const v = validateAdd(p);
        if (!v.ok) {
            setError(v.message);
            return;
        }

        const rt = String(routeTypeToAdd || '').trim();

        const parsedDiscount = discountToAdd === '' || discountToAdd === null || typeof discountToAdd === 'undefined'
            ? NaN
            : Number(discountToAdd);
        if (discountToAdd !== '' && (!Number.isFinite(parsedDiscount) || parsedDiscount < 0)) {
            setError('Ingresa un descuento válido (0 o mayor), o déjalo en blanco para usar el descuento actual.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const payload = { period: p };
            if (rt) payload.routeType = rt;
            if (Number.isFinite(parsedDiscount)) payload.discountApplied = parsedDiscount;

            await api.post(`/payments/v2/${paymentId}/periods`, payload);
            await refresh();
            if (onChanged) onChanged();
            setSuccess(`Período ${p} agregado correctamente.`);
            setPeriodToAdd('');
        } catch (e) {
            console.error('Error adding period', e);
            setError(e?.response?.data?.error || e?.response?.data?.message || 'Error agregando período');
        } finally {
            setLoading(false);
        }
    };

    const deletable = (p) => {
        const amountPaid = Number(p?.amountPaid || 0);
        return amountPaid === 0;
    };

    const deleteConfirmed = deleteConfirmText === 'ELIMINAR';

    const handleConfirmDelete = async () => {
        if (!deleteTarget?.period) return;
        if (!deleteConfirmed) return;

        setDeleteBusy(true);
        setError('');
        setSuccess('');
        try {
            const per = String(deleteTarget.period);
            await api.delete(`/payments/v2/${paymentId}/periods/${encodeURIComponent(per)}`);
            setDeleteTarget(null);
            setDeleteConfirmText('');
            await refresh();
            if (onChanged) onChanged();
            setSuccess(`Período ${per} eliminado correctamente.`);
        } catch (e) {
            console.error('Error deleting period', e);
            setError(e?.response?.data?.error || e?.response?.data?.message || 'Error eliminando período');
        } finally {
            setDeleteBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle><strong>Gestionar Períodos</strong></DialogTitle>
            <DialogContent>
                {!paymentId && (
                    <Alert severity="warning">No se encontró el pago seleccionado.</Alert>
                )}

                {error && (
                    <Box sx={{ mb: 2 }}>
                        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
                    </Box>
                )}

                {success && (
                    <Box sx={{ mb: 2 }}>
                        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
                    </Box>
                )}

                <Box sx={{ mb: 2 }}>
                    <Box sx={{ mb: 1 }}>
                        <Paper variant="outlined" sx={(theme) => ({
                            p: 2,
                            borderColor: theme.palette.success.main,
                            backgroundColor: alpha(theme.palette.success.main, 0.06),
                            borderRadius: 2
                        })}>
                            <Typography variant="body1" sx={(theme) => ({ fontWeight: 800, color: theme.palette.success.dark, textTransform: 'uppercase' })}>
                                📅 Agregar período
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                Seleccione un período y haga clic en <strong>Agregar</strong>. Puedes definir <strong>ruta</strong> y/o <strong>descuento</strong> solo para el período que deseas agregar.
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                Al no definirse ruta o descuento, se usará la configuración actual
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                Configuración actual: Ruta: <strong>{futureRouteType || '-'}</strong> · Descuento: <strong>Q {Number(futureDiscount || 0).toFixed(2)}</strong>
                            </Typography>
                        </Paper>
                    </Box>

                    <Paper variant="outlined" sx={(theme) => ({
                        p: 2,
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: 2
                    })}>
                        <Box
                            sx={(theme) => ({
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: 1,
                                alignItems: 'center',
                                [theme.breakpoints.up('sm')]: {
                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
                                }
                            })}
                        >
                            <LocalizationProvider
                                dateAdapter={AdapterMoment}
                                adapterLocale="es"
                                localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
                            >
                                <DatePicker
                                    label="Período"
                                    views={['year', 'month']}
                                    openTo="month"
                                    format="YYYY-MM"
                                    value={periodPickerValue}
                                    onChange={(newValue) => {
                                        if (!newValue) {
                                            setPeriodToAdd('');
                                            return;
                                        }
                                        const m = moment(newValue);
                                        setPeriodToAdd(m.isValid() ? m.format('YYYY-MM') : '');
                                    }}
                                    minDate={moment('2000-01-01')}
                                    maxDate={moment(currentPeriod + '-01')}
                                    disabled={!paymentId || loading}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            sx: { width: '100%' },
                                            InputLabelProps: { shrink: true }
                                        },
                                        popper: {
                                            sx: pickerPopperSx
                                        }
                                    }}
                                />
                            </LocalizationProvider>

                            <TextField
                                select
                                size="small"
                                label="Tipo de Ruta"
                                value={routeTypeToAdd}
                                onChange={(e) => setRouteTypeToAdd(e.target.value)}
                                disabled={!paymentId || loading}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                sx={{ minWidth: 0 }}
                                SelectProps={{
                                    displayEmpty: true,
                                    renderValue: (val) => {
                                        const v = String(val || '').trim();
                                        return v ? v : 'Config. actual';
                                    }
                                }}
                            >
                                <MenuItem value=""><em>Usar configuración actual</em></MenuItem>
                                <MenuItem value="Completa">Completa</MenuItem>
                                <MenuItem value="Media AM">Media AM</MenuItem>
                                <MenuItem value="Media PM">Media PM</MenuItem>
                            </TextField>

                            <TextField
                                size="small"
                                label="Descuento (Q)"
                                type="number"
                                inputProps={{ min: 0, step: 0.01 }}
                                placeholder={`Actual: Q ${Number(futureDiscount || 0).toFixed(2)}`}
                                value={discountToAdd}
                                onChange={(e) => setDiscountToAdd(e.target.value)}
                                disabled={!paymentId || loading}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                sx={{ minWidth: 0 }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => handleAdd(primaryAddAction.period)}
                                disabled={!paymentId || loading || !primaryAddValidation.ok}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {primaryAddAction.label}
                            </Button>
                        </Box>

                        {periodToAdd && !addValidation.ok && addValidation.message && (
                            <Box sx={{ mt: 1 }}>
                                <Alert severity="warning">{addValidation.message}</Alert>
                            </Box>
                        )}
                    </Paper>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 1 }}>
                    <Paper variant="outlined" sx={(theme) => ({
                        p: 2,
                        borderColor: theme.palette.error.main,
                        backgroundColor: alpha(theme.palette.error.main, 0.06),
                        borderRadius: 2
                    })}>
                        <Typography variant="body1" sx={(theme) => ({ fontWeight: 800, color: theme.palette.error.dark, textTransform: 'uppercase' })}>
                            🗑️ Eliminar periodos
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            Haz clic en <DeleteIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mx: 0.25 }} />para eliminar un periodo. Solo se pueden eliminar períodos sin pagos.
                        </Typography>
                    </Paper>
                </Box>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                {!loading && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{
                            maxHeight: 320,
                            overflow: 'auto',
                            borderTop: '1px solid rgba(0,0,0,0.06)'
                        }}>
                        {sortedPeriods.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                No hay períodos registrados.
                            </Typography>
                        ) : (
                            <List dense sx={{ p: 0 }}>
                                {sortedPeriods.map((p) => {
                            const per = String(p.period || '');
                            const isCurrent = per === currentPeriod;
                            const status = String(p.status || '').toUpperCase();
                            const amountPaid = Number(p.amountPaid || 0);
                            const amountDue = Number(p.amountDue ?? p.netAmount ?? 0);

                            const statusChipColor = (() => {
                                if (status === 'PAGADO') return 'success';
                                if (status === 'PARCIAL') return 'warning';
                                if (status === 'PENDIENTE') return 'warning';
                                return 'default';
                            })();

                            const monthRaw = per ? moment(per + '-01').locale('es').format('MMMM YYYY') : per;
                            const monthLabel = monthRaw ? (monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)) : monthRaw;

                                    const routeTypeForLabel = String(p.routeType || familyFromDetail?.routeType || '').trim();

                                    const original = Number(p.originalAmount ?? 0);
                                    const net = Number(p.netAmount ?? amountDue ?? 0);
                                    const baseFee = (original && studentCountFromFamily) ? (original / studentCountFromFamily) : 0;
                                    const discount = Math.max(0, original - net) || Number(p.discountApplied ?? 0);

                                    const studentsLabel = `${studentCountFromFamily} estudiante${studentCountFromFamily === 1 ? '' : 's'}`;
                                    const baseLabel = `Tarifa base${routeTypeForLabel ? ` (${routeTypeForLabel})` : ''}`;
                                    const monthlyLabel = `Tarifa mensual (${studentsLabel})`;

                                    const dueDate = p.dueDate || null;
                                    const isOverdue = (() => {
                                        if (!dueDate) return false;
                                        if (status === 'PAGADO') return false;
                                        try {
                                            return moment().isAfter(moment.parseZone(dueDate), 'day');
                                        } catch (e) {
                                            return false;
                                        }
                                    })();

                            return (
                                <ListItem
                                    key={per}
                                    sx={{ py: 1.25, px: 2, borderBottom: '1px dashed rgba(0,0,0,0.08)' }}
                                    secondaryAction={
                                        <IconButton
                                            edge="end"
                                            title={deletable(p) ? 'Eliminar período' : 'No se puede eliminar (tiene pagos)'}
                                            onClick={() => { if (deletable(p)) { setDeleteTarget(p); setDeleteConfirmText(''); } }}
                                            disabled={!deletable(p) || deleteBusy}
                                            sx={(theme) => ({
                                                color: deletable(p) ? theme.palette.text.secondary : theme.palette.action.disabled,
                                                '&:hover': deletable(p) ? {
                                                    color: theme.palette.error.main,
                                                    backgroundColor: alpha(theme.palette.error.main, 0.10)
                                                } : undefined
                                            })}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                                                    <Typography component="span" sx={{ fontWeight: isCurrent ? 700 : 600 }}>
                                                        {monthLabel}
                                                    </Typography>
                                                    {isCurrent && (
                                                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                                                            (Periodo actual)
                                                        </Typography>
                                                    )}
                                                    {status && <Chip size="small" label={status} color={statusChipColor} variant="filled" />}
                                                </Box>
                                                {isOverdue && (
                                                    <Typography
                                                        variant="caption"
                                                        color="error"
                                                        sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}
                                                    >
                                                        Vencido
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.75, pr: 6 }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{baseLabel}</Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, minWidth: 120, textAlign: 'right' }}>{`Q ${Number(baseFee || 0).toFixed(2)}`}</Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{monthlyLabel}</Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${Number(original || 0).toFixed(2)}`}</Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Descuento</Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 120, textAlign: 'right' }}>{`Q ${Number(discount || 0).toFixed(2)}`}</Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography component="span" sx={{ fontWeight: 800 }}>Subtotal período:</Typography>
                                                        <Typography component="span" sx={{ ml: 1, color: 'primary.main', fontWeight: 800, minWidth: 120, textAlign: 'right' }}>Q {Number(net || 0).toFixed(2)}</Typography>
                                                    </Box>
                                                </Box>

                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                                                    Pagado: Q {amountPaid.toFixed(2)} · Pendiente: Q {amountDue.toFixed(2)}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            );
                                })}
                            </List>
                        )}
                        </Box>
                    </Paper>
                )}

                {/* Delete confirmation inline dialog */}
                <Dialog
                    open={!!deleteTarget}
                    onClose={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteConfirmText(''); } }}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>Eliminar período</DialogTitle>
                    <DialogContent>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Esta acción elimina el período por completo.
                        </Alert>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Para confirmar, escriba <strong>ELIMINAR</strong>.
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="ELIMINAR"
                            disabled={deleteBusy}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteConfirmText(''); } }} disabled={deleteBusy}>Cancelar</Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleConfirmDelete}
                            disabled={deleteBusy || !deleteConfirmed}
                        >
                            Eliminar
                        </Button>
                    </DialogActions>
                </Dialog>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={deleteBusy}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(ManagePeriodsModal);
