// src/components/EnrollmentPaymentPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import moment from 'moment';
import api from '../utils/axiosConfig';

const STATUS_LABEL = {
    PENDIENTE: { label: 'Pendiente', color: 'warning' },
    PARCIAL: { label: 'Parcial', color: 'info' },
    PAGADO: { label: 'Pagado', color: 'success' },
};

const formatCurrency = (value) => `Q${Number(value || 0).toFixed(2)}`;

/**
 * Panel de inscripción de ciclo escolar dentro del detalle de pago de una familia (staff).
 * Muestra el estado del cargo y permite registrar un pago (al procesar la boleta subida
 * por la familia), con un descuento extraordinario/exoneración opcional aplicado dentro
 * del mismo pago — no como operación aparte. No hay contraparte para el padre.
 */
export default function EnrollmentPaymentPanel({ userId, cicloEscolarId, onSaved }) {
    const [loading, setLoading] = useState(false);
    const [enrollmentPayment, setEnrollmentPayment] = useState(null);
    const [payDialogOpen, setPayDialogOpen] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [payDiscount, setPayDiscount] = useState('');
    const [payDate, setPayDate] = useState(moment().format('YYYY-MM-DD'));
    const [payReceiptNumber, setPayReceiptNumber] = useState('');
    const [payNotes, setPayNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const loadStatus = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const params = cicloEscolarId ? { cicloEscolarId } : {};
            const { data } = await api.get(`/enrollment-payments/by-user/${userId}`, { params });
            setEnrollmentPayment(data?.enrollmentPayment || null);
        } catch (err) {
            console.error('Error cargando estado de inscripción:', err);
        } finally {
            setLoading(false);
        }
    }, [userId, cicloEscolarId]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    const handleOpenPay = () => {
        setPayAmount(enrollmentPayment ? String(enrollmentPayment.amountDue) : '');
        setPayDiscount('');
        setPayDate(moment().format('YYYY-MM-DD'));
        setPayReceiptNumber('');
        setPayNotes('');
        setPayDialogOpen(true);
    };

    const handleConfirmPay = async () => {
        if (!enrollmentPayment) return;
        const amount = Number(payAmount) || 0;
        const extraordinaryDiscount = Number(payDiscount) || 0;
        if (amount <= 0 && extraordinaryDiscount <= 0) {
            setSnackbar({ open: true, message: 'Debe indicar un monto pagado o un descuento extraordinario.', severity: 'error' });
            return;
        }
        setSaving(true);
        try {
            await api.post('/enrollment-payments/pay', {
                enrollmentPaymentId: enrollmentPayment.id,
                amount,
                extraordinaryDiscount: extraordinaryDiscount || undefined,
                realPaymentDate: payDate,
                receiptNumber: payReceiptNumber || undefined,
                notes: payNotes || undefined,
            });
            setPayDialogOpen(false);
            await loadStatus();
            setSnackbar({ open: true, message: 'Pago de inscripción registrado.', severity: 'success' });
            if (onSaved) onSaved();
        } catch (err) {
            setSnackbar({
                open: true,
                message: err.response?.data?.error || 'Error al registrar el pago.',
                severity: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (!enrollmentPayment) {
        return (
            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Esta familia no tiene cargo de inscripción para este ciclo (el colegio no tiene monto de inscripción configurado, o aún no se ha generado).
                </Typography>
            </Box>
        );
    }

    const statusInfo = STATUS_LABEL[enrollmentPayment.status] || { label: enrollmentPayment.status, color: 'default' };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6">🎓 Inscripción de Ciclo</Typography>
                <Chip label={statusInfo.label} color={statusInfo.color} size="small" />
            </Box>

            <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: 1, border: '1px solid rgba(0,0,0,0.04)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Monto original ({enrollmentPayment.studentsCount} est.)</Typography>
                    <Typography variant="body2">{formatCurrency(enrollmentPayment.originalAmount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Descuento aplicado</Typography>
                    <Typography variant="body2">{formatCurrency(enrollmentPayment.discountApplied)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Monto neto</Typography>
                    <Typography variant="body2">{formatCurrency(enrollmentPayment.netAmount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Pagado</Typography>
                    <Typography variant="body2">{formatCurrency(enrollmentPayment.amountPaid)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Saldo pendiente</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(enrollmentPayment.amountDue)}</Typography>
                </Box>
                {enrollmentPayment.manualAdjustmentAmount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Ajuste manual acumulado: {formatCurrency(enrollmentPayment.manualAdjustmentAmount)}
                        {enrollmentPayment.manualAdjustmentReason ? ` — ${enrollmentPayment.manualAdjustmentReason}` : ''}
                    </Typography>
                )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                    variant="contained"
                    onClick={handleOpenPay}
                    disabled={enrollmentPayment.amountDue <= 0}
                >
                    Registrar Pago / Exoneración
                </Button>
            </Box>

            {/* Diálogo: registrar pago (el descuento extraordinario/exoneración va en el mismo pago) */}
            <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Registrar pago de inscripción</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Monto pagado (Q)"
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        inputProps={{ min: '0', step: '0.01' }}
                        autoFocus
                    />
                    <TextField
                        label={`Descuento extraordinario / exoneración (Q, opcional, máx. Q${Number(enrollmentPayment.amountDue).toFixed(2)})`}
                        type="number"
                        value={payDiscount}
                        onChange={(e) => setPayDiscount(e.target.value)}
                        inputProps={{ min: '0', step: '0.01', max: enrollmentPayment.amountDue }}
                    />
                    <TextField
                        label="Fecha real de pago"
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="Número de boleta (opcional)"
                        value={payReceiptNumber}
                        onChange={(e) => setPayReceiptNumber(e.target.value)}
                    />
                    <TextField
                        label="Notas / motivo del descuento (opcional)"
                        multiline
                        minRows={2}
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPayDialogOpen(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmPay}
                        disabled={saving || (!Number(payAmount) && !Number(payDiscount))}
                    >
                        {saving ? 'Guardando...' : 'Registrar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

EnrollmentPaymentPanel.propTypes = {
    userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    cicloEscolarId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onSaved: PropTypes.func,
};

EnrollmentPaymentPanel.defaultProps = {
    userId: null,
    cicloEscolarId: null,
    onSaved: null,
};
