// src/components/NotificationsMenu.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    Typography,
    Divider,
} from '@mui/material';
import { Notifications, ClearAll } from '@mui/icons-material';
import styled from 'styled-components';
import tw from 'twin.macro';
import PropTypes from 'prop-types';
import api from '../utils/axiosConfig';
import { getSocket } from '../services/socketService';

const NotificationIconButton = styled(IconButton)`
    ${tw`text-white`}
`;

const NotificationsMenu = ({ authToken }) => {
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();

    // Cargar notificaciones
    const fetchNotificationsFromAPI = async () => {
        try {
            const response = await api.get('/notifications', {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                params: {
                    limit: 50,
                    offset: 0,
                },
            });
            const fetched = Array.isArray(response.data.notifications)
                ? response.data.notifications
                : [];
            setNotifications(fetched);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
        }
    };

    useEffect(() => {
        if (authToken) {
            fetchNotificationsFromAPI();
        }

        // Escuchar notificaciones via socket
        const socket = getSocket();
        if (socket) {
            socket.on('new_notification', (newNoti) => {
                console.log('Recibida notificación via socket:', newNoti);
                // Insertar al comienzo
                setNotifications((prev) => [newNoti, ...prev]);
            });
        }

        return () => {
            if (socket) {
                socket.off('new_notification');
            }
        };
    }, [authToken]);

    // Manejo de apertura/cierre del menú
    const handleMenuOpen = async (event) => {
        setAnchorEl(event.currentTarget);
        if (authToken) {
            await fetchNotificationsFromAPI();
        }
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleClearNotifications = () => {
        // Esto limpia solo en frontend
        setNotifications([]);
        handleMenuClose();
    };

    return (
        <>
            <NotificationIconButton onClick={handleMenuOpen} ref={menuRef}>
                <Badge badgeContent={notifications.length} color="secondary">
                    <Notifications />
                </Badge>
            </NotificationIconButton>

            <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                PaperProps={{ style: { width: 350 } }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                getContentAnchorEl={null}
            >
                <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px' }}>
                    <Typography variant="h6" style={{ flexGrow: 1 }}>
                        Notificaciones
                    </Typography>
                    <IconButton size="small" onClick={handleClearNotifications}>
                        <ClearAll />
                    </IconButton>
                </div>
                <Divider />

                {notifications.length === 0 ? (
                    <MenuItem onClick={handleMenuClose}>
                        <Typography variant="body1" color="textSecondary">
                            No hay notificaciones.
                        </Typography>
                    </MenuItem>
                ) : (
                    notifications.map((notification, index) => (
                        <div key={notification.id || index}>
                            <MenuItem
                                onClick={handleMenuClose}
                                // Forzamos altura y alineamos arriba
                                style={{
                                    position: 'relative',
                                    minHeight: '100px', // más alto para no tapar la fecha
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        width: '100%',
                                        paddingRight: '60px', // espacio lateral
                                        paddingBottom: '28px', // espacio inferior para la fecha
                                    }}
                                >
                                    {/* Título */}
                                    <Typography
                                        variant="body1"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        {notification.title}
                                    </Typography>

                                    {/* Mensaje */}
                                    <Typography
                                        variant="body2"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {notification.message}
                                    </Typography>

                                    {/* Fecha/hora en esquina inferior derecha */}
                                    <Typography
                                        variant="caption"
                                        color="textSecondary"
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            bottom: '8px',
                                        }}
                                    >
                                        {new Date(notification.createdAt).toLocaleString()}
                                    </Typography>
                                </div>
                            </MenuItem>
                            {index < notifications.length - 1 && <Divider />}
                        </div>
                    ))
                )}
            </Menu>
        </>
    );
};

NotificationsMenu.propTypes = {
    authToken: PropTypes.string.isRequired,
};

export default NotificationsMenu;
