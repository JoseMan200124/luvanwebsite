import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Chip,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TablePagination,
    TableContainer,
    IconButton as MuiIconButton,
    Collapse,
    ToggleButtonGroup,
    ToggleButton,
    TextField,
    useMediaQuery,
    useTheme,
    Skeleton,
    Alert
} from '@mui/material';
import {
    Receipt as ReceiptIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    AccountBalance as AccountBalanceIcon,
    CreditScore as CreditScoreIcon,
    MoneyOff as MoneyOffIcon,
    WarningAmber as WarningAmberIcon,
    Restore as RestoreIcon,
    InfoOutlined as InfoIcon,
    KeyboardArrowDown as ExpandMoreIcon,
    KeyboardArrowUp as ExpandLessIcon,
    MoreHoriz as MoreHorizIcon,
    SwapVert as SortIcon,
    Autorenew as AutorenewIcon,
    School as SchoolIcon,
    ReceiptLong as ReceiptLongIcon,
    EventAvailable as EventAvailableIcon,
    Block as BlockIcon,
    Groups as GroupsIcon,
    AltRoute as AltRouteIcon,
    LocalOffer as LocalOfferIcon,
    Business as BusinessIcon,
    PauseCircleOutline as PauseCircleIcon,
    Build as BuildIcon,
    AssignmentReturn as AssignmentReturnIcon
} from '@mui/icons-material';
import moment from 'moment';
import api from '../utils/axiosConfig';

// ============================================================
// Helpers
// ============================================================

const fmt = (v) => `Q${Number(v || 0).toFixed(2)}`;

const formatDate = (d) => {
    if (!d) return '—';
    try { return moment.parseZone(d).format('DD/MM/YYYY HH:mm'); } catch (e) { return String(d); }
};

const formatDateShort = (d) => {
    if (!d) return '—';
    try { return moment.parseZone(d).format('DD/MM/YY'); } catch (e) { return String(d); }
};

const formatPeriodLabel = (period) => {
    if (!period) return '';
    const parts = String(period).split('-');
    if (parts.length < 2) return period;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const m = Number.parseInt(parts[1], 10) - 1;
    const monthLabel = monthNames[m] || parts[1];
    return `${monthLabel} ${parts[0]}`;
};

// ============================================================
// Presentación de eventos
// ============================================================
//
// El texto de cada evento lo arma el backend (paymentTimelineService), que es donde
// está el contexto para interpretarlo. Aquí solo se decide cómo se ve.

// Categorías filtrables. El orden es el de los botones.
const CATEGORIES = [
    { key: 'MONEY', label: 'Dinero', color: '#2e7d32' },
    { key: 'PENALTY', label: 'Mora', color: '#e65100' },
    { key: 'STATUS', label: 'Estado', color: '#0277bd' },
    { key: 'CONFIG', label: 'Configuración', color: '#6a1b9a' },
    { key: 'SCHOOL', label: 'Colegio', color: '#455a64' },
    { key: 'SYSTEM', label: 'Sistema', color: '#757575' }
];

const ALL_CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// Solo los eventos de dinero mueven saldos: el resto se dibuja con círculo hueco y sin
// chips de balance, para que un cambio de configuración no se confunda con un pago.
const MONEY_CATEGORIES = new Set(['MONEY', 'PENALTY']);

