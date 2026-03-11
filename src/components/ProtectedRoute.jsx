// src/components/ProtectedRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import { PermissionsContext } from '../context/PermissionsProvider';
import { CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children, roles = [], moduleKey = null, redirectTo = '/admin/dashboard' }) => {
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
    const userRoleId = auth.user?.roleId;

    // 4) Si se proporciona moduleKey, verificar permisos en BD
    // Nota: el provider muestra loading mientras carga, así que aquí normalmente ya estará cargado.
    if (moduleKey) {
        if (!permissionsLoaded || !hasPermission(moduleKey)) {
            return <Navigate to={redirectTo} replace />;
        }
        // Si tiene el permiso en BD, permitir acceso (no verificar roles hardcodeados)
        return children;
    }

    // 5) Si se requiere verificar roles (solo si NO hay moduleKey):
    if (roles.length > 0) {
        const allowed = roles.some((r) => r === userRoleName || (userRoleId != null && r === userRoleId));
        if (!allowed) return <Navigate to={redirectTo} replace />;
    }

    // 6) Si pasa todas las condiciones, renderiza la ruta protegida
    return children;
};

export default ProtectedRoute;
