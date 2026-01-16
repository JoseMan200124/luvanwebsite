// src/components/NotificationsMenu.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    CircularProgress,
    Tooltip as MuiTooltip,
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

const PAGE_SIZE = 10;
const SCROLL_THRESHOLD_PX = 60;

const normalizeStatus = (s) => String(s || 'unread').toLowerCase();
const isUnread = (n) => normalizeStatus(n?.status) === 'unread';
const isRead = (n) => normalizeStatus(n?.status) === 'read';

const uniqueMergeById = (prev, next) => {
    const map = new Map();
    (prev || []).forEach((n) => map.set(String(n?.id), n));
    (next || []).forEach((n) => map.set(String(n?.id), n));
    return Array.from(map.values()).sort((a, b) => {
        const da = new Date(a?.createdAt || 0).getTime();
        const db = new Date(b?.createdAt || 0).getTime();
        return db - da;
    });
};

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

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
    const [unreadCount, setUnreadCount] = useState(0);

    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);
    const menuRef = useRef();
    const navigate = useNavigate();

    // Scroll + paginación
    const scrollRef = useRef(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingPage, setLoadingPage] = useState(false);

    // Modo paginación: server (limit/offset) o client (cache completo)
    const [paginationMode, setPaginationMode] = useState('server'); // 'server' | 'client'
    const allCacheRef = useRef(null);

    // Preview modal state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewNotification, setPreviewNotification] = useState(null); // { notification, receipt }

    const menuOpenRef = useRef(false);
    useEffect(() => {
        menuOpenRef.current = menuOpen;
    }, [menuOpen]);

    const recomputeUnreadCount = useCallback((list) => {
        const cnt = (list || []).reduce((acc, n) => acc + (isUnread(n) ? 1 : 0), 0);
        setUnreadCount(cnt);
    }, []);

    // ==============================
    // 1) Fetch de notificaciones paginadas (10 en 10)
    // ==============================
    const fetchNotificationsPage = useCallback(async (targetPage, { reset = false } = {}) => {
        if (!authToken) return;

        if (loadingPage) return;
        setLoadingPage(true);

        try {
            // Si estamos en modo "client" (cache completo), solo hacemos slice
            if (paginationMode === 'client' && Array.isArray(allCacheRef.current)) {
                const offset = targetPage * PAGE_SIZE;
                const nextSlice = allCacheRef.current.slice(offset, offset + PAGE_SIZE);

                setNotifications((prev) => (reset ? nextSlice : uniqueMergeById(prev, nextSlice)));
                setPage(targetPage);
                setHasMore(offset + PAGE_SIZE < allCacheRef.current.length);

                // unread count exacto desde cache
                recomputeUnreadCount(allCacheRef.current);
                return;
            }

            const offset = targetPage * PAGE_SIZE;
            const url = `/notifications?allStatuses=true&limit=${PAGE_SIZE}&offset=${offset}`;

            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            const fetched = Array.isArray(response.data.notifications)
                ? response.data.notifications
                : [];

            // Si el backend ignora limit/offset, normalmente devuelve TODO.
            // Detectamos eso: si devuelve más de PAGE_SIZE en la primera llamada, asumimos que es "todo" y cacheamos.
            const backendLikelyReturnedAll = fetched.length > PAGE_SIZE && (targetPage === 0);

            if (backendLikelyReturnedAll) {
                // Cambiamos a modo client para no volver a pedir todo en cada scroll
                setPaginationMode('client');
                allCacheRef.current = fetched;

                const firstSlice = fetched.slice(0, PAGE_SIZE);
                setNotifications(firstSlice);
                setPage(0);
                setHasMore(PAGE_SIZE < fetched.length);

                recomputeUnreadCount(fetched);
                return;
            }

            // Caso normal: backend sí pagina o devuelve <= PAGE_SIZE
            setNotifications((prev) => (reset ? fetched : uniqueMergeById(prev, fetched)));
            setPage(targetPage);

            // hasMore: si viene meta del backend úsala, si no, por tamaño
            const total = Number(response.data.total);
            const hasMoreFromTotal = Number.isFinite(total) ? (offset + fetched.length < total) : null;
            setHasMore(hasMoreFromTotal !== null ? hasMoreFromTotal : fetched.length === PAGE_SIZE);

            // unreadCount: si el backend lo manda, úsalo; si no, lo calculamos con lo cargado
            const serverUnread = Number(response.data.unreadCount);
            if (Number.isFinite(serverUnread)) {
                setUnreadCount(serverUnread);
            } else {
                // mejor esfuerzo con lo que tenemos cargado
                setTimeout(() => {
                    setNotifications((curr) => {
                        recomputeUnreadCount(curr);
                        return curr;
                    });
                }, 0);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            if (reset) {
                setNotifications([]);
                setUnreadCount(0);
                setPage(0);
                setHasMore(false);
            }
        } finally {
            setLoadingPage(false);
        }
    }, [authToken, loadingPage, paginationMode, recomputeUnreadCount]);

    // ==============================
    // 2) Marcar una notificación como leída (sin eliminarla)
    // ==============================
    const markNotificationAsRead = useCallback(async (notificationId) => {
        if (!notificationId) return;

        // Si ya está read en local, no hagas nada
        const current = notifications.find(n => String(n.id) === String(notificationId));
        if (current && isRead(current)) return;

        try {
            await api.put(`/notifications/${notificationId}/read`, null, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            setNotifications((prev) => {
                const updated = prev.map((n) =>
                    String(n.id) === String(notificationId)
                        ? { ...n, status: 'read' }
                        : n
                );
                recomputeUnreadCount(paginationMode === 'client' && Array.isArray(allCacheRef.current) ? allCacheRef.current : updated);
                return updated;
            });

            // Si estamos en modo client y hay cache, también actualizamos cache
            if (paginationMode === 'client' && Array.isArray(allCacheRef.current)) {
                allCacheRef.current = allCacheRef.current.map((n) =>
                    String(n.id) === String(notificationId) ? { ...n, status: 'read' } : n
                );
                recomputeUnreadCount(allCacheRef.current);
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }, [authToken, notifications, paginationMode, recomputeUnreadCount]);

    // Marca como read todas las visibles (las 10 actuales / nuevas)
    const markVisibleAsRead = useCallback(async (listToMark) => {
        const toMark = (listToMark || []).filter(isUnread).map(n => n.id).filter(Boolean);
        if (toMark.length === 0) return;

        // Evita demasiadas llamadas simultáneas
        const chunks = chunk(toMark, 5);
        for (const group of chunks) {
            await Promise.allSettled(group.map((id) => markNotificationAsRead(id)));
        }
    }, [markNotificationAsRead]);

    // ==============================
    // 3) Abrir menú => cargar 10 + marcarlas como leídas
    // ==============================
    const handleMenuOpen = async (event) => {
        setAnchorEl(event.currentTarget);

        // Reset estado para que siempre muestre desde 0
        setNotifications([]);
        setPage(0);
        setHasMore(true);
        setPaginationMode('server');
        allCacheRef.current = null;

        // Cargar primera página
        await fetchNotificationsPage(0, { reset: true });

        // Marcar como leídas las visibles (las 10 que se muestran)
        // Nota: necesitamos el estado ya poblado -> esperamos microtask
        setTimeout(() => {
            setNotifications((curr) => {
                markVisibleAsRead(curr.slice(0, PAGE_SIZE));
                return curr;
            });
        }, 0);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // ==============================
    // 4) Infinite scroll: cargar 10 más al llegar al final
    // ==============================
    const loadNextPage = useCallback(async () => {
        if (!hasMore || loadingPage) return;
        const next = page + 1;
        await fetchNotificationsPage(next);
        // marcar como leídas las nuevas visibles (las recién cargadas)
        setTimeout(() => {
            setNotifications((curr) => {
                const start = next * PAGE_SIZE;
                const newlyLoaded = curr.slice(start, start + PAGE_SIZE);
                markVisibleAsRead(newlyLoaded);
                return curr;
            });
        }, 0);
    }, [hasMore, loadingPage, page, fetchNotificationsPage, markVisibleAsRead]);

    const handleScroll = useCallback((e) => {
        const el = e.currentTarget;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceToBottom < SCROLL_THRESHOLD_PX) {
            loadNextPage();
        }
    }, [loadNextPage]);

    // ==============================
    // 5) Click en notificación: marcar read + navegar/preview
    // ==============================
    const handleNotificationClick = async (notification) => {
        if (!notification) return;

        // Marcar como leída cuando el usuario la abre/click
        if (notification.id) {
            await markNotificationAsRead(notification.id);
        }

        // For 'Nueva Boleta de Pago', show the receipt preview inside the menu (no navigation).
        if (notification.type === 'boleta-pago') {
            setAnchorEl(null);
            try {
                const userId = notification.payment?.User?.id || notification.payment?.userId || null;
                if (!userId) {
                    setPreviewNotification({ notification, receipt: null });
                    setPreviewOpen(true);
                    return;
                }
                const res = await api.get(`/parents/${userId}/receipts`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                const recs = res.data.receipts || [];
                const matched = notification.paymentReceiptId
                    ? recs.find(r => String(r.id) === String(notification.paymentReceiptId))
                    : recs[0];

                setPreviewNotification({ notification, receipt: matched || null });
                setPreviewOpen(true);
            } catch (e) {
                console.error('Error loading receipt for preview', e);
                setPreviewNotification({ notification, receipt: null });
                setPreviewOpen(true);
            }
            return;
        }

        // Otherwise, navigate if link exists
        if (notification.link) {
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

    // ==============================
    // 6) Marcar TODAS como leídas (sin eliminarlas)
    // ==============================
    const markAllLoadedAsRead = useCallback(async () => {
        const unreadIds = (notifications || []).filter(isUnread).map(n => n.id).filter(Boolean);
        if (unreadIds.length === 0) return;

        const chunks = chunk(unreadIds, 5);
        for (const group of chunks) {
            await Promise.allSettled(group.map((id) => markNotificationAsRead(id)));
        }
    }, [notifications, markNotificationAsRead]);

    const handleClearNotifications = async () => {
        // Botón "ClearAll" => marca como read lo cargado (sin borrar)
        await markAllLoadedAsRead();
        // No cierro el menú, así se ve que ya no quedan resaltadas
    };

    // ==============================
    // 7) Cargar contador inicial (mejor esfuerzo)
    // ==============================
    useEffect(() => {
        if (!authToken) return;

        // Cargar 1ra página fuera del menú para tener badge razonable
        // (sin marcar como read aquí)
        fetchNotificationsPage(0, { reset: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authToken]);

    // ==============================
    // 8) Socket: nueva notificación
    // ==============================
    useEffect(() => {
        if (!authToken) return;

        const socket = getSocket();
        if (!socket) return;

        const onNew = async (newNoti) => {
            if (!newNoti || !newNoti.id) return;

            // Si el menú está abierto, el usuario ya la está viendo => marcar read inmediatamente
            if (menuOpenRef.current) {
                const asRead = { ...newNoti, status: 'read' };

                setNotifications((prev) => uniqueMergeById([asRead], prev));
                // mantener cache si aplica
                if (paginationMode === 'client' && Array.isArray(allCacheRef.current)) {
                    allCacheRef.current = uniqueMergeById([asRead], allCacheRef.current);
                    recomputeUnreadCount(allCacheRef.current);
                } else {
                    // mejor esfuerzo
                    setTimeout(() => {
                        setNotifications((curr) => {
                            recomputeUnreadCount(curr);
                            return curr;
                        });
                    }, 0);
                }

                // backend: marcar read
                try {
                    await markNotificationAsRead(newNoti.id);
                } catch (_) {
                    // ignore
                }
                return;
            }

            // Si el menú NO está abierto => agregar como unread
            setNotifications((prev) => uniqueMergeById([newNoti], prev));

            if (paginationMode === 'client' && Array.isArray(allCacheRef.current)) {
                allCacheRef.current = uniqueMergeById([newNoti], allCacheRef.current);
                recomputeUnreadCount(allCacheRef.current);
            } else {
                setUnreadCount((c) => c + 1);
            }
        };

        socket.on('new_notification', onNew);
        return () => {
            socket.off('new_notification', onNew);
        };
    }, [authToken, markNotificationAsRead, paginationMode, recomputeUnreadCount]);

    const getNotificationStyle = (notification) => {
        const baseStyle = { transition: 'background-color 0.2s ease, opacity 0.2s ease' };

        const unread = isUnread(notification);

        // Si está leída, NO resaltada
        const intensity = unread ? 1 : 0.35;

        switch (notification.title) {
            case 'Registro de Asistencia':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(76, 175, 80, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(232, 245, 233, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Ruta Finalizada':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(33, 150, 243, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(227, 242, 253, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Incidente Reportado':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(255, 152, 0, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(255, 243, 224, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Nueva Boleta de Pago':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(156, 39, 176, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(243, 229, 245, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Pago Confirmado':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(0, 200, 83, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(232, 245, 233, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Emergencia Reportada':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(244, 67, 54, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(255, 235, 238, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            case 'Bus en Taller':
                return {
                    ...baseStyle,
                    borderLeft: `4px solid rgba(158, 158, 158, ${unread ? 1 : 0.6})`,
                    backgroundColor: unread ? `rgba(238, 238, 238, ${intensity * 0.7})` : 'transparent',
                    opacity: unread ? 1 : 0.85,
                };
            default:
                return unread
                    ? {
                        ...baseStyle,
                        borderLeft: '4px solid rgba(33, 150, 243, 1)',
                        backgroundColor: 'rgba(227, 242, 253, 0.55)',
                        opacity: 1
                    }
                    : {
                        ...baseStyle,
                        borderLeft: '4px solid rgba(33, 150, 243, 0.55)',
                        backgroundColor: 'transparent',
                        opacity: 0.85
                    };
        }
    };

    const header = useMemo(() => (
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px' }}>
            <Typography variant="h6" style={{ flexGrow: 1 }}>
                Notificaciones
            </Typography>

            <MuiTooltip title="Marcar como leídas (lo cargado)">
                <IconButton size="small" onClick={handleClearNotifications}>
                    <ClearAll />
                </IconButton>
            </MuiTooltip>
        </div>
    ), [handleClearNotifications]);

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
                PaperProps={{ style: { width: 380, maxHeight: 560 } }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{ disablePadding: true }}
            >
                {header}
                <Divider />

                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    style={{ maxHeight: 500, overflowY: 'auto' }}
                >
                    {notifications.length === 0 && !loadingPage ? (
                        <MenuItem onClick={handleMenuClose}>
                            <Typography variant="body1" color="textSecondary">
                                No hay notificaciones.
                            </Typography>
                        </MenuItem>
                    ) : (
                        notifications.map((notification, index) => {
                            const schoolName = notification.payment?.School?.name || null;
                            const unread = isUnread(notification);

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
                                        {/* Botón (X): ahora SOLO marca como leída, NO elimina */}
                                        <MuiTooltip title="Marcar como leída">
                                            <IconButton
                                                size="small"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await markNotificationAsRead(notification.id);
                                                }}
                                                style={{ position: 'absolute', right: 4, top: 4, zIndex: 5 }}
                                            >
                                                <Close fontSize="small" />
                                            </IconButton>
                                        </MuiTooltip>

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
                                            {schoolName && (
                                                <Chip
                                                    label={schoolName}
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
                                                    fontWeight: unread ? 700 : 600,
                                                }}
                                            >
                                                {notification.title}
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
                                                {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
                                            </Typography>
                                        </div>
                                    </MenuItem>

                                    {index < notifications.length - 1 && <Divider />}
                                </div>
                            );
                        })
                    )}

                    {/* Loader y fin */}
                    {loadingPage && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                            <CircularProgress size={22} />
                        </div>
                    )}

                    {!loadingPage && notifications.length > 0 && !hasMore && (
                        <div style={{ padding: 10, textAlign: 'center' }}>
                            <Typography variant="caption" color="textSecondary">
                                No hay más notificaciones.
                            </Typography>
                        </div>
                    )}
                </div>
            </Menu>

            {/* Receipt preview dialog (local) */}
            <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Vista previa de Boleta</DialogTitle>
                <DialogContent>
                    {previewNotification && previewNotification.receipt ? (
                        (previewNotification.receipt.fileUrl &&
                            previewNotification.receipt.fileUrl.match(/(\.png|\.jpe?g|\.gif|\.webp|\.bmp)(\?|$)/i)
                        ) ? (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <img
                                    src={previewNotification.receipt.fileUrl}
                                    alt="boleta"
                                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                                />
                            </div>
                        ) : (
                            <div>
                                {previewNotification.receipt && previewNotification.receipt.fileUrl ? (
                                    <Button
                                        variant="outlined"
                                        href={previewNotification.receipt.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Abrir archivo
                                    </Button>
                                ) : (
                                    <Typography variant="body2">
                                        No se encontró la boleta para vista previa.
                                    </Typography>
                                )}
                            </div>
                        )
                    ) : (
                        <Typography variant="body2">No hay una boleta disponible para vista previa.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)}>Cerrar</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            try {
                                const notif = previewNotification && previewNotification.notification;
                                const rec = previewNotification && previewNotification.receipt;

                                let link = notif && notif.link
                                    ? notif.link
                                    : (rec
                                            ? `/admin/escuelas/${new Date().getFullYear()}/pagos?openRegister=true&receiptId=${rec.id}&userId=${rec.userId}`
                                            : null
                                    );

                                if (link) {
                                    const base = window.location.origin;
                                    const u = new URL(link, base);
                                    u.searchParams.set('openRegister', 'true');
                                    if (rec && rec.id) u.searchParams.set('receiptId', rec.id);
                                    if (rec && rec.userId) u.searchParams.set('userId', rec.userId);

                                    const state = notif && notif.payment
                                        ? { payment: notif.payment }
                                        : (rec ? { receiptId: rec.id } : undefined);

                                    setPreviewOpen(false);
                                    const finalPath = forceSchoolYearInLink(u.pathname + u.search, 2025);
                                    navigate(finalPath, { state });
                                }
                            } catch (e) {
                                console.error('Error navigating to register from preview', e);
                            }
                        }}
                    >
                        Registrar Pago
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

NotificationsMenu.propTypes = {
    authToken: PropTypes.string.isRequired,
};

export default NotificationsMenu;
