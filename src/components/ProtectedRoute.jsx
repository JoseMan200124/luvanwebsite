// src/components/ProtectedRoute.jsx
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import { CircularProgress } from '@mui/material';


const ProtectedRoute = ({ children, roles = [] }) => {
    const { auth, initialLoad } = useContext(AuthContext);

    if (initialLoad) {
        return (
            <div style={{ width: '100%', height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
            </div>
        );
    }

    if (!auth.token) {
        return <Navigate to="/login" replace />;
    }

    if (roles.length > 0) {
        const userRoleName = auth.user.role || 'Desconocido';
        if (!roles.includes(userRoleName)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
