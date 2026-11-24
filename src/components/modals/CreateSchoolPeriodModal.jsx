import React, { useState } from 'react';
import { Box, TextField, Alert, Grid, Typography, Divider, Checkbox, FormControlLabel } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { esES } from '@mui/x-date-pickers/locales';
import moment from 'moment';
import api from '../../utils/axiosConfig';
import AppDialog from '../dialogs/AppDialog';
import MoneyField from '../form/MoneyField';

const CreateSchoolPeriodModal = ({ open, onClose, schoolId, onCreated, schoolSchedules = null }) => {
    const [period, setPeriod] = useState('');
    const [originalAmount, setOriginalAmount] = useState('');
    const [dueDateEnd, setDueDateEnd] = useState(null);
    const [noAccruePenalty, setNoAccruePenalty] = useState(false);
    const [applyFamilyDiscounts, setApplyFamilyDiscounts] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        setPeriod('');
        setOriginalAmount('');
        setError('');
        setDueDateEnd(null);
        setNoAccruePenalty(false);
        setApplyFamilyDiscounts(false);
    };

    const handleClose = () => {
        reset();
        onClose?.();
    };

    const handleCreate = async () => {
        // basic validation
        if (!period) { setError('Selecciona un período (YYYY-MM)'); return; }
        if (originalAmount === '' || Number.isNaN(Number(originalAmount))) { setError('Ingresa la cantidad (Q) del periodo'); return; }
        if (!dueDateEnd) { setError('Selecciona la fecha de vencimiento (YYYY-MM-DD)'); return; }
        const payload = { period };
        // Enviar la tarifa base; las fechas de facturación se establecen en backend (fecha de creación).
        payload.originalAmount = Number(originalAmount);
        if (dueDateEnd) {
            payload.dueDateEnd = dueDateEnd.format('YYYY-MM-DD');
        }
        if (schoolId) {
            payload.schoolId = schoolId;
        }
        // Indica en la UI que este periodo no debe acumular mora (backend debe interpretar si aplica)
        if (noAccruePenalty) {
            payload.noAccruePenalty = true;
        }
        if (applyFamilyDiscounts) {
            payload.applyFamilyDiscounts = true;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.post('/payments/v2/school-periods', payload);
            const data = res?.data || {};
            const created = Number.isFinite(Number(data.created)) ? Number(data.created) : null;

            if (created && created > 0) {
                const successMessage = `Período creado correctamente (familias afectadas: ${created})`;
                if (onCreated) {
                    onCreated(successMessage);
                }
                setTimeout(() => {
                    reset();
                    onClose?.();
                }, 900);
            } else {
                // Mensaje simple y auto-dismiss cuando no se creó ningún período
                const simple = 'El periodo que deseas crear ya existe.';
                setError(simple);
                setTimeout(() => setError(''), 5000);
            }
        } catch (e) {
            console.error('Error creating school period', e);
            setError(e?.response?.data?.message || e?.response?.data?.error || 'Error creando período');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppDialog
            open={open}
            onClose={handleClose}
            title="Nuevo período extracurricular"
            subtitle="Aplica a todas las familias activas del colegio"
            icon={<CalendarMonthIcon />}
            size="sm"
            onSubmit={handleCreate}
            submitLabel="Crear período"
            submitting={loading}
        >
            {error && <Box sx={{ mb: 1 }}><Alert severity="error">{error}</Alert></Box>}
            <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
                <Divider sx={{ mb: 1 }} />
                <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale="es" localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Período</Typography>
                            <DatePicker
                                views={[ 'year', 'month' ]}
                                openTo="month"
                                label="Período (YYYY-MM)"
                                value={period ? moment(period + '-01') : null}
                                onChange={(v) => setPeriod(v ? v.format('YYYY-MM') : '')}
                                format="YYYY-MM"
                                components={{ OpenPickerIcon: CalendarTodayIcon }}
                                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                            />
                            <Typography variant="caption" color="text.secondary">Selecciona el mes del periodo que se creará.</Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Tarifa base</Typography>
                            <MoneyField
                                label=""
                                size="small"
                                fullWidth
                                value={originalAmount}
                                onChange={(e) => setOriginalAmount(e.target.value)}
                            />
                            <Typography variant="caption" color="text.secondary">Tarifa por alumno.</Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Fecha de vencimiento</Typography>
                            <DatePicker
                                label=""
                                value={dueDateEnd}
                                onChange={setDueDateEnd}
                                format="YYYY-MM-DD"
                                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                            />
                            <Typography variant="caption" color="text.secondary">Última fecha en la que se puede pagar el período sin acumular mora.</Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Opciones</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <FormControlLabel
                                        control={<Checkbox checked={noAccruePenalty} onChange={(e) => setNoAccruePenalty(e.target.checked)} size="small" />}
                                        label="Congelar mora"
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>Marcar esta opción para que el período no acumule mora. Se creará el período con mora congelada.</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <FormControlLabel
                                        control={<Checkbox checked={applyFamilyDiscounts} onChange={(e) => setApplyFamilyDiscounts(e.target.checked)} size="small" />}
                                        label="Aplicar descuentos familiares"
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>Marcar esta opción para que al período se le aplique el descuento familiar configurado para cada familia.</Typography>
                                </Box>
                            </Box>
                        </Grid>

                    </Grid>
                </LocalizationProvider>
            </Box>
            <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ marginBottom: '8px' }}>
                        Tener en cuenta la fecha de vencimiento del período que se desea crear.
                    </Typography>
                    <Typography variant="body2">
                        Se acumula mora hasta la fecha de fin de operaciones del colegio, la cual se establece en la configuración general del colegio. Si el período extracurricular que deseas crear tiene una fecha de vencimiento que ocurre después de la fecha de fin de operaciones, no acumulará mora incluso si no se marca la opción "Congelar mora".
                    </Typography>
                    <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 700 }}>Sugerencias</Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0, mt: 0.5, listStyleType: 'disc', listStylePosition: 'outside', '& li': { marginBottom: '6px' } }}>
                        <li><Typography variant="body2">Crear el período normalmente aceptando que no acumule mora.</Typography></li>
                        <li><Typography variant="body2">Elegir una fecha de vencimiento para el período extracurricular, el cual se encuentre dentro del rango operativo del colegio para permitir acumulación de mora.</Typography></li>
                        <li><Typography variant="body2">Actualizar la fecha de fin de operaciones del colegio para que el período esté dentro del rango operativo.</Typography></li>
                    </Box>
                </Alert>
            </Box>
        </AppDialog>
    );
};

export default React.memo(CreateSchoolPeriodModal);
