// src/components/NotificationsMenu.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    Typography,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Chip,
} from '@mui/material';
import { Notifications, ClearAll, Close } from '@mui/icons-material';
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
    // Helper: ensure links to SchoolPaymentsPage use the requested schoolYear (used when opening from notifications)
    const forceSchoolYearInLink = (rawLink, year = 2025) => {
        if (!rawLink || typeof rawLink !== 'string') return rawLink;
        try {
            const base = window.location.origin;
            const u = new URL(rawLink, base);
            // Replace path segment /admin/escuelas/{YEAR}/ with target year
            if (/^\/admin\/escuelas\/\d{4}\//.test(u.pathname)) {
                u.pathname = u.pathname.replace(/^\/admin\/escuelas\/\d{4}\//, `/admin/escuelas/${year}/`);
                return u.pathname + u.search;
            }
            // Fallback: set schoolYear query param
            u.searchParams.set('schoolYear', String(year));
            return u.pathname + u.search;
        } catch (e) {
            // Best-effort string replace
            try {
                return rawLink.replace(/(\/admin\/escuelas\/)\d{4}(\/)/, `$1${year}$2`);
            } catch (_) {
                return rawLink;
            }
        }
    };

    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();
    const navigate = useNavigate();

    // ==============================
    // 1) Cargar todas las notificaciones
    // ==============================
    const fetchAllNotifications = useCallback(async () => {
        try {
            // Ajusta esta URL/query param si tu backend es diferente
            const response = await api.get('/notifications?allStatuses=true', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const fetched = Array.isArray(response.data.notifications)
                ? response.data.notifications
                : [];

            // Normalize targetingCriteria if it's returned as a string and
            // add a small debug log for notifications missing client info.
            const normalized = fetched.map((n) => {
                const copy = { ...n };
                try {
                    if (copy.targetingCriteria && typeof copy.targetingCriteria === 'string') {
                        copy.targetingCriteria = JSON.parse(copy.targetingCriteria);
                    }
                } catch (e) {
                    console.warn('Failed parsing targetingCriteria for notification', copy.id, e);
                }

                return copy;
            });

            // Only keep notifications that are not marked as 'read'
            const visible = normalized.filter((n) => !n.status || n.status !== 'read');
            setNotifications(visible);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
        }
    }, [authToken]);

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

    // Helper para ocultar localmente (remover) una notificación
    const hideNotificationLocal = (notificationId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    };

    const handleNotificationClick = async (notification) => {
        // Do NOT auto-mark notification as read when user clicks the card.
        // Only the X (delete) will mark as read. This preserves the user's
        // explicit action intent.
        // For 'Nueva Boleta de Pago', show the receipt preview inside the menu (no navigation).
        if (notification && notification.type === 'boleta-pago') {
            setAnchorEl(null);
            // open preview: try to fetch receipts for the user (using payment.User.id or payment.userId)
            try {
                const userId = notification.payment?.User?.id || notification.payment?.userId || null;
                if (!userId) {
                    // no userId available in payload: show a minimal preview with message
                    setPreviewNotification({ notification, receipt: null });
                    setPreviewOpen(true);
                    return;
                }
                const res = await api.get(`/parents/${userId}/receipts`, { headers: { Authorization: `Bearer ${authToken}` } });
                const recs = res.data.receipts || [];
                // prefer matching receipt by id when available
                const matched = notification.paymentReceiptId ? recs.find(r => String(r.id) === String(notification.paymentReceiptId)) : recs[0];
                setPreviewNotification({ notification, receipt: matched || null });
                setPreviewOpen(true);
            } catch (e) {
                console.error('Error loading receipt for preview', e);
                setPreviewNotification({ notification, receipt: null });
                setPreviewOpen(true);
            }
            return;
        }

        // Otherwise, if notification has a link, navigate to it
        if (notification && notification.link) {
            try {
                setAnchorEl(null);
                const stateObj = notification.payment ? { payment: notification.payment } : undefined;
                const linkToOpen = forceSchoolYearInLink(notification.link, 2025);
                navigate(linkToOpen, { state: stateObj });
            } catch (e) {
                console.error('Error navigating to notification link', e);
            }
        }
    };

    // Preview modal state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewNotification, setPreviewNotification] = useState(null); // { notification, receipt }

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
        // Do NOT auto-mark all as read on open. The user can explicitly remove (X) or
        // use the ClearAll button if they want to mark all as read.
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
        // Keep behavior: explicit 'clear' button will mark all as read
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
                const copy = { ...newNoti };
                try {
                    if (copy.targetingCriteria && typeof copy.targetingCriteria === 'string') {
                        copy.targetingCriteria = JSON.parse(copy.targetingCriteria);
                    }
                } catch (e) {
                    console.warn('Failed parsing targetingCriteria from socket new_notification', copy.id, e);
                }

                setNotifications((prev) => [copy, ...prev]);
            });
        }
        return () => {
            if (socket) socket.off('new_notification');
        };
    }, [authToken, fetchAllNotifications]);


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
                    notifications.map((notification, index) => {
                        const clientName = notification.targetingCriteria?.client?.name || null;
                        return (
                            <div key={notification.id || index}>
                                <MenuItem
                                    style={{
                                        position: 'relative',
                                        minHeight: '80px',
                                        alignItems: 'flex-start',
                                        paddingRight: 8,
                                        paddingLeft: 16,
                                        ...getNotificationStyle(notification)
                                    }}
                                >
                                    {/* Close (X) button */}
                                    <IconButton
                                        size="small"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await markNotificationAsRead(notification.id);
                                            } catch (err) {
                                                // ignore
                                            }
                                            hideNotificationLocal(notification.id);
                                        }}
                                        style={{ position: 'absolute', right: 4, top: 4, zIndex: 5 }}
                                    >
                                        <Close fontSize="small" />
                                    </IconButton>

                                    <div
                                        onClick={() => handleNotificationClick(notification)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative',
                                            width: '100%',
                                            paddingRight: '28px',
                                            paddingBottom: '28px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {clientName && (
                                            <Chip
                                                label={clientName}
                                                size="small"
                                                color="primary"
                                                variant="filled"
                                                style={{ alignSelf: 'flex-start', marginBottom: 6 }}
                                            />
                                        )}
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
                        );
                    })
                )}
            </Menu>

            {/* Receipt preview dialog (local) */}
            <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Vista previa de Boleta</DialogTitle>
                <DialogContent>
                    {previewNotification && previewNotification.receipt ? (
                        (previewNotification.receipt.fileUrl && (previewNotification.receipt.fileUrl.match(/(\.png|\.jpe?g|\.gif|\.webp|\.bmp)(\?|$)/i))) ? (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <img src={previewNotification.receipt.fileUrl} alt="boleta" style={{ maxWidth: '100%', maxHeight: '60vh' }} />
                            </div>
                        ) : (
                            <div>
                                {previewNotification.receipt && previewNotification.receipt.fileUrl ? (
                                    <Button variant="outlined" href={previewNotification.receipt.fileUrl} target="_blank" rel="noreferrer">Abrir archivo</Button>
                                ) : (
                                    <Typography variant="body2">No se encontró la boleta para vista previa.</Typography>
                                )}
                            </div>
                        )
                    ) : (
                        <Typography variant="body2">No hay una boleta disponible para vista previa.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)}>Cerrar</Button>
                    <Button variant="contained" onClick={async () => {
                        // when user chooses to register a payment, navigate to page with openRegister=true
                        try {
                            const notif = previewNotification && previewNotification.notification;
                            const rec = previewNotification && previewNotification.receipt;
                            // Build URL from notification.link if available, else construct
                            let link = notif && notif.link ? notif.link : (rec ? `/admin/escuelas/${new Date().getFullYear()}/pagos?openRegister=true&receiptId=${rec.id}&userId=${rec.userId}` : null);
                            // ensure openRegister explicit
                            if (link) {
                                const base = window.location.origin;
                                const u = new URL(link, base);
                                u.searchParams.set('openRegister', 'true');
                                if (rec && rec.id) u.searchParams.set('receiptId', rec.id);
                                if (rec && rec.userId) u.searchParams.set('userId', rec.userId);
                                const state = notif && notif.payment ? { payment: notif.payment } : (rec ? { receiptId: rec.id } : undefined);
                                setPreviewOpen(false);
                                const finalPath = forceSchoolYearInLink(u.pathname + u.search, 2025);
                                navigate(finalPath, { state });
                            }
                        } catch (e) {
                            console.error('Error navigating to register from preview', e);
                        }
                    }}>Registrar Pago</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

NotificationsMenu.propTypes = {
    authToken: PropTypes.string.isRequired,
};

export default NotificationsMenu;
