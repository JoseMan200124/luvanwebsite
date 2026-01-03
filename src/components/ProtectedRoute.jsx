// src/components/ProtectedRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import { PermissionsContext } from '../context/PermissionsProvider';
import { CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children, roles = [], moduleKey = null }) => {
    const { auth, initialLoad } = useContext(AuthContext);
    const { hasPermission, permissionsLoaded, loading } = useContext(PermissionsContext);

    // 1) Si todavía estamos cargando (por ej. chequeando token en localStorage),
    //    mostramos un spinner
    if (initialLoad || loading) {
        return (
            <div
                style={{
                    width: '100%',
                    height: '80vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <CircularProgress />
            </div>
        );
    }

    // 2) Si NO hay token, redirigimos a /login
    if (!auth?.token) {
        return <Navigate to="/login" replace />;
    }

    // 3) Si la contraseña ha expirado => forzamos /force-password-change
    //    (asumiendo que auth.user?.passwordExpired es `true` cuando expira)
    if (auth.user?.passwordExpired) {
        return <Navigate to="/force-password-change" replace />;
    }

    const userRoleName = auth.user?.role || 'Desconocido';

    // 4) NUEVA VALIDACIÓN: Si se proporciona moduleKey, verificar permisos de BD
    if (moduleKey && permissionsLoaded) {
        // Verificar si tiene el permiso en la base de datos
        if (!hasPermission(moduleKey)) {
            // No tiene permiso para este módulo, redirigir
            return <Navigate to="/admin/dashboard" replace />;
        }
        // Si tiene el permiso en BD, permitir acceso (no verificar roles hardcodeados)
        return children;
    }

    // 5) Si se requiere verificar roles (validación adicional, solo si NO hay moduleKey):
    if (roles.length > 0) {
        // Si el rol del usuario no está en la lista => redirect a dashboard (o donde prefieras)
        if (!roles.includes(userRoleName)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    // 6) Si pasa todas las condiciones, renderiza la ruta protegida
    return children;
};

export default ProtectedRoute;