// Icono por tipo de evento; si el tipo no está, se cae al icono de su categoría.
const TYPE_ICONS = {
    BILLING: <ReceiptIcon fontSize="small" />,
    PAYMENT: <TrendingDownIcon fontSize="small" />,
    MORA_PAYMENT: <WarningAmberIcon fontSize="small" />,
    CREDIT_PAYMENT: <CreditScoreIcon fontSize="small" />,
    OVERPAYMENT: <TrendingUpIcon fontSize="small" />,
    EXONERATION: <MoneyOffIcon fontSize="small" />,
    ADJUSTMENT: <InfoIcon fontSize="small" />,
    AUTO_DEBIT: <AutorenewIcon fontSize="small" />,
    FULL_DISCOUNT: <MoneyOffIcon fontSize="small" />,
    PARTIAL_DISCOUNT: <MoneyOffIcon fontSize="small" />,
    PENALTY_CLEARANCE: <MoneyOffIcon fontSize="small" />,
    PENALTY_FREEZE: <BlockIcon fontSize="small" />,
    PENALTY_RESET: <RestoreIcon fontSize="small" />,
    PENALTY_MANUAL_ADJUSTMENT: <InfoIcon fontSize="small" />,
    PENALTY_EXONERATION: <MoneyOffIcon fontSize="small" />,
    PENALTY_ACCRUED: <TrendingUpIcon fontSize="small" />,
    ENROLLMENT_BILLING: <SchoolIcon fontSize="small" />,
    ENROLLMENT_PAYMENT: <SchoolIcon fontSize="small" />,
    ENROLLMENT_ADJUSTMENT: <SchoolIcon fontSize="small" />,
    SERVICE_STATUS_CHANGED: <PauseCircleIcon fontSize="small" />,
    FAMILY_CONFIG_CHANGED: <GroupsIcon fontSize="small" />,
    PAYMENT_CONFIG_CHANGED: <AutorenewIcon fontSize="small" />,
    ROUTE_TYPE_CHANGED: <AltRouteIcon fontSize="small" />,
    FAMILY_DISCOUNT_CHANGED: <LocalOfferIcon fontSize="small" />,
    AUTO_DEBIT_CHANGED: <AutorenewIcon fontSize="small" />,
    SCHOOL_FEE_CHANGED: <BusinessIcon fontSize="small" />,
    SCHOOL_POLICY_CHANGED: <BusinessIcon fontSize="small" />,
    PAYMENT_REBUILT: <BuildIcon fontSize="small" />,
    CREDIT_REFUND: <AssignmentReturnIcon fontSize="small" />
};

const CATEGORY_STYLE = {
    MONEY: { color: '#2e7d32', bgColor: '#e8f5e9', icon: <TrendingDownIcon fontSize="small" /> },
    PENALTY: { color: '#e65100', bgColor: '#fff3e0', icon: <WarningAmberIcon fontSize="small" /> },
    STATUS: { color: '#0277bd', bgColor: '#e1f5fe', icon: <PauseCircleIcon fontSize="small" /> },
    CONFIG: { color: '#6a1b9a', bgColor: '#f3e5f5', icon: <GroupsIcon fontSize="small" /> },
    SCHOOL: { color: '#455a64', bgColor: '#eceff1', icon: <BusinessIcon fontSize="small" /> },
    SYSTEM: { color: '#757575', bgColor: '#f5f5f5', icon: <MoreHorizIcon fontSize="small" /> }
};

function getEventStyle(event) {
    const base = CATEGORY_STYLE[event.category] || CATEGORY_STYLE.SYSTEM;
    return { ...base, icon: TYPE_ICONS[event.type] || base.icon };
}

function isMoneyEvent(event) {
    return MONEY_CATEGORIES.has(event.category);
}

// ============================================================
// Desglose de un evento (a qué se aplicó el dinero / qué cambió)
// ============================================================

const BREAKDOWN_MONEY_FIELDS = [
    { keys: ['amountToBalance', 'creditApplied', 'appliedAmount', 'amountApplied'], label: 'Aplicado a saldo' },
    { keys: ['extraordinaryDiscountAppliedToBalance', 'discountApplied'], label: 'Descuento extraordinario aplicado' },
    { keys: ['overpayment', 'overpaymentAmount'], label: 'Sobrepago → crédito' },
    { keys: ['unusedExtraordinaryDiscount'], label: 'Descuento no usado → crédito' },
    { keys: ['creditToAdd'], label: 'Total generado a crédito' },
    { keys: ['penaltyExonerated'], label: 'Mora exonerada' },
    { keys: ['refundedAmount'], label: 'Reintegrado' },
];

