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
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();

    // ==============================
    // 1) Cargar todas las notificaciones
    // ==============================
    const fetchAllNotifications = async () => {
        try {
            // Ajusta esta URL/query param si tu backend es diferente
            const response = await api.get('/notifications?allStatuses=true', {
                headers: { Authorization: `Bearer ${authToken}` },
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

    // ==============================
    // 2) Marcar una notificación como leída
    // ==============================
    const markNotificationAsRead = async (notificationId) => {
        try {
            await api.put(`/notifications/${notificationId}/read`, null, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            // En local, cambiamos su estado a "read"
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId
                        ? { ...n, status: 'read' }
                        : n
                )
            );
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    // ==============================
    // 3) Marcar TODAS como leídas
    // ==============================
    const markAllNotificationsAsRead = async () => {
        try {
            // Filtramos las "unread"
            const unreadList = notifications.filter((n) => n.status === 'unread');
            for (const notif of unreadList) {
                // Las marcamos como read una por una
                await markNotificationAsRead(notif.id);
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // ==============================
    // 4) Al abrir el menú => recargar y marcar leídas
    // ==============================
    const handleMenuOpen = async (event) => {
        setAnchorEl(event.currentTarget);
        // Volvemos a pedir la lista más reciente
        await fetchAllNotifications();
        // Marcar todas como leídas
        await markAllNotificationsAsRead();
    };

    // ==============================
    // 5) Cerrar el menú
    // ==============================
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // ==============================
    // 6) "Limpiar" => marcar todas read
    // (ahora es redundante porque ya se marcan al abrir,
    //  pero lo dejamos si quieres un botón extra)
    // ==============================
    const handleClearNotifications = async () => {
        await markAllNotificationsAsRead();
        handleMenuClose();
    };

    // ==============================
    // 7) Efecto para cargar y escuchar socket
    // ==============================
    useEffect(() => {
        if (!authToken) return;

        // Cargar notificaciones
        fetchAllNotifications();

        // Escuchar socket
        const socket = getSocket();
        if (socket) {
            socket.on('new_notification', (newNoti) => {
                setNotifications((prev) => [newNoti, ...prev]);
            });
        }
        return () => {
            if (socket) socket.off('new_notification');
        };
    }, [authToken]);


    // ==============================
    // 8) Contador => unread
    // ==============================
    const unreadCount = notifications.filter((n) => n.status === 'unread').length;

    const getNotificationStyle = (notification) => {
        // Estilo base para todas las notificaciones
        const baseStyle = {
            transition: 'background-color 0.3s ease',
        };
        
        // Color más tenue si ya fue leída
        const intensity = notification.status === 'unread' ? 1 : 0.4;
        
        // Estilos según el título
        switch (notification.title) {
            case 'Registro de Asistencia':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(76, 175, 80, ${intensity})`,
                    backgroundColor: `rgba(232, 245, 233, ${intensity * 0.7})`
                };
            case 'Ruta Finalizada':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(33, 150, 243, ${intensity})`,
                    backgroundColor: `rgba(227, 242, 253, ${intensity * 0.7})`
                };
            case 'Incidente Reportado':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(255, 152, 0, ${intensity})`,
                    backgroundColor: `rgba(255, 243, 224, ${intensity * 0.7})`
                };
            case 'Nueva Boleta de Pago':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(156, 39, 176, ${intensity})`,
                    backgroundColor: `rgba(243, 229, 245, ${intensity * 0.7})`
                };
            case 'Pago Confirmado':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(0, 200, 83, ${intensity})`,
                    backgroundColor: `rgba(232, 245, 233, ${intensity * 0.7})`
                };
            case 'Emergencia Reportada':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(244, 67, 54, ${intensity})`,
                    backgroundColor: `rgba(255, 235, 238, ${intensity * 0.7})`
                };
            case 'Bus en Taller':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(158, 158, 158, ${intensity})`,
                    backgroundColor: `rgba(238, 238, 238, ${intensity * 0.7})`
                };
            default:
                // Estilo por defecto para otros títulos
                return notification.status === 'unread' ? {
                    ...baseStyle,
                    borderLeft: '4px solid rgba(33, 150, 243, 1)',
                    backgroundColor: 'rgba(227, 242, 253, 0.7)'
                } : baseStyle;
        }
    };

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
                                // Eliminamos la acción de 'onClick' individual,
                                // ya que al abrir el menú se marcan todas
                                // onClick={() => handleNotificationClick(notification.id)}
                                style={{
                                    position: 'relative',
                                    minHeight: '80px',
                                    alignItems: 'flex-start',
                                    ...getNotificationStyle(notification)
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
