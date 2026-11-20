// src/components/table/RowActions.jsx
// Acciones por fila: IconButton con Tooltip (también deshabilitado), orden Ver · Editar · otras · Eliminar.
// Con más de 3, las que sobran van al menú "Más".
import React, { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import usePermissions from '../../hooks/usePermissions';
import { splitRowActions } from './rowActionsModel';

const RowActions = ({ actions }) => {
    const { hasAnyPermission } = usePermissions();
    const [anchorEl, setAnchorEl] = useState(null);
    const { inline, overflow } = splitRowActions(actions, hasAnyPermission);

    return (
        <>
            {inline.map((action) => (
                <Tooltip key={action.key} title={action.tooltip || action.label}>
                    <span>
                        <IconButton
                            size="small"
                            aria-label={action.label}
                            color={action.color || (action.kind === 'delete' ? 'error' : 'default')}
                            disabled={action.disabled}
                            onClick={action.onClick}
                        >
                            {action.icon}
                        </IconButton>
                    </span>
                </Tooltip>
            ))}
            {overflow.length > 0 ? (
                <>
                    <Tooltip title="Más acciones">
                        <IconButton size="small" aria-label="Más acciones" onClick={(event) => setAnchorEl(event.currentTarget)}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        {overflow.map((action) => (
                            <MenuItem
                                key={action.key}
                                disabled={action.disabled}
                                onClick={() => {
                                    setAnchorEl(null);
                                    action.onClick();
                                }}
                                sx={action.kind === 'delete' ? { color: 'error.main' } : undefined}
                            >
                                <ListItemIcon sx={action.kind === 'delete' ? { color: 'error.main' } : undefined}>
                                    {action.icon}
                                </ListItemIcon>
                                <ListItemText>{action.label}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            ) : null}
        </>
    );
};

export default RowActions;