function firstNumeric(meta, keys) {
    for (const key of keys) {
        const val = Number(meta?.[key]);
        if (Number.isFinite(val) && val > 0.01) return val;
    }
    return 0;
}

/**
 * Reúne el detalle expandible de un evento: los montos por concepto y el desglose por
 * período que arma el backend, o —en eventos de contexto— la lista de campos que
 * cambiaron.
 */
function getEventBreakdown(event) {
    const meta = event.metadata || {};
    const moneyRows = BREAKDOWN_MONEY_FIELDS
        .map(({ keys, label }) => ({ label, amount: firstNumeric(meta, keys) }))
        .filter(row => row.amount > 0);
    const periods = Array.isArray(event.periodBreakdown) ? event.periodBreakdown : [];
    const changes = Array.isArray(event.changes) ? event.changes : [];
    return { moneyRows, periods, changes, hasBreakdown: moneyRows.length > 0 || periods.length > 0 || changes.length > 0 };
}

const EventBreakdownPanel = ({ event }) => {
    const [open, setOpen] = useState(false);
    const { moneyRows, periods, changes, hasBreakdown } = getEventBreakdown(event);

    if (!hasBreakdown) return null;

    const isContext = !isMoneyEvent(event);
    const label = isContext ? 'Detalle del cambio' : 'Desglose de aplicación';

    return (
        <Box sx={{ mt: 0.75 }}>
            <Box
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                onClick={() => setOpen(!open)}
            >
                <ReceiptLongIcon sx={{ fontSize: '1rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {label}
                </Typography>
                {open ? <ExpandLessIcon sx={{ fontSize: '1rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '1rem' }} />}
            </Box>
            <Collapse in={open}>
                <Box sx={{ mt: 0.75, p: 1.25, bgcolor: '#fafafa', borderRadius: 1.5, border: '1px solid #e8e8e8' }}>
                    {changes.length > 0 && (
                        <Stack spacing={0.5} sx={{ mb: (moneyRows.length || periods.length) ? 1 : 0 }}>
                            {changes.map((change, idx) => (
                                <Typography key={`${change.field}-${idx}`} variant="caption" sx={{ fontSize: '0.72rem' }}>
                                    <Box component="span" sx={{ fontWeight: 600 }}>{change.field}</Box>
                                    {': '}
                                    {String(change.before ?? '—')} → {String(change.after ?? '—')}
                                </Typography>
                            ))}
                        </Stack>
                    )}
                    {moneyRows.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: periods.length ? 1 : 0 }}>
                            {moneyRows.map(row => (
                                <Chip
                                    key={row.label}
                                    size="small"
                                    label={`${row.label}: ${fmt(row.amount)}`}
                                    variant="outlined"
                                    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                                />
                            ))}
                        </Stack>
                    )}
                    {periods.length > 0 && (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', py: 0.5 }}>Período</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', py: 0.5 }}>Aplicado</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', py: 0.5 }}>Desc.</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', py: 0.5 }}>Saldo período</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', py: 0.5 }}>Mora período</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {periods.map((p, idx) => (
                                        <TableRow key={`${p.period}-${idx}`}>
                                            <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>{formatPeriodLabel(p.period) || '—'}</TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5, color: 'success.main' }}>{fmt(p.amountApplied)}</TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5, color: p.discountApplied > 0 ? 'error.main' : undefined }}>
                                                {p.discountApplied > 0 ? fmt(p.discountApplied) : '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                                {p.before && p.after ? `${fmt(p.before.amountDue)} → ${fmt(p.after.amountDue)}` : '—'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                                {p.penaltyBefore && p.penaltyAfter ? `${fmt(p.penaltyBefore.penaltyDue)} → ${fmt(p.penaltyAfter.penaltyDue)}` : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
};

// ============================================================
// Chips de efecto en balances (solo eventos de dinero)
// ============================================================

