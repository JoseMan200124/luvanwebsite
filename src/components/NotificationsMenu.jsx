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

// Botón estilizado (twin.macro + styled-components)
const NotificationIconButton = styled(IconButton)`
    ${tw`text-white`}
`;

const NotificationsMenu = ({ authToken }) => {
    // Estado local con TODAS las notificaciones (read y unread)
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();

    // 1) Cargar **todas** las notificaciones (read y unread)
    const fetchAllNotifications = async () => {
        try {
            // Asegúrate de que tu backend, con ?allStatuses=true,
            // retorne TODAS en data.notifications, sean read o unread
            const response = await api.get('/notifications?allStatuses=true', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            console.log('RESPUESTA NOTIFICACIONES:', response);

            const fetched = Array.isArray(response.data.notifications)
                ? response.data.notifications
                : [];
            setNotifications(fetched);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
        }
    };

    // 2) Marcar una notificación como leída
    const markNotificationAsRead = async (notificationId) => {
        try {
            await api.put(`/notifications/${notificationId}/read`, null, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            // En local, cambiamos status => 'read'
            setNotifications((prev) =>
                prev.map((n) => {
                    if (n.id === notificationId) {
                        return { ...n, status: 'read' };
                    }
                    return n;
                })
            );
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const handleNotificationClick = (notificationId) => {
        markNotificationAsRead(notificationId);
        handleMenuClose();
    };

    // 3) Limpiar todas => marca todas read
    const handleClearNotifications = async () => {
        for (const notif of notifications) {
            if (notif.status === 'unread') {
                await markNotificationAsRead(notif.id);
            }
        }
        handleMenuClose();
    };

    // 4) useEffect => cargar notifs + socket
    useEffect(() => {
        if (!authToken) return;

        // Cargar TODAS las notificaciones
        fetchAllNotifications();

        // Conectar socket
        const socket = getSocket();
        if (socket) {
            socket.on('new_notification', (newNoti) => {
                console.log('Recibida notificación via socket:', newNoti);
                setNotifications((prev) => [newNoti, ...prev]);
            });
        }

        return () => {
            if (socket) {
                socket.off('new_notification');
            }
        };
    }, [authToken]);

    // 5) Manejo del Menú
    const handleMenuOpen = async (event) => {
        setAnchorEl(event.currentTarget);
        // Volvemos a pedir la lista más reciente
        await fetchAllNotifications();
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // 6) Cálculo del badge => sólo las que están "unread"
    // de esta forma, si la notificación ya es "read", el badge no la cuenta.
    const unreadCount = notifications.filter((n) => n.status === 'unread').length;

    // RENDER
    return (
        <>
            <NotificationIconButton onClick={handleMenuOpen} ref={menuRef}>
                <Badge badgeContent={unreadCount} color="secondary">
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
                                onClick={() => handleNotificationClick(notification.id)}
                                style={{
                                    position: 'relative',
                                    minHeight: '80px',
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        width: '100%',
                                        paddingRight: '60px',
                                        paddingBottom: '28px',
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                            marginBottom: '4px',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {notification.title}
                                        {notification.status === 'unread' && ' (unread)'}
                                    </Typography>

                                    <Typography
                                        variant="body2"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {notification.message}
                                    </Typography>

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
