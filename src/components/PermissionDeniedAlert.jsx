import React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

/**
 * Componente que muestra un mensaje cuando el usuario no tiene permisos
 * @param {Object} props
 * @param {Error|string} props.error - Error de permisos o mensaje personalizado
 * @param {string} props.action - Descripción de la acción (ej: "ver esta información", "realizar esta acción")
 */
const PermissionDeniedAlert = ({ error, action = 'acceder a este recurso' }) => {
    const isPermissionError = error?.isPermissionError || error?.status === 403;
    const message = typeof error === 'string' 
        ? error 
        : error?.message || `No tienes permisos para ${action}`;
    const requiredPermission = error?.requiredPermission;

    if (!isPermissionError && !error) return null;

    return (
        <Box sx={{ p: 3 }}>
            <Alert 
                severity="warning" 
                icon={<LockIcon />}
                sx={{
                    '& .MuiAlert-icon': {
                        fontSize: 28
                    }
                }}
            >
                <AlertTitle sx={{ fontWeight: 600 }}>Acceso Denegado</AlertTitle>
                {message}
                {requiredPermission && (
                    <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
                        Permiso requerido: <code>{requiredPermission}</code>
                    </Box>
                )}
                <Box sx={{ mt: 1, fontSize: '0.875rem' }}>
                    Contacta a un administrador si necesitas acceso a esta funcionalidad.
                </Box>
            </Alert>
        </Box>
    );
};

export default PermissionDeniedAlert;