const BalanceChips = ({ event }) => {
    const hasBalance = event.balanceBefore != null && event.balanceAfter != null
        && Number(event.balanceAfter) !== Number(event.balanceBefore);
    const hasPenalty = event.penaltyBefore != null && event.penaltyAfter != null
        && Number(event.penaltyAfter) !== Number(event.penaltyBefore);
    const hasCredit = event.creditBefore != null && event.creditAfter != null
        && Number(event.creditAfter) !== Number(event.creditBefore);

    // En operaciones de inscripción el saldo que se mueve es el del cargo de inscripción,
    // no el de la mensualidad: sus columnas de balance no cambian y mostrarlas engañaría.
    const meta = event.metadata || {};
    const enrollmentShift = meta.enrollmentAmountDueBefore !== undefined && meta.enrollmentAmountDueAfter !== undefined
        ? { before: Number(meta.enrollmentAmountDueBefore || 0), after: Number(meta.enrollmentAmountDueAfter || 0) }
        : null;

    if (!hasBalance && !hasPenalty && !hasCredit && !enrollmentShift) return null;

    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {enrollmentShift && (
                <Chip
                    size="small"
                    icon={<SchoolIcon sx={{ fontSize: '0.85rem !important' }} />}
                    label={`Inscripción: ${fmt(enrollmentShift.before)} → ${fmt(enrollmentShift.after)}`}
                    variant="outlined"
                    sx={{
                        height: 22,
                        color: '#00695c',
                        borderColor: '#4db6ac',
                        '& .MuiChip-icon': { color: '#00695c' },
                        '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 }
                    }}
                />
            )}
            {hasBalance && (
                <Chip
                    size="small"
                    label={`Balance: ${fmt(event.balanceBefore)} → ${fmt(event.balanceAfter)}`}
                    color={Number(event.balanceAfter) > Number(event.balanceBefore) ? 'warning' : 'success'}
                    variant="outlined"
                    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                />
            )}
            {hasPenalty && (
                <Chip
                    size="small"
                    label={`Mora: ${fmt(event.penaltyBefore)} → ${fmt(event.penaltyAfter)}`}
                    color={Number(event.penaltyAfter) > Number(event.penaltyBefore) ? 'error' : 'success'}
                    variant="outlined"
                    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                />
            )}
            {hasCredit && (
                <Chip
                    size="small"
                    label={`Crédito: ${fmt(event.creditBefore)} → ${fmt(event.creditAfter)}`}
                    color={Number(event.creditAfter) > Number(event.creditBefore) ? 'success' : 'info'}
                    variant="outlined"
                    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                />
            )}
        </Stack>
    );
};

// ============================================================
// Subcomponente: entrada de la línea de tiempo (desktop)
// ============================================================

const TimelineEventDesktop = ({ event, isLast }) => {
    const style = getEventStyle(event);
    const isMoney = isMoneyEvent(event);

    // Movimiento anulado por una reversión: se conserva para que la línea de tiempo
    // muestre el flujo completo (qué se pagó y qué lo revirtió), pero ya no cuenta.
    const isSuperseded = !!event.superseded;

    return (
        <Box sx={{ display: 'flex', gap: 2, position: 'relative', pb: isLast ? 1 : 3 }}>
            {/* Conector vertical */}
            {!isLast && (
                <Box sx={{
                    position: 'absolute',
                    left: 19,
                    top: 38,
                    bottom: 0,
                    width: 2,
                    backgroundColor: '#e0e0e0'
                }} />
            )}

            {/* Icono. Relleno = movió dinero; hueco = solo cambió el contexto. */}
            <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: isSuperseded ? '#f0f0f0' : (isMoney ? style.bgColor : 'transparent'),
                border: isMoney ? 'none' : `2px solid ${isSuperseded ? '#bdbdbd' : style.color}`,
                color: isSuperseded ? '#9e9e9e' : style.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1,
                boxSizing: 'border-box'
            }}>
                {style.icon}
            </Box>

            {/* Contenido */}
            <Box sx={{ flex: 1, minWidth: 0, opacity: isSuperseded ? 0.6 : 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: isSuperseded ? 'text.disabled' : style.color }}>
                        {event.title}
                    </Typography>
                    {isSuperseded && (
                        <Chip
                            size="small"
                            icon={<BlockIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={event.supersededAt ? `Revertido ${formatDateShort(event.supersededAt)}` : 'Revertido'}
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.6, fontWeight: 700 } }}
                        />
                    )}
                    <Typography variant="caption" color="text.secondary">
                        registrado {formatDate(event.occurredAt)}
                    </Typography>
                    {event.realPaymentDate && (
                        <Chip
                            size="small"
                            icon={<EventAvailableIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={`Fecha de pago: ${formatDateShort(event.realPaymentDate)}`}
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.6 } }}
                        />
                    )}
                </Box>
                <Typography
                    variant="body2"
                    sx={{ mb: 0.75, color: 'text.primary', textDecoration: isSuperseded ? 'line-through' : 'none' }}
                >
                    {event.description}
                </Typography>

                {event.actor?.name && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        Por {event.actor.name}
                    </Typography>
                )}
                {!event.actor?.name && event.actor?.id && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        Por usuario #{event.actor.id}
                    </Typography>
                )}

                <EventBreakdownPanel event={event} />

                {isMoney && <BalanceChips event={event} />}
            </Box>
        </Box>
    );
};

