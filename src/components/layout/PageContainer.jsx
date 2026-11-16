// src/components/layout/PageContainer.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { PAGE_WIDTHS } from '../../theme/tokens';

/**
 * Contenedor estándar de página. El fondo lo pone ProtectedLayout.
 * - Padding lateral de 32 px desde sm (sumado a los 20 px del layout), igual que los contenedores que tenían
 *   las páginas antes de la unificación. El ancho máximo incluye ese padding (box-sizing: border-box global).
 *   En móvil no se agrega: el layout ya deja 12 px.
 * - El padding superior (32 px) deja libre la franja de los botones fijos: en escritorio, Notificaciones y
 *   Refrescar (hasta ~50 px); en móvil, Refrescar compacto (fijo a 58 px, hasta ~92 px; el layout ya deja 64 px).
 */
const PageContainer = ({ width = 'lg', sx = {}, children }) => (
    <Box
        sx={{
            width: '100%',
            maxWidth: PAGE_WIDTHS[width] ?? PAGE_WIDTHS.lg,
            mx: 'auto',
            px: { xs: 0, sm: 4 },
            pt: 4,
            pb: 4,
            ...sx,
        }}
    >
        {children}
    </Box>
);

PageContainer.propTypes = {
    width: PropTypes.oneOf(['md', 'lg', 'xl']),
    sx: PropTypes.object,
    children: PropTypes.node,
};

export default PageContainer;
