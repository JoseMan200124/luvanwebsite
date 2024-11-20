// src/components/ProtectedRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';

const ProtectedRoute = ({ children, roles }) => {
    const { auth } = useContext(AuthContext);

    if (!auth.token) {
        // Si no está autenticado, redirigir a login
        return <Navigate to="/login" />;
    }

    if (roles && !roles.includes(auth.user.role)) {
        // Si el usuario no tiene el rol adecuado, redirigir o mostrar un mensaje
        return <Navigate to="/" />;
    }

    return children;
};

export default ProtectedRoute;
