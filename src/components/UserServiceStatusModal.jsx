import React, { useState, useEffect } from 'react';
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
    Paper
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
// SUSPENDED → ACTIVE está bloqueado intencionalmente en el frontend:
// la activación directa no tiene sentido si la familia aún tiene mora o no ha firmado contrato.
// El backend igualmente lo intercepta y asigna SUSPENDED de forma automática.
const VALID_TRANSITIONS = {
    'ACTIVE': ['PAUSED', 'SUSPENDED', 'INACTIVE'],
    'PAUSED': ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    'SUSPENDED': ['PAUSED', 'INACTIVE'],
    'INACTIVE': ['ACTIVE']
};

const UserServiceStatusModal = ({ open, onClose, user, schoolId, schoolYear, onSuccess, userType = 'FAMILY', corporationId = null, fiscalYear = null }) => {
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [reason, setReason] = useState('');
    const [resumeDate, setResumeDate] = useState(null);
    const [error, setError] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

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
            
            if (response.data && response.data.status) {
                setCurrentStatus(response.data.status.status);
            } else {
                // Fallback: usar el serviceStatus del join si está disponible
                const inferredStatus =
                    user?.familyServiceStatus?.status ||
                    (user?.state === 1 ? 'ACTIVE' : 'INACTIVE');
                setCurrentStatus(inferredStatus);
            }
        } catch (err) {
            console.error('Error fetching current status:', err);
            // Fallback: usar el serviceStatus del join (familyServiceStatus) si está disponible,
            // ya que es más preciso que inferir del user.state (un usuario SUSPENDED sigue teniendo state=1)
            const inferredStatus =
                user?.familyServiceStatus?.status ||
                (user?.state === 1 ? 'ACTIVE' : 'INACTIVE');
            setCurrentStatus(inferredStatus);
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
        if (!selectedStatus) {
            setError('Debe seleccionar un nuevo estado');
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
            
            const body = { reason: reason.trim(), userType };
            if (userType === 'COLABORADOR') {
                body.corporationId = corporationId;
                if (fiscalYear) body.fiscalYear = fiscalYear;
            } else {
                body.schoolId = schoolId;
                body.schoolYear = schoolYear;
            }
            // Incluir resumeDate si se seleccionó (opcional)
            if (selectedStatus === 'PAUSED' && resumeDate) {
                try {
                    const formatted = resumeDate.format ? resumeDate.format('YYYY-MM-DD') : String(resumeDate);
                    body.resumeDate = formatted;
                } catch (e) {
                    // si falla el formateo, enviar como string por seguridad
                    body.resumeDate = String(resumeDate);
                }
            }
            await api.post(`/service-status/${user.id}/${endpoint}`, body);

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

                {/* Aviso cuando el estado actual es SUSPENDED */}
                {currentStatus === 'SUSPENDED' && userType === 'FAMILY' && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                            La familia está Suspendida
                        </Typography>
                        <Typography variant="caption" component="div">
                            No se puede cambiar directamente a <strong>Activo</strong> desde este estado.
                            <br />
                            <br />
                            Para que el sistema active el servicio de forma automática, se debe cumplir con los siguientes requisitos:
                            <br />
                            • Tener contrato firmado
                            <br />
                            • No se deben tener períodos vencidos
                            <br />
                            • No se debe tener mora acumulada
                        </Typography>
                    </Alert>
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
                    disabled={loading || !selectedStatus || !reason.trim() || loadingStatus}
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    {loading ? 'Cambiando...' : 'Cambiar Estado'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserServiceStatusModal;
