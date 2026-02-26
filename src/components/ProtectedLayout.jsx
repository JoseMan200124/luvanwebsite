// src/components/ProtectedLayout.jsx

import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import Sidebar from './Sidebar';
import NotificationsMenu from './NotificationsMenu';
import { AuthContext } from '../context/AuthProvider';
import PageRefreshProvider, { PageRefreshContext } from '../context/PageRefreshProvider';

const GlobalRefreshButton = ({ compact = false, onRefreshStart, onRefreshEnd }) => {
    const refreshCtx = useContext(PageRefreshContext);
    const isRefreshing = !!refreshCtx?.isRefreshing;

    const handleClick = useCallback(async () => {
        if (!refreshCtx?.triggerRefresh || isRefreshing) return;
        onRefreshStart?.(compact);
        try {
            await refreshCtx.triggerRefresh();
        } finally {
            onRefreshEnd?.();
        }
    }, [refreshCtx, isRefreshing, compact, onRefreshStart, onRefreshEnd]);

    if (compact) {
        return (
            <Tooltip title="Refrescar">
                    <span>
                    <IconButton
                        size="small"
                        onClick={handleClick}
                        disabled={!refreshCtx || isRefreshing}
                        aria-label="Refrescar"
                        sx={{
                            backgroundColor: '#9c27b0',
                            color: '#fff',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 3px rgba(156,39,176,0.14)',
                            transition: 'box-shadow 180ms ease, background-color 150ms ease, transform 120ms ease',
                            '&:hover': { backgroundColor: '#7b1fa2', boxShadow: '0 0 0 4px rgba(156,39,176,0.22)', transform: 'translateY(-1px)' },
                            padding: '7px'
                        }}
                    >
                        {isRefreshing ? <CircularProgress size={20} color="inherit" /> : <Refresh fontSize="small" sx={{ color: '#fff' }} />}
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    return (
        <Button
            size="medium"
            variant="contained"
            startIcon={isRefreshing ? <CircularProgress size={20} color="inherit" /> : <Refresh fontSize="small" sx={{ color: '#fff' }} />}
            onClick={handleClick}
            disabled={!refreshCtx || isRefreshing}
            sx={{
                textTransform: 'none',
                borderRadius: 2,
                backgroundColor: '#9c27b0',
                color: '#fff',
                boxShadow: '0 0 0 3px rgba(156,39,176,0.14)',
                '&:hover': { backgroundColor: '#7b1fa2', boxShadow: '0 0 0 4px rgba(156,39,176,0.22)' },
                padding: '4px 8px',
                fontSize: '0.9rem',
                minHeight: '36px',
                lineHeight: '1'
            }}
        >
            Refrescar
        </Button>
    );
};

const ProtectedLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { auth } = useContext(AuthContext);
    const [refreshCompact, setRefreshCompact] = useState(false);
    const [refreshCompactLocked, setRefreshCompactLocked] = useState(null);
    const outletWrapperRef = useRef(null);
    const [outletMinHeightPx, setOutletMinHeightPx] = useState(null);

    const handleToggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        // Lower threshold so compact transform happens earlier during scroll
        const THRESHOLD_PX = 80;

        const onScroll = () => {
            const y = window.scrollY || 0;
            setRefreshCompact(y > THRESHOLD_PX);
        };

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const effectiveRefreshCompact = refreshCompactLocked !== null ? refreshCompactLocked : refreshCompact;

    const handleRefreshStart = useCallback((startedCompact) => {
        setRefreshCompactLocked(!!startedCompact);

        // Lock Outlet wrapper height to avoid the page shrinking during refresh
        // (which can clamp the window scroll position back to the top).
        const el = outletWrapperRef.current;
        if (el) {
            const measured = Math.max(el.scrollHeight || 0, el.offsetHeight || 0);
            if (measured > 0) setOutletMinHeightPx(measured);
        }
    }, []);

    const handleRefreshEnd = useCallback(() => {
        setRefreshCompactLocked(null);
        // Release after the next paint so the final content has rendered.
        requestAnimationFrame(() => setOutletMinHeightPx(null));
    }, []);

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
                <PageRefreshProvider>
                    {/* Campana de Notificaciones (no se modifica) */}
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

                    {/* Botón global de refrescar (independiente) */}
                    <div
                        style={{
                            position: 'fixed',
                            // Place full button slightly higher so it's near the notification bubble
                            top: effectiveRefreshCompact ? '58px' : '8px',
                            // Nudge compact icon a bit right for better centering with notifications
                            right: effectiveRefreshCompact ? '10px' : '72px',
                            zIndex: 35,
                        }}
                    >
                        <GlobalRefreshButton
                            compact={effectiveRefreshCompact}
                            onRefreshStart={handleRefreshStart}
                            onRefreshEnd={handleRefreshEnd}
                        />
                    </div>

                    {/* Contenido Principal */}
                    <div style={{ padding: '20px' }}>
                        <div
                            ref={outletWrapperRef}
                            style={{
                                minHeight: outletMinHeightPx ? `${outletMinHeightPx}px` : undefined,
                            }}
                        >
                            <PageRefreshContext.Consumer>
                                {({ outletKey }) => <Outlet key={outletKey} />}
                            </PageRefreshContext.Consumer>
                        </div>
                    </div>
                </PageRefreshProvider>
            </div>
        </div>
    );
};

export default ProtectedLayout;
