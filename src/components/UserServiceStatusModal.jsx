import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Box,
    Typography,
    Alert,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import {
    CheckCircle,
    Pause,
    Block,
    RemoveCircle,
    Info
} from '@mui/icons-material';
import api from '../utils/axiosConfig';

// Definición de estados con sus propiedades
const SERVICE_STATES = {
    ACTIVE: {
        label: 'Activo',
        icon: CheckCircle,
        color: 'success',
        description: 'Servicio activo normal. Se genera cobro mensual y acumula mora.',
        canLogin: true,
        generatesBilling: true,
        accumulatesPenalty: true
    },
    PAUSED: {
        label: 'Pausado',
        icon: Pause,
        color: 'warning',
        description: 'Pausado temporal (ej: vacaciones). No se cobra, no acumula mora. Usuario puede hacer login.',
        canLogin: true,
        generatesBilling: false,
        accumulatesPenalty: false
    },
    SUSPENDED: {
        label: 'Suspendido',
        icon: Block,
        color: 'error',
        description: 'Suspendido por mora severa o por no haber firmado contrato. Se genera cobro mensual y acumula mora. Usuario puede hacer login pero solo puede subir boletas de pago o firmar contrato.',
        canLogin: true,
        generatesBilling: true,
        accumulatesPenalty: true
    },
    INACTIVE: {
        label: 'Inactivo',
        icon: RemoveCircle,
        color: 'default',
        description: 'No usa el servicio. Usuario NO puede hacer login. No se genera cobro ni mora.',
        canLogin: false,
        generatesBilling: false,
        accumulatesPenalty: false
    }
};

// Transiciones válidas entre estados.
// Para familias, SUSPENDED → ACTIVE se permite y el backend decide si la activación
// procede o si debe mantenerse SUSPENDED según la política manual configurada.
const VALID_TRANSITIONS = {
    'ACTIVE': ['PAUSED', 'SUSPENDED', 'INACTIVE'],
    'PAUSED': ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    'SUSPENDED': ['ACTIVE', 'PAUSED', 'INACTIVE'],
    'INACTIVE': ['ACTIVE']
};

const inferStatusFromUser = (user) => (
    user?.familyServiceStatus?.status ||
    (user?.state === 1 ? 'ACTIVE' : 'INACTIVE')
);

const hasManualPolicyChanges = (
    userType,
    currentStatusRecord,
    ignoreMissingContractForAutoSuspension,
    ignoreMoraForAutoSuspension
) => {
    if (userType !== 'FAMILY') {
        return false;
    }

    return (
        ignoreMissingContractForAutoSuspension !== Boolean(currentStatusRecord?.ignoreMissingContractForAutoSuspension) ||
        ignoreMoraForAutoSuspension !== Boolean(currentStatusRecord?.ignoreMoraForAutoSuspension)
    );
};

const buildRequestBody = ({
    reason,
    userType,
    corporationId,
    fiscalYear,
    schoolId,
    schoolYear,
    ignoreMissingContractForAutoSuspension,
    ignoreMoraForAutoSuspension,
    selectedStatus,
    resumeDate
}) => {
    const body = { reason: reason.trim(), userType };

    if (userType === 'COLABORADOR') {
        body.corporationId = corporationId;
        if (fiscalYear) {
            body.fiscalYear = fiscalYear;
        }
        return body;
    }

    body.schoolId = schoolId;
    body.schoolYear = schoolYear;
    body.ignoreMissingContractForAutoSuspension = ignoreMissingContractForAutoSuspension;
    body.ignoreMoraForAutoSuspension = ignoreMoraForAutoSuspension;

    if (selectedStatus === 'PAUSED' && resumeDate) {
        body.resumeDate = resumeDate.format ? resumeDate.format('YYYY-MM-DD') : String(resumeDate);
    }

    return body;
};

