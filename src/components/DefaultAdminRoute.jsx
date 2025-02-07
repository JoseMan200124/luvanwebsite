// src/components/DefaultAdminRoute.jsx
import React, { useEffect, useState, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import { modules } from '../modules';

const DefaultAdminRoute = () => {
    const { auth } = useContext(AuthContext);

    const [permissions, setPermissions] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                // Si no hay token o no hay roleId, no puede ni cargar
                if (!auth?.token || !auth?.user?.roleId) {
                    setPermissions({});
                    setLoading(false);
                    return;
                }

                const res = await axios.get(`/permissions/role/${auth.user.roleId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });

                setPermissions(res.data.permissions || {});
            } catch (error) {
                console.error('Error obteniendo permisos:', error);
                setPermissions({});
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, [auth?.token, auth?.user?.roleId]);

    // Mientras se cargan los permisos, mostramos un spinner
    if (loading) {
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
