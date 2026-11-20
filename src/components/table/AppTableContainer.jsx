// src/components/table/AppTableContainer.jsx
// Contenedor único de tabla: scroll horizontal y alto máximo opcional. El resto de props (component, variant…)
// pasa a TableContainer, para conservar el aspecto de cada pantalla (por ejemplo, component={Paper}).
import React from 'react';
import { TableContainer } from '@mui/material';

const AppTableContainer = ({ children, maxHeight, sx, ...rest }) => (
    <TableContainer {...rest} sx={{ overflowX: 'auto', maxHeight, ...sx }}>
        {children}
    </TableContainer>
);

export default AppTableContainer;
