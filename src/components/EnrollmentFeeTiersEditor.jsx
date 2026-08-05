// src/components/EnrollmentFeeTiersEditor.jsx
import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Box,
    Button,
    IconButton,
    MenuItem,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import api from '../utils/axiosConfig';

const DISCOUNT_TYPE_OPTIONS = [
    { value: 'FREE', label: 'Gratis' },
    { value: 'PERCENT', label: '% de descuento' },
    { value: 'FIXED_AMOUNT', label: 'Monto fijo de descuento (Q)' },
];

const emptyTierRow = () => ({ untilDate: '', discountType: 'PERCENT', discountValue: 0 });

/**
 * Editor de tramos de descuento de inscripción por fecha, para un colegio (fila de un ciclo específico).
 */
export default function EnrollmentFeeTiersEditor({ schoolId, draftTiers, onDraftTiersChange }) {
    const isDraft = !schoolId;
    const [tiers, setTiers] = useState(() => (isDraft && Array.isArray(draftTiers) ? draftTiers : []));
    const [loading, setLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const loadTiers = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/schools/${schoolId}/enrollment-fee-config`);
            setTiers((data?.tiers || []).map((tier) => ({
                id: tier.id,
                untilDate: tier.untilDate ? String(tier.untilDate).slice(0, 10) : '',
                discountType: tier.discountType,
                discountValue: tier.discountValue,
            })));
            setLoadFailed(false);
        } catch (err) {
            console.error('Error cargando tramos de inscripción:', err);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useEffect(() => {
        if (!isDraft) loadTiers();
    }, [isDraft, loadTiers]);

    // En modo borrador (colegio aún no creado) no hay endpoint contra qué guardar;
    // se reporta el estado al formulario padre para persistirlo tras crear el colegio.
    useEffect(() => {
        if (isDraft) onDraftTiersChange?.(tiers);
    }, [isDraft, tiers, onDraftTiersChange]);

    const handleAddRow = () => setTiers((prev) => [...prev, emptyTierRow()]);

    const handleRemoveRow = (index) => setTiers((prev) => prev.filter((_, i) => i !== index));

    const handleChangeRow = (index, field, value) => {
        setTiers((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const handleSaveTiers = async () => {
        if (loadFailed) {
            setSnackbar({ open: true, message: 'No se pudieron cargar los tramos actuales, así que no se pueden guardar cambios (evita sobrescribirlos a ciegas). Reintenta abrir el colegio.', severity: 'error' });
            return;
        }

        const invalidRow = tiers.find((row) => !row.untilDate || !row.discountType);
        if (invalidRow) {
            setSnackbar({ open: true, message: 'Cada tramo requiere fecha límite y tipo de descuento.', severity: 'error' });
            return;
        }

        setSaving(true);
        try {
            await api.put(`/schools/${schoolId}`, {
                enrollmentFeeTiers: tiers.map((row) => ({
                    untilDate: row.untilDate,
                    discountType: row.discountType,
                    discountValue: row.discountType === 'FREE' ? 0 : Number(row.discountValue) || 0,
                })),
            });
            await loadTiers();
            setSnackbar({ open: true, message: 'Tramos de inscripción guardados.', severity: 'success' });
        } catch (err) {
            console.error('Error guardando tramos de inscripción:', err);
            setSnackbar({
                open: true,
                message: err.response?.data?.message || 'Error al guardar los tramos de inscripción.',
                severity: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2">Tramos de descuento por fecha de inscripción</Typography>
            <Typography variant="caption" color="text.secondary">
                Familias que se inscriban hasta la fecha indicada reciben el descuento de ese tramo. Sin tramos configurados, se cobra el monto completo.
                {isDraft ? ' Estos tramos se guardarán al crear el colegio.' : ''}
            </Typography>

            {!isDraft && loadFailed && (
                <Alert severity="warning">
                    No se pudieron cargar los tramos actuales (permiso o error de red). No se puede guardar hasta poder verlos.
                </Alert>
            )}

            {loading ? (
                <Typography variant="body2">Cargando tramos...</Typography>
            ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Hasta fecha</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Valor</TableCell>
                            <TableCell align="right">Quitar</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tiers.map((row, index) => (
                            <TableRow key={row.id ?? `new-${index}`}>
                                <TableCell>
                                    <TextField
                                        type="date"
                                        size="small"
                                        value={row.untilDate}
                                        onChange={(e) => handleChangeRow(index, 'untilDate', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        select
                                        size="small"
                                        value={row.discountType}
                                        onChange={(e) => handleChangeRow(index, 'discountType', e.target.value)}
                                        sx={{ minWidth: 180 }}
                                    >
                                        {DISCOUNT_TYPE_OPTIONS.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                        ))}
                                    </TextField>
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        type="number"
                                        size="small"
                                        disabled={row.discountType === 'FREE'}
                                        value={row.discountType === 'FREE' ? 0 : row.discountValue}
                                        onChange={(e) => handleChangeRow(index, 'discountValue', e.target.value)}
                                        inputProps={{ min: '0', step: '0.01' }}
                                        sx={{ width: 120 }}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleRemoveRow(index)}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<Add />} onClick={handleAddRow}>Agregar tramo</Button>
                {!isDraft && (
                    <Button size="small" variant="contained" onClick={handleSaveTiers} disabled={saving || loadFailed}>
                        {saving ? 'Guardando...' : 'Guardar tramos'}
                    </Button>
                )}
            </Box>

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

EnrollmentFeeTiersEditor.propTypes = {
    schoolId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    draftTiers: PropTypes.array,
    onDraftTiersChange: PropTypes.func,
};
