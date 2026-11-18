// src/components/table/MobileCard.jsx
// Tarjeta de la vista móvil de una tabla (por debajo de sm), con el aspecto que tenían las tarjetas de cada pantalla.
import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export const MobileCard = ({ children, actions, sx, elevation }) => (
    <Paper elevation={elevation} sx={{ p: 2, mb: 2, ...sx }}>
        {children}
        {actions ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                {actions}
            </Box>
        ) : null}
    </Paper>
);

export const MobileField = ({ label, children }) => (
    <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#555' }}>
            {label}
        </Typography>
        <Typography component="div" sx={{ fontSize: '1rem' }}>
            {children}
        </Typography>
    </Box>
);

export default MobileCard;
