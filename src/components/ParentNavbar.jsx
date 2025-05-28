// src/components/ParentNavbar.jsx
import React, { useContext } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    Avatar,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    DirectionsBusFilled as DirectionsBusFilledIcon,
    Logout as LogoutIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { styled } from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import logoLuvan from '../assets/img/logo-sin-fondo.png';

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

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const onBack = () => {
        // Regresa al dashboard de padres
        navigate('/parent/dashboard');
    };

    // Mostrar botón “volver” si estamos en la página de subir boleta
    const isOnPaymentPage = location.pathname === '/parent/payment';

    return (
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
    );
}
