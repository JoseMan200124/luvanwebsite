// src/components/dialogs/DialogHeading.jsx
// Cabecera única de los diálogos, con el estilo del encabezado hero: barra con el degradado del logo
// (rojo en las acciones peligrosas), texto blanco y el ícono en un cuadro blanco translúcido.
import React from 'react';
import { Box, Typography } from '@mui/material';
import { DANGER_GRADIENT, LOGO_GRADIENT } from '../../theme/tokens';

const DialogHeading = ({ title, subtitle, icon, tone = 'default', action }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2.25,
            pr: action ? 6 : 3,
            position: 'relative',
            color: '#fff',
            background: tone === 'danger' ? DANGER_GRADIENT : LOGO_GRADIENT,
        }}
    >
        {icon ? (
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                }}
            >
                {icon}
            </Box>
        ) : null}
        <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                {title}
            </Typography>
            {subtitle ? (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {subtitle}
                </Typography>
            ) : null}
        </Box>
        {action}
    </Box>
);

export default DialogHeading;
