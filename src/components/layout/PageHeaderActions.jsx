// src/components/layout/PageHeaderActions.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, CircularProgress, Menu, MenuItem, Tooltip } from '@mui/material';
import { ArrowDropDown, FileDownload, FileUpload, MoreHoriz, Send } from '@mui/icons-material';
import usePermissions from '../../hooks/usePermissions';
import { groupHeaderActions, resolveHeaderActions } from './resolveHeaderActions';
import { CLIENT_TONES } from '../../theme/tokens';

// Ícono fijo por tipo de acción: todos los botones del mismo tipo se ven iguales en todas las pantallas.
const GROUP_ICONS = {
    download: <FileDownload />,
    upload: <FileUpload />,
    send: <Send />,
    other: <MoreHoriz />,
};

// En móvil (xs), una acción por fila a todo el ancho (apiladas, la principal al final); desde sm, en línea.
const SLOT_SX = { flex: { xs: '1 1 100%', sm: '0 0 auto' }, minWidth: 0 };

const heroButtonSx = (primary, accent) => (primary
    ? {
        backgroundColor: 'white',
        color: accent,
        fontWeight: 600,
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.88)' },
        '&.Mui-disabled': { backgroundColor: 'rgba(255,255,255,0.45)', color: 'rgba(0,0,0,0.38)' },
    }
    : {
        color: 'white',
        borderColor: 'rgba(255,255,255,0.7)',
        fontWeight: 500,
        '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.3)' },
    });

const ActionButton = ({ action, variant, accent }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const hasMenu = Boolean(action.menu);
    const busy = Boolean(action.loading);
    // La principal conserva su ícono; las demás usan el de su tipo.
    const icon = action.primary ? action.icon : (GROUP_ICONS[action.group] || action.icon);

    const button = (
        <Button
            fullWidth
            size="small"
            variant={action.primary ? 'contained' : 'outlined'}
            color="primary"
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : icon}
            endIcon={hasMenu ? <ArrowDropDown /> : undefined}
            disabled={Boolean(action.disabled) || busy}
            onClick={hasMenu ? (event) => setAnchorEl(event.currentTarget) : action.onClick}
            sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' }, ...(variant === 'hero' ? heroButtonSx(action.primary, accent) : {}) }}
        >
            {action.label}
        </Button>
    );

    return (
        <Box sx={SLOT_SX}>
            {action.tooltip ? (
                <Tooltip title={action.tooltip}>
                    {/* span: el Tooltip necesita un hijo que reciba eventos aunque el botón esté deshabilitado */}
                    <span style={{ display: 'block' }}>{button}</span>
                </Tooltip>
            ) : button}
            {hasMenu && (
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {action.menu.map((item) => (
                        <MenuItem
                            key={item.key}
                            disabled={Boolean(item.disabled)}
                            onClick={() => {
                                setAnchorEl(null);
                                item.onClick();
                            }}
                        >
                            {item.label}
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </Box>
    );
};

ActionButton.propTypes = {
    action: PropTypes.object.isRequired,
    variant: PropTypes.oneOf(['hero', 'simple']).isRequired,
    accent: PropTypes.string.isRequired,
};

/**
 * Acciones de página del encabezado, con un patrón único para todas las pantallas:
 * Descargar · Cargar · Enviar · Otras · Principal (ver groupHeaderActions).
 * Filtra por permisos: una acción o un menú sin opciones visibles no se muestra.
 */
const PageHeaderActions = ({ actions, variant = 'simple', tone = 'school' }) => {
    const { hasAnyPermission } = usePermissions();
    const visible = groupHeaderActions(resolveHeaderActions(actions, hasAnyPermission));
    if (visible.length === 0) {
        return null;
    }
    const accent = (CLIENT_TONES[tone] || CLIENT_TONES.school).accent;
    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: { xs: 'wrap', lg: 'nowrap' },
                gap: 1,
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexShrink: 0,
            }}
        >
            {visible.map((action) => (
                <ActionButton key={action.key} action={action} variant={variant} accent={accent} />
            ))}
        </Box>
    );
};

PageHeaderActions.propTypes = {
    actions: PropTypes.array,
    variant: PropTypes.oneOf(['hero', 'simple']),
    tone: PropTypes.oneOf(['school', 'corporate']),
};

export default PageHeaderActions;