// ============================================================
// Subcomponente: entrada de la línea de tiempo (móvil)
// ============================================================

const TimelineEventMobile = ({ event }) => {
    const style = getEventStyle(event);
    const isMoney = isMoneyEvent(event);
    const isSuperseded = !!event.superseded;

    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, opacity: isSuperseded ? 0.6 : 1 }}>
            <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: isSuperseded ? '#f0f0f0' : (isMoney ? style.bgColor : 'transparent'),
                        border: isMoney ? 'none' : `2px solid ${isSuperseded ? '#bdbdbd' : style.color}`,
                        color: isSuperseded ? '#9e9e9e' : style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxSizing: 'border-box'
                    }}>
                        {style.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: isSuperseded ? 'text.disabled' : style.color, fontSize: '0.85rem' }}>
                            {event.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            registrado {formatDate(event.occurredAt)}
                        </Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {isSuperseded && (
                        <Chip
                            size="small"
                            icon={<BlockIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={event.supersededAt ? `Revertido ${formatDateShort(event.supersededAt)}` : 'Revertido'}
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.6, fontWeight: 700 } }}
                        />
                    )}
                    {event.realPaymentDate && (
                        <Chip
                            size="small"
                            icon={<EventAvailableIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={`Fecha de pago: ${formatDateShort(event.realPaymentDate)}`}
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.6 } }}
                        />
                    )}
                </Stack>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', textDecoration: isSuperseded ? 'line-through' : 'none' }}>
                    {event.description}
                </Typography>
                {(event.actor?.name || event.actor?.id) && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                        Por {event.actor.name || `usuario #${event.actor.id}`}
                    </Typography>
                )}
                <EventBreakdownPanel event={event} />
                {isMoney && <BalanceChips event={event} />}
            </Stack>
        </Paper>
    );
};

// ============================================================
// Subcomponente: Period Breakdown Table
// ============================================================

