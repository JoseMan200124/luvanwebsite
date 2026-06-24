import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, MenuItem, Alert, Grid, InputLabel, FormControl, Select, Typography, Divider, Stack, InputAdornment, FormHelperText, Tooltip, IconButton, Checkbox, FormControlLabel } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { esES } from '@mui/x-date-pickers/locales';
import moment from 'moment';
import api from '../../utils/axiosConfig';

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
        onClose && onClose();
    };

    const handleCreate = async () => {
        // basic validation
        if (!period) { setError('Selecciona un período (YYYY-MM)'); return; }
        if (originalAmount === '' || Number.isNaN(Number(originalAmount))) { setError('Ingresa la cantidad (Q) del periodo'); return; }
        if (!dueDateEnd) { setError('Selecciona la fecha de vencimiento (YYYY-MM-DD)'); return; }
        const payload = { period };
        // Enviar la tarifa base; las fechas de facturación se establecen en backend (fecha de creación).
        payload.originalAmount = Number(originalAmount);
        if (dueDateEnd) payload.dueDateEnd = dueDateEnd.format('YYYY-MM-DD');
        if (schoolId) payload.schoolId = schoolId;
        // Indica en la UI que este periodo no debe acumular mora (backend debe interpretar si aplica)
        if (noAccruePenalty) payload.noAccruePenalty = true;
        if (applyFamilyDiscounts) payload.applyFamilyDiscounts = true;

        setLoading(true);
        setError('');
        try {
            const res = await api.post('/payments/v2/school-periods', payload);
            const data = res?.data || {};
            const created = Number.isFinite(Number(data.created)) ? Number(data.created) : null;
            const skipped = Number.isFinite(Number(data.skipped)) ? Number(data.skipped) : null;

            if (created && created > 0) {
                const successMessage = `Período creado correctamente (familias afectadas: ${created})`;
                if (onCreated) onCreated(successMessage);
                setTimeout(() => {
                    reset();
                    onClose && onClose();
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
        <Dialog 
            open={open} 
            onClose={handleClose} 
            fullWidth 
            maxWidth="sm"
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
                    <CalendarMonthIcon />
                    <Box>
                        <Typography variant="h6" component="div" sx={{ overflowWrap: 'anywhere' }}>
                            Crear Período Extracurricular
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                            Aplica a todas las familias activas del colegio
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={handleClose} sx={{ color: 'white' }} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
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
                                <TextField
                                    label=""
                                    size="small"
                                    type="number"
                                    fullWidth
                                    value={originalAmount}
                                    onChange={(e) => setOriginalAmount(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">Q</InputAdornment>
                                        )
                                    }}
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
            </DialogContent>
            <Box sx={{ px: 3, pb: 1 }}>
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
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCreate}
                    disabled={loading}
                    sx={{
                        minWidth: 150,
                        transition: 'all 0.2s ease-in-out',
                        '&:disabled': {
                            opacity: 0.85,
                            cursor: 'not-allowed'
                        },
                        '&:hover': {
                            transform: loading ? 'none' : 'translateY(-1px)'
                        }
                    }}
                >
                    {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={18} color="inherit" />
                            <span>Creando…</span>
                        </Box>
                    ) : (
                        'Crear período'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(CreateSchoolPeriodModal);
