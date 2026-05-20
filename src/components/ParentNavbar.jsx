// src/components/ParentNavbar.jsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    Avatar,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    DirectionsBusFilled as DirectionsBusFilledIcon,
    Info as InfoIcon,
    Call as CallIcon,
    Email as EmailIcon,
    WhatsApp as WhatsAppIcon,
    Close as CloseIcon,
    Logout as LogoutIcon,
    ArrowBack as ArrowBackIcon,
    SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import { styled } from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import logoLuvan from '../assets/img/logo-sin-fondo.png';
import { getStoredSchoolContext, isSchoolContextRequiredRole } from '../utils/schoolContext';
import api from '../utils/axiosConfig';

const BrandBox = styled(Box)`
    display: flex;
    align-items: center;
    gap: 8px;
`;

export default function ParentNavbar() {
    const { auth, logout } = useContext(AuthContext);
    const navigate         = useNavigate();
    const location         = useLocation();
    const displayName      = auth?.user?.name || 'Padre de Familia';
    const selectedContext  = getStoredSchoolContext();
    const showContextSwitcher = isSchoolContextRequiredRole(auth?.user?.roleId);

    const isParentArea = location.pathname.startsWith('/parent');

    const [openContactDialog, setOpenContactDialog] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const [contactInfo, setContactInfo] = useState(null);

    const safeStr = useCallback((v) => (v == null ? '' : String(v)).trim(), []);

    const cleanPhoneDigits = useCallback((phone) => {
        if (!phone) return '';
        return String(phone).replace(/[^0-9]/g, '');
    }, []);

    const openPhone = useCallback((phone) => {
        const digits = cleanPhoneDigits(phone);
        if (!digits) return;
        window.location.href = `tel:${digits}`;
    }, [cleanPhoneDigits]);

    const openEmail = useCallback((email) => {
        const e = safeStr(email);
        if (!e) return;
        window.location.href = `mailto:${encodeURIComponent(e)}`;
    }, [safeStr]);

    const openWhatsApp = useCallback((whatsappLink, fallbackPhone) => {
        const direct = safeStr(whatsappLink);
        const url = direct || (cleanPhoneDigits(fallbackPhone) ? `https://wa.me/${cleanPhoneDigits(fallbackPhone)}` : '');
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [cleanPhoneDigits, safeStr]);

    const dialogTitle = useMemo(() => {
        const schoolName = safeStr(contactInfo?.schoolName || selectedContext?.schoolName);
        return schoolName || 'Contacto';
    }, [contactInfo?.schoolName, safeStr, selectedContext?.schoolName]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const onBack = () => {
        // Regresa al dashboard de padres
        navigate('/parent/dashboard');
    };

    const handleChangeContext = () => {
        navigate('/select-context', {
            state: {
                nextPath: location.pathname,
                forceChoice: true
            }
        });
    };

    // Mostrar botón “volver” si estamos en la página de subir boleta
    const isOnPaymentPage = location.pathname === '/parent/payment';

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        (async () => {
            if (!openContactDialog || !isParentArea) {
                return;
            }
            const userId = auth?.user?.id;
            if (!userId) {
                setContactInfo(null);
                return;
            }

            setContactLoading(true);
            try {
                const res = await api.get(`/parents/${userId}/route-info`, { signal: controller.signal });
                const raw = res?.data?.data || res?.data || {};
                const info = {
                    schoolName: safeStr(raw?.schoolName || raw?.school?.name),
                    contactPhone: safeStr(raw?.contactPhone),
                    contactEmail: safeStr(raw?.contactEmail),
                    whatsappLink: safeStr(raw?.whatsappLink),
                };
                if (mounted) setContactInfo(info);
            } catch (e) {
                if (mounted) setContactInfo(null);
            } finally {
                if (mounted) setContactLoading(false);
            }
        })();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [auth?.user?.id, isParentArea, openContactDialog, safeStr]);

    return (
        <>
            <AppBar position="static" sx={{ backgroundColor: '#0D3FE2', zIndex: 20 }}>
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isOnPaymentPage && (
                            <Tooltip title="Volver al dashboard">
                                <IconButton onClick={onBack} sx={{ color: '#FFF' }}>
                                    <ArrowBackIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                        <BrandBox>
                            <DirectionsBusFilledIcon sx={{ fontSize: 28 }} />
                            <Typography variant="h6" component="div">
                                Transportes Luvan
                            </Typography>
                        </BrandBox>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {selectedContext?.schoolName && (
                            <Box sx={{ mr: 2, display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, lineHeight: 1 }}>
                                    Contexto
                                </Typography>
                                <Typography variant="body2" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedContext.schoolName}
                                </Typography>
                            </Box>
                        )}
                        {showContextSwitcher && (
                            <Tooltip title="Cambiar colegio y ciclo">
                                <IconButton onClick={handleChangeContext} size="large" sx={{ color: '#FFF' }}>
                                    <SwapHorizIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {isParentArea && (
                            <Button
                                color="inherit"
                                size="small"
                                startIcon={<InfoIcon />}
                                onClick={() => setOpenContactDialog(true)}
                                sx={{ textTransform: 'none', mr: 1 }}
                            >
                                Contáctanos
                            </Button>
                        )}
                        <Typography
                            variant="subtitle1"
                            sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}
                        >
                            {displayName}
                        </Typography>
                        <Avatar
                            alt={displayName}
                            src={logoLuvan}
                            sx={{ bgcolor: '#FFF', width: 38, height: 38, mr: 1 }}
                        />
                        <Tooltip title="Cerrar sesión">
                            <IconButton onClick={handleLogout} size="large" sx={{ color: '#FFF' }}>
                                <LogoutIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Dialog: Contáctanos (solo padres) */}
            <Dialog open={openContactDialog && isParentArea} onClose={() => setOpenContactDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {dialogTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Elige un medio para comunicarte</Typography>
                    </Box>
                    <IconButton onClick={() => setOpenContactDialog(false)} aria-label="Cerrar">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {contactLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<CallIcon />}
                                onClick={() => openPhone(contactInfo?.contactPhone)}
                                disabled={!safeStr(contactInfo?.contactPhone)}
                            >
                                {safeStr(contactInfo?.contactPhone) || 'Llamar'}
                            </Button>

                            <Button
                                fullWidth
                                variant="contained"
                                color="secondary"
                                startIcon={<EmailIcon />}
                                onClick={() => openEmail(contactInfo?.contactEmail)}
                                disabled={!safeStr(contactInfo?.contactEmail)}
                            >
                                {safeStr(contactInfo?.contactEmail) || 'Correo'}
                            </Button>

                            <Button
                                fullWidth
                                variant="contained"
                                color="success"
                                startIcon={<WhatsAppIcon />}
                                onClick={() => openWhatsApp(contactInfo?.whatsappLink, contactInfo?.contactPhone)}
                                disabled={!safeStr(contactInfo?.whatsappLink) && !safeStr(contactInfo?.contactPhone)}
                            >
                                WhatsApp
                            </Button>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenContactDialog(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
