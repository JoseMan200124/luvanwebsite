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
    SwapVert as SortIcon
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
// Operation meta (icon, label, color)
// ============================================================

const OPERATION_META = {
    BILLING: { icon: <ReceiptIcon fontSize="small" />, label: 'Facturación', color: '#1976d2', bgColor: '#e3f2fd' },
    PAYMENT: { icon: <TrendingDownIcon fontSize="small" />, label: 'Pago', color: '#2e7d32', bgColor: '#e8f5e9' },
    MORA_PAYMENT: { icon: <WarningAmberIcon fontSize="small" />, label: 'Pago de Mora', color: '#e65100', bgColor: '#fff3e0' },
    CREDIT_PAYMENT: { icon: <CreditScoreIcon fontSize="small" />, label: 'Uso de Crédito', color: '#1565c0', bgColor: '#e3f2fd' },
    OVERPAYMENT: { icon: <TrendingUpIcon fontSize="small" />, label: 'Sobrepago', color: '#2e7d32', bgColor: '#c8e6c9' },
    REVERSAL: { icon: <RestoreIcon fontSize="small" />, label: 'Reversión', color: '#d32f2f', bgColor: '#ffebee' },
    EXONERATION: { icon: <MoneyOffIcon fontSize="small" />, label: 'Exoneración', color: '#7b1fa2', bgColor: '#f3e5f5' },
    ADJUSTMENT: { icon: <InfoIcon fontSize="small" />, label: 'Ajuste', color: '#f57c00', bgColor: '#fff8e1' },
    AUTO_DEBIT: { icon: <ReceiptIcon fontSize="small" />, label: 'Débito Automático', color: '#388e3c', bgColor: '#e8f5e9' },
    FULL_DISCOUNT: { icon: <MoneyOffIcon fontSize="small" />, label: 'Descuento Total', color: '#6a1b9a', bgColor: '#f3e5f5' },
    PENALTY_CLEARANCE: { icon: <MoneyOffIcon fontSize="small" />, label: 'Limpieza de Mora', color: '#6a1b9a', bgColor: '#f3e5f5' },
    DEFAULT: { icon: <MoreHorizIcon fontSize="small" />, label: 'Operación', color: '#757575', bgColor: '#f5f5f5' }
};

function getOperationMeta(op) {
    return OPERATION_META[String(op || '').toUpperCase()] || OPERATION_META.DEFAULT;
}

// ============================================================
// Legendas de operación (texto legible)
// ============================================================

function getAdjustmentFreezeDesc(meta, entry) {
    if (meta.action === 'FREEZE_GLOBAL' || meta.freezeLevel === 'FAMILY') {
        const freezeAmt = Number(meta.originalPenalty || entry.penaltyDueBefore || 0);
        return freezeAmt > 0 ? `Congelamiento global de mora — ${fmt(freezeAmt)}` : 'Congelamiento global de mora';
    }
    if (meta.action === 'UNFREEZE_GLOBAL') return 'Descongelamiento global de mora (reanuda acumulación sin retroactivo)';
    if (meta.action === 'FREEZE_PERIOD') {
        const periods = meta.periodsAffected || [];
        const pLabel = periods.length ? periods.join(', ') : (meta.period || '');
        return pLabel ? `Congelamiento de mora — período(s) ${pLabel}` : 'Congelamiento de mora por período';
    }
    if (meta.action === 'UNFREEZE_PERIOD') return 'Descongelamiento de mora por período';
    if (meta.action === 'RESET') return null; // fallback a description
    return null;
}

function getAdjustmentRouteDesc(meta) {
    if (meta.routeTypeBefore === undefined && meta.routeTypeAfter === undefined) return null;
    const from = meta.routeTypeBefore || '(sin asignar)';
    const to = meta.routeTypeAfter || '(sin asignar)';
    if (meta.scope === 'NEXT_FROM') return `Tipo de ruta configurado para próximos períodos: ${to}`;
    return `Cambio de tipo de ruta de "${from}" a "${to}" en ${(meta.periods || []).length} período(s)`;
}

