// src/components/DefaultAdminRoute.jsx
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import { PermissionsContext } from '../context/PermissionsProvider';
import { modules } from '../modules';

const DefaultAdminRoute = () => {
    const { auth } = useContext(AuthContext);
    const { permissions, permissionsLoaded, loading } = useContext(PermissionsContext);

    // Mientras se cargan los permisos, mostramos un spinner
    if (loading || !permissionsLoaded) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                <CircularProgress />
            </div>
        );
    }

    // Si no hay usuario o token, forzamos login
    if (!auth?.token || !auth?.user) {
        return <Navigate to="/login" replace />;
    }

    // Revisa si el usuario tiene acceso a 'dashboard'
    if (permissions?.dashboard) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // Buscar el primer submódulo permitido en 'modules'
    for (const mod of modules) {
        if (permissions?.[mod.key]) {
            for (const sub of mod.submodules) {
                if (permissions[sub.key]) {
                    // Redirige al primer path que tenga acceso
                    return <Navigate to={`/admin/${sub.path}`} replace />;
                }
            }
        }
    }

    // Si no tiene acceso a ningún submódulo, redirige a algo (roles-permisos o una página de "sin acceso")
    return <Navigate to="/admin/roles-permisos" replace />;
};

export default DefaultAdminRoute;
