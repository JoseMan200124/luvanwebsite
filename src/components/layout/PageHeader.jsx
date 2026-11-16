// src/components/layout/PageHeader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import {
    ArrowBack,
    Badge,
    BarChart,
    Business,
    CalendarToday,
    DirectionsBus,
    History,
    People,
    School,
    SpaceDashboard,
} from '@mui/icons-material';
import PageHeaderActions from './PageHeaderActions';
import { MODULE_GROUPS } from './moduleGroups';
import { CLIENT_TONES, HEADER_TITLE_COLOR, HERO_SHADOW, LOGO_COLORS, LOGO_GRADIENT, SIMPLE_HEADER_SHADOW } from '../../theme/tokens';

const TONE_ICONS = { school: School, corporate: Business };

const MODULE_ICONS = {
    [MODULE_GROUPS.buses]: DirectionsBus,
    [MODULE_GROUPS.personal]: People,
    [MODULE_GROUPS.monitoras]: Badge,
    [MODULE_GROUPS.clientes]: Business,
    [MODULE_GROUPS.historiales]: History,
    [MODULE_GROUPS.reportes]: BarChart,
};
const TITLE_FONT_SIZE = { xs: '1.6rem', sm: '2.125rem' };
const HERO_CHIP_SX = {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    '& .MuiChip-icon': { color: 'white' },
};

// name === undefined → solo el título. name null/'' → "Cargando...".
const buildTitle = (title, name) => {
    if (name === undefined) {
        return title;
    }
    const entityName = name || 'Cargando...';
    return title ? `${title} - ${entityName}` : entityName;
};

const HeroHeader = ({ tone, title, name, subtitle, icon, back, period, chips, meta, actions }) => {
    const toneTokens = CLIENT_TONES[tone] || CLIENT_TONES.school;
    const Icon = icon || TONE_ICONS[tone] || School;
    const visibleChips = (chips || []).filter(Boolean);
    const visibleMeta = (meta || []).filter(Boolean);
    const hasContext = Boolean(period) || visibleChips.length > 0 || visibleMeta.length > 0;

    return (
        <Card sx={{ mb: 3, background: toneTokens.gradient, color: 'white', boxShadow: HERO_SHADOW }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                {back && (
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={back.onClick}
                        sx={{ color: 'white', ml: -1, mb: 1.5, '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                    >
                        {back.label}
                    </Button>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Icon sx={{ fontSize: 40, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{ fontSize: TITLE_FONT_SIZE, lineHeight: 1.2, overflowWrap: 'anywhere', mb: (hasContext || subtitle) ? 1 : 0 }}
                        >
                            {buildTitle(title, name)}
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', lg: 'row' },
                                alignItems: { xs: 'stretch', lg: 'center' },
                                justifyContent: 'space-between',
                                gap: 2,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                {subtitle && (
                                    <Typography variant="h6" component="p" sx={{ opacity: 0.9, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                                        {subtitle}
                                    </Typography>
                                )}
                                {hasContext && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: subtitle ? 1 : 0 }}>
                                        {period && <Chip icon={<CalendarToday />} label={period} sx={HERO_CHIP_SX} />}
                                        {visibleChips.map((chip) => {
                                            const node = <Chip key={chip.key} icon={chip.icon} label={chip.label} sx={{ ...HERO_CHIP_SX, ...(chip.sx || {}) }} />;
                                            return chip.tooltip ? <Tooltip key={chip.key} title={chip.tooltip}>{node}</Tooltip> : node;
                                        })}
                                        {visibleMeta.map((text) => (
                                            <Typography key={text} variant="body1" sx={{ opacity: 0.9 }}>
                                                {text}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                            <PageHeaderActions actions={actions} variant="hero" tone={tone} />
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

// Tarjeta blanca con una franja superior y el cuadro del ícono en el degradado del logo. La sombra es difuminada
// y solo hacia abajo, para que no marque un borde y no se vea como un bloque aparte de la página. Eyebrow, título y subtítulo a la izquierda y las
// acciones a la derecha (por debajo de lg, debajo del texto).
const SimpleHeader = ({ eyebrow, title, subtitle, icon, actions, children, tabs }) => {
    const Icon = icon || MODULE_ICONS[eyebrow] || SpaceDashboard;
    return (
        <Card sx={{ mb: 3, overflow: 'hidden', boxShadow: SIMPLE_HEADER_SHADOW }}>
            <Box sx={{ height: 4, background: LOGO_GRADIENT }} />
            <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: LOGO_GRADIENT,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Icon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: { xs: 'column', lg: 'row' },
                            alignItems: { xs: 'stretch', lg: 'center' },
                            justifyContent: 'space-between',
                            gap: 2,
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            {eyebrow && (
                                <Typography sx={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: LOGO_COLORS.blue, fontWeight: 700, mb: 0.5 }}>
                                    {eyebrow}
                                </Typography>
                            )}
                            <Typography
                                variant="h4"
                                component="h1"
                                sx={{ fontWeight: 700, color: HEADER_TITLE_COLOR, fontSize: TITLE_FONT_SIZE, lineHeight: 1.2, overflowWrap: 'anywhere' }}
                            >
                                {title}
                            </Typography>
                            {subtitle && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {subtitle}
                                </Typography>
                            )}
                        </Box>
                        <PageHeaderActions actions={actions} variant="simple" />
                    </Box>
                </Box>
                {children && <Box sx={{ mt: 2 }}>{children}</Box>}
            </CardContent>
            {tabs && <Box sx={{ borderTop: 1, borderColor: 'divider', px: { xs: 1, sm: 2 } }}>{tabs}</Box>}
        </Card>
    );
};

/** Encabezado estándar de página. `hero` para colegio/corporación; `simple` para pantallas globales. */
const PageHeader = ({ variant = 'simple', ...props }) => (
    variant === 'hero' ? <HeroHeader {...props} /> : <SimpleHeader {...props} />
);

const actionsPropType = PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.bool]));

PageHeader.propTypes = {
    variant: PropTypes.oneOf(['hero', 'simple']),
    title: PropTypes.node,
    subtitle: PropTypes.node,
    children: PropTypes.node,
    tabs: PropTypes.node,
    actions: actionsPropType,
    eyebrow: PropTypes.node,
    tone: PropTypes.oneOf(['school', 'corporate']),
    name: PropTypes.string,
    icon: PropTypes.elementType,
    back: PropTypes.shape({ label: PropTypes.string, onClick: PropTypes.func }),
    period: PropTypes.string,
    chips: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.bool])),
    meta: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.bool])),
};

export default PageHeader;