function getAdjustmentDiscountDesc(meta) {
    if (meta.appliedSpecialFee === undefined && meta.scope !== 'NEXT_FROM') return null;
    const fee = Number(meta.appliedSpecialFee || meta.familySpecialFeeAfter || 0);
    const periods = (meta.periods || []).length;
    if (meta.scope === 'NEXT_FROM') {
        return fee > 0
            ? `Descuento familiar configurado para próximos períodos: ${fmt(fee)}`
            : 'Descuento familiar eliminado para próximos períodos';
    }
    return fee > 0
        ? `Descuento familiar aplicado (${meta.scope}) — ${fmt(fee)} en ${periods} período(s)`
        : `Descuento familiar eliminado (${meta.scope}) en ${periods} período(s)`;
}

function getAdjustmentMiscDesc(meta) {
    if (meta.reason === 'auto_debit_activation' || meta.reason === 'auto_debit_activation_current_month') {
        const exAmt = Number(meta.originalPenalty || 0);
        return exAmt > 0 ? `Exoneración de mora por activación de auto débito — ${fmt(exAmt)}` : 'Exoneración de mora por activación de auto débito';
    }
    if (meta.penaltyExonerated) {
        const exAmt = Number(meta.penaltyExonerated || 0);
        return exAmt > 0 ? `Exoneración — ${fmt(exAmt)}` : 'Exoneración aplicada';
    }
    return null;
}

function getAdjustmentDescription(entry) {
    const meta = entry.metadata || {};
    const freezeDesc = getAdjustmentFreezeDesc(meta, entry);
    if (freezeDesc) return freezeDesc;
    if (meta.action === 'RESET') return entry.description || 'Reset de mora';

    const miscDesc = getAdjustmentMiscDesc(meta);
    if (miscDesc) return miscDesc;

    const routeDesc = getAdjustmentRouteDesc(meta);
    if (routeDesc) return routeDesc;

    const discountDesc = getAdjustmentDiscountDesc(meta);
    if (discountDesc) return discountDesc;

    return entry.description || meta.reason || 'Ajuste administrativo';
}

function getOperationDescription(entry) {
    const op = String(entry.operation || '').toUpperCase();
    const meta = entry.metadata || {};

    switch (op) {
        case 'BILLING': {
            const period = meta.period || '';
            const amount = Number(meta.amount || meta.billedAmount || 0) || Math.max(0, Number(entry.balanceDueAfter - entry.balanceDueBefore || 0));
            return period
                ? `Facturación del período ${formatPeriodLabel(period)} — ${fmt(amount)}`
                : `Facturación mensual — ${fmt(amount)}`;
        }
        case 'PAYMENT': {
            let amt = Math.max(0, Number(entry.balanceDueBefore - entry.balanceDueAfter || 0));
            if (amt === 0) {
                amt = Number(meta.amountToBalance || meta.overpayment || meta.overpaymentAmount || 0);
            }
            const receipt = meta.receiptNumber || '';
            const base = `Pago registrado — ${fmt(amt)}`;
            return receipt ? `${base} (Boleta: ${receipt})` : base;
        }
        case 'MORA_PAYMENT': {
            const amt = Math.max(0, Number(entry.penaltyDueBefore - entry.penaltyDueAfter || 0));
            const receipt = meta.receiptNumber || '';
            const base = `Pago de mora — ${fmt(amt)}`;
            return receipt ? `${base} (Boleta: ${receipt})` : base;
        }
        case 'CREDIT_PAYMENT': {
            const amt = Math.max(0, Number(entry.creditBalanceBefore - entry.creditBalanceAfter || 0));
            return meta.period
                ? `Crédito aplicado a ${formatPeriodLabel(meta.period)} — ${fmt(amt)}`
                : `Uso de crédito disponible — ${fmt(amt)}`;
        }
        case 'OVERPAYMENT':
            return `Sobrepago convertido a crédito — ${fmt(Number(meta.overpaymentAmount || meta.overpayment || 0))}`;
        case 'REVERSAL':
            return entry.description || meta.reason || 'Reversión de transacción';
        case 'EXONERATION': {
            const amt = Number(meta.originalPenalty || meta.exoneratedAmount || meta.amount || 0);
            return amt > 0 ? `Exoneración de mora — ${fmt(amt)}` : (entry.description || 'Exoneración de mora');
        }
        case 'ADJUSTMENT':
            return getAdjustmentDescription(entry);
        case 'AUTO_DEBIT':
            return entry.description || 'Débito automático procesado';
        case 'FULL_DISCOUNT':
            return entry.description || 'Descuento total aplicado';
        case 'PENALTY_CLEARANCE':
            return entry.description || 'Limpieza de mora aplicada';
        default:
            return entry.description || 'Operación del sistema';
    }
}