const PeriodBreakdownTable = ({ periods }) => {
    const [open, setOpen] = useState(false);

    if (!periods || periods.length === 0) return null;

    return (
        <Box sx={{ mt: 2 }}>
            <Box
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                    p: 1.5, bgcolor: '#f5f7fa', borderRadius: 1.5, border: '1px solid #e0e0e0',
                    '&:hover': { bgcolor: '#eeeff3' }
                }}
                onClick={() => setOpen(!open)}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    📊 Distribución por Período ({periods.length})
                </Typography>
                <MuiIconButton size="small">
                    {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </MuiIconButton>
            </Box>
            <Collapse in={open}>
                <TableContainer sx={{ mt: 1 }}>
                    <Table size="small" sx={{ minWidth: 650 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Período</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Facturado</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Desc.</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Neto</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Pagado</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Mora Gen.</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Mora Pag.</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Mora Pend.</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Saldo Total</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Estado</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {periods.map((p) => {
                                const balance = Number(p.netAmount || 0) - Number(p.amountPaid || 0) - Number(p.extraordinaryTariffDiscount || 0);
                                const isPaid = p.status === 'PAGADO';
                                const isPartial = p.status === 'PARCIAL';
                                return (
                                    <TableRow key={p.id || p.period} hover sx={{ bgcolor: isPaid ? '#f1f8e9' : isPartial ? '#fff8e1' : undefined }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                            {formatPeriodLabel(p.period)}
                                            {p.routeType && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                                    {p.routeType} · {p.studentsCount || 1} alumno(s)
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{fmt(p.originalAmount)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'error.main' }}>{fmt(p.discountApplied)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{fmt(p.netAmount)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'success.main' }}>{fmt(p.amountPaid)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'error.main' }}>{fmt(p.penaltyAmount)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'success.main' }}>{fmt(p.penaltyPaid)}</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem', color: Number(p.penaltyDue) > 0 ? 'error.main' : undefined }}>{fmt(p.penaltyDue)}</TableCell>
                                        <TableCell align="right" sx={{
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: balance > 0 ? 'warning.dark' : 'success.dark'
                                        }}>
                                            {fmt(balance)}
                                        </TableCell>
                                        <TableCell sx={{ py: 1.5 }}>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                                <Chip
                                                    label={`Tarifa: ${p.status}`}
                                                    size="small"
                                                    color={isPaid ? 'success' : isPartial ? 'warning' : 'default'}
                                                    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75, fontWeight: 600 } }}
                                                />
                                                {p.penaltyStatus && p.penaltyStatus !== 'SIN_MORA' && (
                                                    <Chip
                                                        label={`Mora: ${p.penaltyStatus}`}
                                                        size="small"
                                                        variant="outlined"
                                                        color={p.penaltyStatus === 'PAGADA' || p.penaltyStatus === 'EXONERADA' ? 'success' : 'error'}
                                                        sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75, fontWeight: 600 } }}
                                                    />
                                                )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                {periods.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap', p: 1, bgcolor: '#fafafa', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Total Facturado: <Box component="span" sx={{ color: 'text.primary' }}>{fmt(periods.reduce((s, p) => s + Number(p.originalAmount || 0), 0))}</Box>
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Total Pagado: <Box component="span" sx={{ color: 'success.main' }}>{fmt(periods.reduce((s, p) => s + Number(p.amountPaid || 0), 0))}</Box>
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Total Mora: <Box component="span" sx={{ color: 'error.main' }}>{fmt(periods.reduce((s, p) => s + Number(p.penaltyDue || 0), 0))}</Box>
                        </Typography>
                    </Box>
                )}
            </Collapse>
        </Box>
    );
};

// ============================================================
// Componente Principal: PaymentFlowTimeline
// ============================================================

