// src/components/ProtectedRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import { CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children, roles = [] }) => {
    const { auth, initialLoad } = useContext(AuthContext);

    // 1) Si todavía estamos cargando (por ej. chequeando token en localStorage),
    //    mostramos un spinner
    if (initialLoad) {
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

    // 4) Si se requiere verificar roles:
    if (roles.length > 0) {
        const userRoleName = auth.user?.role || 'Desconocido';
        // El rol Auxiliar tiene acceso completo a todas las rutas
        if (userRoleName === 'Auxiliar') {
            return children;
        }
        // Si el rol del usuario no está en la lista => redirect a dashboard (o donde prefieras)
        if (!roles.includes(userRoleName)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    // 5) Si pasa todas las condiciones, renderiza la ruta protegida
    return children;
};

export default ProtectedRoute;