const UserServiceStatusModal = ({ open, onClose, user, schoolId, schoolYear, onSuccess, userType = 'FAMILY', corporationId = null, fiscalYear = null }) => {
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(null);
    const [currentStatusRecord, setCurrentStatusRecord] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [reason, setReason] = useState('');
    const [resumeDate, setResumeDate] = useState(null);
    const [error, setError] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [ignoreMissingContractForAutoSuspension, setIgnoreMissingContractForAutoSuspension] = useState(false);
    const [ignoreMoraForAutoSuspension, setIgnoreMoraForAutoSuspension] = useState(false);

    // Obtener estado actual cuando se abre el modal
    useEffect(() => {
        const canFetch =
            open && user &&
            (
                (userType === 'FAMILY' && schoolId && schoolYear) ||
                (userType === 'COLABORADOR' && corporationId)
            );
        if (canFetch) {
            fetchCurrentStatus();
        }
    }, [open, user, schoolId, schoolYear, userType, corporationId]);

    // Limpiar formulario al abrir
    useEffect(() => {
        if (open) {
            setReason('');
            setSelectedStatus('');
            setResumeDate(null);
            setError(null);
            setCurrentStatusRecord(null);
            setIgnoreMissingContractForAutoSuspension(false);
            setIgnoreMoraForAutoSuspension(false);
        }
    }, [open]);

    const fetchCurrentStatus = async () => {
        try {
            setLoadingStatus(true);
            const params = { userType };
            if (userType === 'COLABORADOR') {
                params.corporationId = corporationId;
                if (fiscalYear) params.fiscalYear = fiscalYear;
            } else {
                params.schoolId = schoolId;
                params.schoolYear = schoolYear;
            }
            const response = await api.get(`/service-status/${user.id}`, { params });

            const responseStatus = response.data?.status;

            if (responseStatus) {
                setCurrentStatusRecord(responseStatus);
                setCurrentStatus(responseStatus.status);
                setIgnoreMissingContractForAutoSuspension(Boolean(responseStatus.ignoreMissingContractForAutoSuspension));
                setIgnoreMoraForAutoSuspension(Boolean(responseStatus.ignoreMoraForAutoSuspension));
            } else {
                setCurrentStatusRecord(null);
                setCurrentStatus(inferStatusFromUser(user));
                setIgnoreMissingContractForAutoSuspension(false);
                setIgnoreMoraForAutoSuspension(false);
            }
        } catch (err) {
            console.error('Error fetching current status:', err);
            setCurrentStatusRecord(null);
            setCurrentStatus(inferStatusFromUser(user));
            setIgnoreMissingContractForAutoSuspension(false);
            setIgnoreMoraForAutoSuspension(false);
        } finally {
            setLoadingStatus(false);
        }
    };

    // Obtener estados permitidos según el estado actual
    const getAllowedStates = () => {
        if (!currentStatus) return [];
        const transitions = VALID_TRANSITIONS[currentStatus] || [];
        // SUSPENDED no aplica para colaboradores
        if (userType === 'COLABORADOR') {
            return transitions.filter(s => s !== 'SUSPENDED');
        }
        return transitions;
    };

    const handleSubmit = async () => {
        const hasStatusChange = Boolean(selectedStatus);
        const hasPolicyChanges = hasManualPolicyChanges(
            userType,
            currentStatusRecord,
            ignoreMissingContractForAutoSuspension,
            ignoreMoraForAutoSuspension
        );

        if (!hasStatusChange && !hasPolicyChanges) {
            setError('Debe realizar al menos un cambio antes de guardar');
            return;
        }

        if (!reason.trim()) {
            setError('Debe ingresar una razón para el cambio de estado');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Mapear estado a endpoint correspondiente
            const endpointMap = {
                'ACTIVE': 'activate',
                'PAUSED': 'pause',
                'SUSPENDED': 'suspend',
                'INACTIVE': 'deactivate'
            };

            const endpoint = endpointMap[selectedStatus];
            const body = buildRequestBody({
                reason,
                userType,
                corporationId,
                fiscalYear,
                schoolId,
                schoolYear,
                ignoreMissingContractForAutoSuspension,
                ignoreMoraForAutoSuspension,
                selectedStatus,
                resumeDate
            });

            if (hasStatusChange) {
                await api.post(`/service-status/${user.id}/${endpoint}`, body);
            } else {
                await api.patch(`/service-status/${user.id}/policy`, body);
            }

            if (onSuccess) {
                onSuccess();
            }

            onClose();
        } catch (err) {
            console.error('Error changing service status:', err);
            setError(
                err?.response?.data?.message || 
                err?.response?.data?.error || 
                'Error al cambiar el estado del servicio'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    const getStatusIcon = (status) => {
        const StatusIcon = SERVICE_STATES[status]?.icon || Info;
        return <StatusIcon fontSize="small" />;
    };

    const getStatusColor = (status) => {
        return SERVICE_STATES[status]?.color || 'default';
    };

    const allowedStates = getAllowedStates();
    const hasPolicyChanges = hasManualPolicyChanges(
        userType,
        currentStatusRecord,
        ignoreMissingContractForAutoSuspension,
        ignoreMoraForAutoSuspension
    );
    const hasStatusChange = Boolean(selectedStatus);
    const canSubmit = !loading && !loadingStatus && reason.trim() && (hasStatusChange || hasPolicyChanges);
    let submitLabel = 'Guardar Configuración';
    if (loading) {
        submitLabel = 'Guardando...';
    } else if (hasStatusChange) {
        submitLabel = 'Cambiar Estado';
    }

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info color="primary" />
                    <Typography variant="h6">
                        Gestionar Estado del Servicio
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                {/* Información de la familia */}
                <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {userType === 'COLABORADOR' ? 'Colaborador' : 'Familia'}
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                        {user?.name || 'Sin nombre'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Email: {user?.email || 'No disponible'}
                    </Typography>
                </Paper>

                {/* Estado actual */}
                {loadingStatus ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={30} />
                    </Box>
                ) : currentStatus && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Estado Actual
                        </Typography>
                        <Chip
                            icon={getStatusIcon(currentStatus)}
                            label={SERVICE_STATES[currentStatus]?.label || currentStatus}
                            color={getStatusColor(currentStatus)}
                            sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {SERVICE_STATES[currentStatus]?.description}
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 3 }} />

                {userType === 'FAMILY' && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Política manual para cambios automáticos a estado Suspendido
                        </Typography>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', border: theme => `1px solid ${theme.palette.divider}` }}>
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        checked={ignoreMissingContractForAutoSuspension}
                                        onChange={(e) => setIgnoreMissingContractForAutoSuspension(e.target.checked)}
                                        disabled={loading || loadingStatus}
                                    />
                                )}
                                label="Ignorar falta de contrato firmado"
                            />
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        checked={ignoreMoraForAutoSuspension}
                                        onChange={(e) => setIgnoreMoraForAutoSuspension(e.target.checked)}
                                        disabled={loading || loadingStatus}
                                    />
                                )}
                                label="Ignorar mora"
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                Esta configuración le indica al sistema cómo manejar los cambios automáticos al estado Suspendido.
                            </Typography>
                        </Paper>
                    </Box>
                )}

                {/* Selección de nuevo estado */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Nuevo Estado</InputLabel>
                    <Select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        label="Nuevo Estado"
                        disabled={loading || loadingStatus || allowedStates.length === 0}
                    >
                        {allowedStates.map((state) => (
                            <MenuItem key={state} value={state}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getStatusIcon(state)}
                                    <span>{SERVICE_STATES[state]?.label || state}</span>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Descripción del estado seleccionado */}
                {selectedStatus && (
                    <Alert 
                        severity="info" 
                        sx={{ mb: 3 }}
                        icon={getStatusIcon(selectedStatus)}
                    >
                        <Typography variant="body2" gutterBottom>
                            <strong>{SERVICE_STATES[selectedStatus]?.label}</strong>
                        </Typography>
                        <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                            {SERVICE_STATES[selectedStatus]?.description}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" component="div">
                                ✓ Login: {SERVICE_STATES[selectedStatus]?.canLogin ? 'Permitido' : 'Bloqueado'}
                            </Typography>
                            {userType === 'FAMILY' && (
                                <>
                                    <Typography variant="caption" component="div">
                                        ✓ Cobro mensual: {SERVICE_STATES[selectedStatus]?.generatesBilling ? 'Sí' : 'No'}
                                    </Typography>
                                    <Typography variant="caption" component="div">
                                        ✓ Acumula mora: {SERVICE_STATES[selectedStatus]?.accumulatesPenalty ? 'Sí' : 'No'}
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </Alert>
                )}

                {/* Selector de fecha opcional para PAUSED */}
                {selectedStatus === 'PAUSED' && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Fecha opcional de reanudación
                        </Typography>
                        <LocalizationProvider dateAdapter={AdapterMoment}>
                            <DatePicker
                                value={resumeDate}
                                onChange={(newVal) => setResumeDate(newVal)}
                                slotProps={{ textField: { fullWidth: true, helperText: 'Opcional — si se deja vacío, la reactivación será manual' } }}
                                format="YYYY-MM-DD"
                            />
                        </LocalizationProvider>
                    </Box>
                )}

                {/* Razón del cambio */}
                <TextField
                    fullWidth
                    label="Razón del cambio"
                    multiline
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: Familia solicitó pausa por vacaciones del 15 al 30 de marzo"
                    disabled={loading}
                    required
                    helperText="El cambio será efectivo desde hoy"
                    sx={{ mb: 3 }}
                />

                {/* Error */}
                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Advertencia si no hay transiciones disponibles */}
                {currentStatus && allowedStates.length === 0 && (
                    <Alert severity="warning">
                        No hay transiciones de estado disponibles desde el estado actual.
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button 
                    onClick={handleClose}
                    disabled={loading}
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!canSubmit}
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    {submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserServiceStatusModal;

UserServiceStatusModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func,
    schoolId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    schoolYear: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    userType: PropTypes.oneOf(['FAMILY', 'COLABORADOR']),
    corporationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    fiscalYear: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    user: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        name: PropTypes.string,
        email: PropTypes.string,
        state: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
        familyServiceStatus: PropTypes.shape({
            status: PropTypes.string
        })
    })
};
