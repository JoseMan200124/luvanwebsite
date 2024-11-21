// src/components/NotificationsMenu.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    Typography,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
} from '@mui/material';
import { Notifications, ClearAll } from '@mui/icons-material';
import axios from 'axios';
import styled from 'styled-components';
import tw from 'twin.macro';
import PropTypes from 'prop-types';

const NotificationIconButton = styled(IconButton)`
    ${tw`text-white`}
`;

const NotificationsMenu = ({ authToken }) => {
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();

    useEffect(() => {
        // Fetch notifications from API
        const fetchNotifications = async () => {
            try {
                const response = await axios.get('/api/notifications', {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                });
                console.log('API Response:', response.data); // Log para depuración
                setNotifications(Array.isArray(response.data.notifications) ? response.data.notifications : []);
            } catch (err) {
                console.error('Error fetching notifications:', err);
                setNotifications([]); // Opcional: puedes establecer undefined para manejarlo en la UI
            }
        };

        if (authToken) { // Asegúrate de que authToken está disponible
            fetchNotifications();
        }
    }, [authToken]);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
        // Optionally mark notifications as read
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleClearNotifications = () => {
        // Clear notifications logic here
        setNotifications([]);
        handleMenuClose();
    };

    return (
        <>
            <NotificationIconButton onClick={handleMenuOpen} ref={menuRef}>
                <Badge badgeContent={Array.isArray(notifications) ? notifications.length : 0} color="secondary">
                    <Notifications />
                </Badge>
            </NotificationIconButton>
            <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                PaperProps={{
                    style: { width: 350 },
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
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
                {notifications === undefined ? (
                    <MenuItem onClick={handleMenuClose}>
                        <Typography variant="body1" color="error">
                            Error al cargar las notificaciones.
                        </Typography>
                    </MenuItem>
                ) : notifications.length === 0 ? (
                    <MenuItem onClick={handleMenuClose}>
                        <Typography variant="body1" color="textSecondary">
                            No hay notificaciones.
                        </Typography>
                    </MenuItem>
                ) : (
                    notifications.map((notification, index) => (
                        <div key={index}>
                            <MenuItem onClick={handleMenuClose}>
                                <ListItemText
                                    primary={notification.title}
                                    secondary={notification.message}
                                />
                                <ListItemSecondaryAction>
                                    <Typography variant="caption" color="textSecondary">
                                        {new Date(notification.date).toLocaleString()}
                                    </Typography>
                                </ListItemSecondaryAction>
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
