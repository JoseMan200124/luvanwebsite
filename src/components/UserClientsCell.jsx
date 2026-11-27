// src/components/UserClientsCell.jsx
// Celda "Cliente" del listado de Roles: el primer cliente y, si hay más, un chip "+N" que abre la
// lista completa agrupada en colegios y corporaciones.
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Popover, Typography } from '@mui/material';
import { userClientNames } from '../utils/userClients';

const Grupo = ({ titulo, nombres }) => (nombres.length === 0 ? null : (
    <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{titulo}</Typography>
        {nombres.map((nombre) => (
            <Typography key={nombre} variant="body2">{nombre}</Typography>
        ))}
    </Box>
));

Grupo.propTypes = {
    titulo: PropTypes.string.isRequired,
    nombres: PropTypes.arrayOf(PropTypes.string).isRequired
};

const UserClientsCell = ({ clients }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const nombres = userClientNames(clients);

    if (nombres.length === 0) {
        return '—';
    }
    if (nombres.length === 1) {
        return nombres[0];
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <span>{nombres[0]}</span>
            <Chip
                label={`+${nombres.length - 1}`}
                size="small"
                variant="outlined"
                clickable
                onClick={(event) => setAnchorEl(event.currentTarget)}
                aria-label={`Ver los ${nombres.length} clientes`}
            />
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Box sx={{ p: 2, maxWidth: 360, maxHeight: 320, overflowY: 'auto' }}>
                    <Grupo titulo="Colegios" nombres={clients.colegios} />
                    <Grupo titulo="Corporaciones" nombres={clients.corporaciones} />
                </Box>
            </Popover>
        </Box>
    );
};

UserClientsCell.propTypes = {
    clients: PropTypes.shape({
        todos: PropTypes.bool,
        colegios: PropTypes.arrayOf(PropTypes.string),
        corporaciones: PropTypes.arrayOf(PropTypes.string)
    }).isRequired
};

export default UserClientsCell;
