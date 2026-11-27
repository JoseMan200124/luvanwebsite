// src/components/StatCard.jsx
// Tarjeta de métrica única (KPI) con el estilo de la marca: barra vertical a la izquierda con el degradado del logo
// y el ícono en un círculo de fondo claro. Cada pantalla conserva sus colores por métrica:
// - color: pinta la barra y el ícono (por defecto, el degradado del logo en la barra y su azul en el ícono).
//   Acepta un color CSS o uno del tema ('error', 'warning.main'), como lo usaba cada pantalla.
// - valueColor: pinta el número (donde la pantalla ya lo mostraba en color); por defecto, el color del texto.
// - format: 'number' | 'money' | 'percent'; sin format, el valor se muestra tal cual.
// - hint: línea (o líneas) de detalle debajo del valor.
// - children: contenido en lugar del valor, para una tarjeta con varios números chicos (por ejemplo, por prioridad).
import React from 'react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatNumber, formatQ } from '../utils/currency';
import { HEADER_TITLE_COLOR, LOGO_COLORS } from '../theme/tokens';

const CARD_SHADOW = '0 6px 16px -10px rgba(17, 24, 39, 0.25)';
const LOGO_GRADIENT_VERTICAL = `linear-gradient(180deg, ${LOGO_COLORS.blue} 0%, ${LOGO_COLORS.green} 100%)`;

const formatValue = (value, format) => {
    if (format === 'money') {
        return formatQ(value);
    }
    if (format === 'number') {
        return formatNumber(value);
    }
    if (format === 'percent') {
        return value === null || value === undefined ? '—' : `${formatNumber(value, { decimals: 1 })}%`;
    }
    return value ?? '—';
};

const resolveColor = (theme, value) => {
    if (!value) {
        return undefined;
    }
    const [group, shade = 'main'] = String(value).split('.');
    const paletteColor = theme.palette[group];
    return paletteColor && typeof paletteColor === 'object' && paletteColor[shade] ? paletteColor[shade] : value;
};

export const StatCard = ({ label, value, icon, color: colorProp, valueColor: valueColorProp, hint, loading = false, onClick, format, children }) => {
    const theme = useTheme();
    const color = resolveColor(theme, colorProp);
    const valueColor = resolveColor(theme, valueColorProp);
    const clickable = typeof onClick === 'function';
    const accent = color || LOGO_COLORS.blue;
    return (
        <Paper
            elevation={0}
            onClick={onClick}
            onKeyDown={clickable ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            } : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                height: '100%',
                p: 2,
                pl: 2.75,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: CARD_SHADOW,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'box-shadow 0.15s, transform 0.15s',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 5,
                    background: color || LOGO_GRADIENT_VERTICAL,
                },
                '&:hover': clickable ? { boxShadow: `0 10px 22px -12px ${alpha(accent, 0.55)}`, transform: 'translateY(-1px)' } : undefined,
            }}
        >
            {icon ? (
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: accent,
                        bgcolor: alpha(accent, 0.12),
                        '& svg': { fontSize: 24 },
                    }}
                >
                    {icon}
                </Box>
            ) : null}
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {label}
                </Typography>
                {children || (loading
                    ? <Skeleton width={80} height={36} />
                    : (
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3, color: valueColor || HEADER_TITLE_COLOR }}>
                            {formatValue(value, format)}
                        </Typography>
                    ))}
                {hint ? (
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ display: 'block' }}>
                        {hint}
                    </Typography>
                ) : null}
            </Box>
        </Paper>
    );
};

// Grilla de tarjetas: 1 columna en el celular, 2 en tabletas y `columns` (por defecto 4) en escritorio,
// con todas las tarjetas de una fila del mismo alto. `columns` también acepta un objeto por tamaño ({ md: 3, lg: 6 }).
const toColumns = (columns) => {
    const byBreakpoint = typeof columns === 'number' ? { md: columns } : columns;
    return Object.fromEntries(Object.entries(byBreakpoint).map(([breakpoint, count]) => [breakpoint, `repeat(${count}, 1fr)`]));
};

export const StatCardGrid = ({ columns = 4, children, sx }) => (
    <Box
        sx={{
            display: 'grid',
            gap: 2,
            mb: 3,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', ...toColumns(columns) },
            ...sx,
        }}
    >
        {children}
    </Box>
);

export default StatCard;
