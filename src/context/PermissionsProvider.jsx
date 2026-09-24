// src/context/PermissionsProvider.jsx
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from './AuthProvider';
import api from '../utils/axiosConfig';

export const PermissionsContext = createContext();

const PermissionsProvider = ({ children }) => {
    const { auth, initialLoad } = useContext(AuthContext);
    const [permissions, setPermissions] = useState({});
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // AuthProvider todavía está restaurando la sesión desde localStorage
        // (async): si resolvemos aquí, el token real de un cold load todavía
        // no llegó a auth.token y esto marca permissionsLoaded=true con {}
        // antes de tiempo — ProtectedRoute lee ese vacío transitorio y
        // redirige a /login aunque el usuario sí tenga sesión válida.
        if (initialLoad) return;

        const loadPermissions = async () => {
            setLoading(true);
            setPermissionsLoaded(false);

            // Si no hay usuario autenticado, limpiar permisos
            if (!auth?.token || !auth?.user) {
                setPermissions({});
                setPermissionsLoaded(true);
                setLoading(false);
                return;
            }

            // Cargar permisos desde el backend
            try {
                const response = await api.get('/permissions/user/me', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setPermissions(response.data.permissions || {});
                setPermissionsLoaded(true);
            } catch (error) {
                console.error('Error cargando permisos:', error);
                setPermissions({});
                setPermissionsLoaded(true);
            } finally {
                setLoading(false);
            }
        };

        loadPermissions();
    }, [initialLoad, auth?.token, auth?.user?.id]); // Recargar cuando AuthProvider termine de resolver la sesión, o cambie el token/userId

    const hasPermission = (moduleKey) => {
        return !!permissions[moduleKey];
    };

    const hasAnyPermission = (moduleKeys = []) => {
        return moduleKeys.some(key => !!permissions[key]);
    };

    const contextValue = useMemo(() => ({
        permissions,
        permissionsLoaded,
        loading,
        hasPermission,
        hasAnyPermission
    }), [permissions, permissionsLoaded, loading]);

    return (
        <PermissionsContext.Provider value={contextValue}>
            {children}
        </PermissionsContext.Provider>
    );
};

export default PermissionsProvider;