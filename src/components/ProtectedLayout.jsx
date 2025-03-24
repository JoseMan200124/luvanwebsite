// src/components/ProtectedLayout.jsx

import React, { useState, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationsMenu from './NotificationsMenu';
import { AuthContext } from '../context/AuthProvider';

const ProtectedLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { auth } = useContext(AuthContext);

    const handleToggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={handleToggleSidebar} />
            <div
                id="main-content"
                style={{
                    flex: 1,
                    marginLeft: isSidebarOpen ? '250px' : '60px',
                    transition: 'margin-left 0.3s ease',
                    position: 'relative',
                }}
            >
                {/* Campana de Notificaciones */}
                <div
                    style={{
                        position: 'fixed',
                        top: '10px',
                        right: '10px',
                        zIndex: 40,
                    }}
                >
                    <NotificationsMenu authToken={auth.token} />
                </div>
                {/* Contenido Principal */}
                <div style={{ padding: '20px' }}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default ProtectedLayout;