// ============================================================
// Helper: Extraer operador desde metadata
// ============================================================

function getOperatorLabel(entry) {
    const meta = entry.metadata || {};
    // Buscar en orden de prioridad: frozenBy, unfrozenBy, resetBy, registeredBy
    const operatorId = meta.frozenBy || meta.unfrozenBy || meta.resetBy;
    if (operatorId) return `#${operatorId}`;

    const registeredBy = meta.registeredBy || entry.registeredBy;
    if (registeredBy?.name) return registeredBy.name;
    if (registeredBy?.id) return `#${registeredBy.id}`;

    return null;
}

// ============================================================
// Subcomponente: Timeline Entry (desktop)
// ============================================================

const TimelineEntryDesktop = ({ entry, isLast }) => {
    const opMeta = getOperationMeta(entry.operation);
    const description = getOperationDescription(entry);
    const operator = getOperatorLabel(entry);

    const hasBalanceChange = Number(entry.balanceDueAfter || 0) !== Number(entry.balanceDueBefore || 0);
    const hasPenaltyChange = Number(entry.penaltyDueAfter || 0) !== Number(entry.penaltyDueBefore || 0);
    const hasCreditChange = Number(entry.creditBalanceAfter || 0) !== Number(entry.creditBalanceBefore || 0);
    const hasAnyChange = hasBalanceChange || hasPenaltyChange || hasCreditChange;

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

            {/* Icono */}
            <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: opMeta.bgColor,
                color: opMeta.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1
            }}>
                {opMeta.icon}
            </Box>

            {/* Contenido */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: opMeta.color }}>
                        {opMeta.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatDate(entry.createdAt)}
                    </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 0.75, color: 'text.primary' }}>
                    {description}
                </Typography>

                {/* Operador */}
                {operator && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        Por usuario {operator}
                    </Typography>
                )}

                {/* Efecto en balances */}
                {hasAnyChange && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {hasBalanceChange && (
                            <Chip
                                size="small"
                                label={`Balance: ${fmt(entry.balanceDueBefore)} → ${fmt(entry.balanceDueAfter)}`}
                                color={Number(entry.balanceDueAfter) > Number(entry.balanceDueBefore) ? 'warning' : 'success'}
                                variant="outlined"
                                sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                            />
                        )}
                        {hasPenaltyChange && (
                            <Chip
                                size="small"
                                label={`Mora: ${fmt(entry.penaltyDueBefore)} → ${fmt(entry.penaltyDueAfter)}`}
                                color={Number(entry.penaltyDueAfter) > Number(entry.penaltyDueBefore) ? 'error' : 'success'}
                                variant="outlined"
                                sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                            />
                        )}
                        {hasCreditChange && (
                            <Chip
                                size="small"
                                label={`Crédito: ${fmt(entry.creditBalanceBefore)} → ${fmt(entry.creditBalanceAfter)}`}
                                color={Number(entry.creditBalanceAfter) > Number(entry.creditBalanceBefore) ? 'success' : 'info'}
                                variant="outlined"
                                sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                            />
                        )}
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

// ============================================================
// Subcomponente: Timeline Entry (mobile card)
// ============================================================

const TimelineEntryMobile = ({ entry }) => {
    const opMeta = getOperationMeta(entry.operation);
    const description = getOperationDescription(entry);
    const operator = getOperatorLabel(entry);

    const hasBalanceChange = Number(entry.balanceDueAfter || 0) !== Number(entry.balanceDueBefore || 0);
    const hasPenaltyChange = Number(entry.penaltyDueAfter || 0) !== Number(entry.penaltyDueBefore || 0);
    const hasCreditChange = Number(entry.creditBalanceAfter || 0) !== Number(entry.creditBalanceBefore || 0);

    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                        width: 32, height: 32, borderRadius: '50%',
                        backgroundColor: opMeta.bgColor, color: opMeta.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        {opMeta.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: opMeta.color, fontSize: '0.85rem' }}>
                            {opMeta.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {formatDate(entry.createdAt)}
                        </Typography>
                    </Box>
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {description}
                </Typography>
                {operator && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                        Por usuario {operator}
                    </Typography>
                )}
                {(hasBalanceChange || hasPenaltyChange || hasCreditChange) && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {hasBalanceChange && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: Number(entry.balanceDueAfter) > Number(entry.balanceDueBefore) ? 'warning.dark' : 'success.dark' }}>
                                Balance: {fmt(entry.balanceDueBefore)} → {fmt(entry.balanceDueAfter)}
                            </Typography>
                        )}
                        {hasPenaltyChange && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: Number(entry.penaltyDueAfter) > Number(entry.penaltyDueBefore) ? 'error.dark' : 'success.dark' }}>
                                Mora: {fmt(entry.penaltyDueBefore)} → {fmt(entry.penaltyDueAfter)}
                            </Typography>
                        )}
                        {hasCreditChange && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: Number(entry.creditBalanceAfter) > Number(entry.creditBalanceBefore) ? 'success.dark' : 'info.dark' }}>
                                Crédito: {fmt(entry.creditBalanceBefore)} → {fmt(entry.creditBalanceAfter)}
                            </Typography>
                        )}
                    </Box>
                )}
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

    const fetchFlow = useCallback(async (page, limit) => {
        if (!paymentId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/payments/v2/${paymentId}/flow`, {
                params: { page, limit }
            });
            setFlowData(res.data);
            // Usar ledgerTotal para la paginación (el timeline es el elemento principal)
            setFlowTotal(res.data.pagination?.ledgerTotal || res.data.pagination?.total || 0);
        } catch (err) {
            console.error('[PaymentFlowTimeline] Error loading flow data:', err);
            setError(err.response?.data?.error || 'Error al cargar el flujo de pagos');
        } finally {
            setLoading(false);
        }
    }, [paymentId]);

    useEffect(() => {
        fetchFlow(flowPage, flowLimit);
    }, [fetchFlow, flowPage, flowLimit]);

    // Ordenar ledger según sortOrder y filtrar por rango de fechas
    const ledgerFiltered = useMemo(() => {
        if (!flowData?.ledger) return [];

        let items = [...flowData.ledger];

        // Filtro por fecha desde
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            items = items.filter(e => new Date(e.createdAt || 0).getTime() >= from);
        }
        // Filtro por fecha hasta (incluye todo el día)
        if (dateTo) {
            const toEnd = new Date(dateTo + 'T23:59:59').getTime();
            items = items.filter(e => new Date(e.createdAt || 0).getTime() <= toEnd);
        }

        // Ordenar según sortOrder
        items.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            const diff = timeA - timeB;
            const orderedDiff = sortOrder === 'desc' ? -diff : diff;
            if (orderedDiff !== 0) return orderedDiff;
            const idDiff = (a.id || 0) - (b.id || 0);
            return sortOrder === 'desc' ? -idDiff : idDiff;
        });

        return items;
    }, [flowData?.ledger, sortOrder, dateFrom, dateTo]);

    const payment = flowData?.payment || null;
    const summary = flowData?.summary || null;
    const periods = flowData?.periods || [];
    const transactions = flowData?.transactions || [];

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
    // Empty State: si no hay payment ni ledger entries, mostrar placeholder
    // Si hay payment pero no ledger, igual mostrar el estado financiero
    if (!flowData || (!payment && !flowData.periods?.length && ledgerFiltered.length === 0)) {
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
                        ({flowTotal} operaciones)
                    </Typography>
                )}
            </Typography>

            {/* Controles: Orden + Rango de fechas */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SortIcon fontSize="small" color="action" />
                    <ToggleButtonGroup
                        size="small"
                        value={sortOrder}
                        exclusive
                        onChange={(e, val) => { if (val) setSortOrder(val); }}
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

            {!loading && ledgerFiltered.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">No hay operaciones registradas.</Typography>
                </Paper>
            )}

            {!loading && ledgerFiltered.length > 0 && (
                isMobile ? (
                    <Stack spacing={1.25}>
                        {ledgerFiltered.map((entry, idx) => (
                            <TimelineEntryMobile key={entry.id || idx} entry={entry} />
                        ))}
                    </Stack>
                ) : (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        {ledgerFiltered.map((entry, idx) => (
                            <TimelineEntryDesktop
                                key={entry.id || idx}
                                entry={entry}
                                isLast={idx === ledgerFiltered.length - 1}
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
                        labelRowsPerPage="Operaciones"
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

            {/* ========================================================= */}
            {/* Resumen de transacciones recientes */}
            {/* ========================================================= */}
            {transactions.length > 0 && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f5f7fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InfoIcon fontSize="inherit" />
                        Últimas {transactions.length} transacción(es) cargada(s). Navega las páginas del timeline para ver más.
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default React.memo(PaymentFlowTimeline);
