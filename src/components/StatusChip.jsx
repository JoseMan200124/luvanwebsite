// src/components/StatusChip.jsx
// Chip de estado único: size small, con la etiqueta y el color del dominio. Un color de la paleta de MUI
// va en la prop color; un hex va de fondo con texto blanco, como lo pintaban las pantallas.
// color (opcional) reemplaza el del dominio en una pantalla que pinta el estado distinto.
import React from 'react';
import { Chip } from '@mui/material';
import { getStatusMeta, isPaletteColor } from '../constants/statuses';

const StatusChip = ({ domain, value, color, showIcon = false, size = 'small', sx, ...rest }) => {
    const meta = getStatusMeta(domain, value);
    const chipColor = color || meta.color;
    const Icon = showIcon ? meta.icon : null;
    const palette = isPaletteColor(chipColor);
    return (
        <Chip
            {...rest}
            size={size}
            label={meta.label}
            color={palette ? chipColor : 'default'}
            icon={Icon ? <Icon fontSize="small" /> : undefined}
            sx={palette ? sx : { backgroundColor: chipColor, color: '#fff', ...sx }}
        />
    );
};

export default StatusChip;