const PaymentFlowTimeline = ({ paymentId, userId, familyLastName }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [flowData, setFlowData] = useState(null);
    const [flowPage, setFlowPage] = useState(0);
    const [flowLimit, setFlowLimit] = useState(20);
    const [flowTotal, setFlowTotal] = useState(0);
    const [sortOrder, setSortOrder] = useState('desc');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [categories, setCategories] = useState(ALL_CATEGORY_KEYS);

    const fetchFlow = useCallback(async (page, limit, order, activeCategories) => {
        if (!paymentId) return;
        setLoading(true);
        setError(null);
        try {
            const params = { page, limit, sortOrder: order };
            // Sin filtro cuando están todas: evita mandar una lista larga en cada consulta.
            if (activeCategories.length > 0 && activeCategories.length < ALL_CATEGORY_KEYS.length) {
                params.categories = activeCategories.join(',');
            }
            const res = await api.get(`/payments/v2/${paymentId}/flow`, { params });
            setFlowData(res.data);
            setFlowTotal(res.data.timeline?.total || 0);
        } catch (err) {
            console.error('[PaymentFlowTimeline] Error loading flow data:', err);
            setError(err.response?.data?.error || 'Error al cargar el flujo de pagos');
        } finally {
            setLoading(false);
        }
    }, [paymentId]);

    useEffect(() => {
        fetchFlow(flowPage, flowLimit, sortOrder, categories);
    }, [fetchFlow, flowPage, flowLimit, sortOrder, categories]);

    // El backend ya ordena, pagina y filtra por categoría; aquí solo queda el rango de
    // fechas, que es un filtro local sobre la página cargada.
    const eventsFiltered = useMemo(() => {
        const events = flowData?.timeline?.events || [];
        if (!dateFrom && !dateTo) return events;

        return events.filter((event) => {
            const at = new Date(event.occurredAt || 0).getTime();
            if (dateFrom && at < new Date(dateFrom).getTime()) return false;
            if (dateTo && at > new Date(`${dateTo}T23:59:59`).getTime()) return false;
            return true;
        });
    }, [flowData?.timeline?.events, dateFrom, dateTo]);

    const payment = flowData?.payment || null;
    const summary = flowData?.summary || null;
    const periods = flowData?.periods || [];
    const enrollmentPayment = flowData?.enrollmentPayment || null;

    const handleCategoryChange = (event, next) => {
        // Deseleccionar todo dejaría la vista vacía sin decir por qué: se vuelve a todas.
        setCategories(next.length === 0 ? ALL_CATEGORY_KEYS : next);
        setFlowPage(0);
    };

    // ============================================================
    // Loading State
    // ============================================================
    if (loading && !flowData) {
        return (
            <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Skeleton variant="rounded" height={80} />
                    <Skeleton variant="rounded" height={60} />
                    <Skeleton variant="rounded" height={200} />
                </Stack>
            </Box>
        );
    }

    // ============================================================
    // Error State
    // ============================================================
    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    // ============================================================
    // Empty State
    // ============================================================
    // Si hay payment pero no eventos, igual se muestra el estado financiero.
    if (!flowData || (!payment && !flowData.periods?.length && eventsFiltered.length === 0)) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2, mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    No hay datos de flujo disponibles para esta familia.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box sx={{ mt: 1 }}>
            {/* ========================================================= */}
            {/* SECCIÓN 1: Estado Financiero Actual */}
            {/* ========================================================= */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: '#fafafa' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccountBalanceIcon fontSize="small" color="primary" />
                    Estado Financiero Actual
                    {familyLastName && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400, ml: 0.5 }}>
                            — {familyLastName}
                        </Typography>
                    )}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    <Box sx={{ flex: '1 1 130px', minWidth: 110, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
                        <Typography variant="caption" color="text.secondary">Tarifa Pendiente</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: Number(payment?.balanceDue || 0) > 0 ? 'warning.dark' : 'success.dark' }}>
                            {fmt(payment?.balanceDue || 0)}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: '1 1 130px', minWidth: 110, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
                        <Typography variant="caption" color="text.secondary">Mora Pendiente</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: Number(payment?.penaltyDue || 0) > 0 ? 'error.main' : 'success.dark' }}>
                            {fmt(payment?.penaltyDue || 0)}
                        </Typography>
                    </Box>
                    {/* Solo si la familia tiene cargo de inscripción para este ciclo */}
                    {enrollmentPayment && (
                        <Box sx={{ flex: '1 1 130px', minWidth: 110, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" color="text.secondary">Inscripción Pendiente</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 700, color: Number(enrollmentPayment.amountDue || 0) > 0 ? 'warning.dark' : 'success.dark' }}>
                                {fmt(enrollmentPayment.amountDue || 0)}
                            </Typography>
                        </Box>
                    )}
                    <Box sx={{ flex: '1 1 130px', minWidth: 110, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
                        <Typography variant="caption" color="text.secondary">Crédito Disponible</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: Number(payment?.creditBalance || 0) > 0 ? 'info.main' : 'text.disabled' }}>
                            {fmt(payment?.creditBalance || 0)}
                        </Typography>
                    </Box>
                </Box>

                {summary && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {Number(summary.totalExonerated || 0) > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Exonerado: {fmt(summary.totalExonerated)}
                            </Typography>
                        )}
                        {Number(summary.totalExtraDiscount || 0) > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Descuentos Extra: {fmt(summary.totalExtraDiscount)}
                            </Typography>
                        )}
                    </Box>
                )}
            </Paper>

            {/* ========================================================= */}
            {/* SECCIÓN 2: Línea de Tiempo */}
            {/* ========================================================= */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                📋 Línea de Tiempo de Operaciones
                {flowTotal > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                        ({flowTotal} evento{flowTotal === 1 ? '' : 's'})
                    </Typography>
                )}
            </Typography>

            {/* Filtro por categoría */}
            <Box sx={{ mb: 1.5 }}>
                <ToggleButtonGroup
                    size="small"
                    value={categories}
                    onChange={handleCategoryChange}
                    sx={{ flexWrap: 'wrap' }}
                >
                    {CATEGORIES.map((category) => (
                        <ToggleButton
                            key={category.key}
                            value={category.key}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                px: 1.25,
                                '&.Mui-selected': { color: category.color, fontWeight: 700 }
                            }}
                        >
                            {category.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {/* Controles: Orden + Rango de fechas */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SortIcon fontSize="small" color="action" />
                    <ToggleButtonGroup
                        size="small"
                        value={sortOrder}
                        exclusive
                        onChange={(e, val) => { if (val) { setSortOrder(val); setFlowPage(0); } }}
                    >
                        <ToggleButton value="desc" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
                            Más reciente
                        </ToggleButton>
                        <ToggleButton value="asc" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
                            Más antiguo
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
                <TextField
                    label="Desde"
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <TextField
                    label="Hasta"
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                {(dateFrom || dateTo) && (
                    <Chip
                        label="Limpiar filtros"
                        size="small"
                        onDelete={() => { setDateFrom(''); setDateTo(''); }}
                        sx={{ height: 24, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                    />
                )}
            </Box>

            {loading && (
                <Stack spacing={1.5}>
                    <Skeleton variant="rounded" height={60} />
                    <Skeleton variant="rounded" height={60} />
                    <Skeleton variant="rounded" height={60} />
                </Stack>
            )}

            {!loading && eventsFiltered.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">No hay operaciones registradas.</Typography>
                </Paper>
            )}

            {!loading && eventsFiltered.length > 0 && (
                isMobile ? (
                    <Stack spacing={1.25}>
                        {eventsFiltered.map((event, idx) => (
                            <TimelineEventMobile key={event.id || idx} event={event} />
                        ))}
                    </Stack>
                ) : (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        {eventsFiltered.map((event, idx) => (
                            <TimelineEventDesktop
                                key={event.id || idx}
                                event={event}
                                isLast={idx === eventsFiltered.length - 1}
                            />
                        ))}
                    </Paper>
                )
            )}

            {/* Paginación del timeline */}
            {flowTotal > flowLimit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1 }}>
                    <TablePagination
                        component="div"
                        count={flowTotal}
                        page={flowPage}
                        onPageChange={(e, newPage) => setFlowPage(newPage)}
                        rowsPerPage={flowLimit}
                        onRowsPerPageChange={(e) => {
                            setFlowLimit(parseInt(e.target.value, 10));
                            setFlowPage(0);
                        }}
                        rowsPerPageOptions={[10, 20, 50]}
                        labelRowsPerPage="Eventos"
                        sx={{
                            '& .MuiTablePagination-toolbar': { justifyContent: 'flex-start', paddingLeft: 0, flexWrap: 'wrap' },
                            '& .MuiTablePagination-spacer': { display: 'none' }
                        }}
                    />
                </Box>
            )}

            {/* ========================================================= */}
            {/* SECCIÓN 3: Distribución por Período */}
            {/* ========================================================= */}
            <PeriodBreakdownTable periods={periods} />
        </Box>
    );
};

export default React.memo(PaymentFlowTimeline);
