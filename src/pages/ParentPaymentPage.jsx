// src/pages/ParentPaymentPage.jsx
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Modal,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    AccessTime as AccessTimeIcon,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    AcUnit as AcUnitIcon,
    Analytics as AnalyticsIcon,
    Business as BusinessIcon,
    CalendarMonth as CalendarMonthIcon,
    CameraAlt as CameraAltIcon,
    CheckCircle as CheckCircleIcon,
    Close as CloseIcon,
    CloudUpload as CloudUploadIcon,
    CreditCard as CreditCardIcon,
    ErrorOutline as ErrorOutlineIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Image as ImageIcon,
    InfoOutlined as InfoOutlinedIcon,
    ReceiptLong as ReceiptLongIcon,
    TrendingUp as TrendingUpIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import Webcam from 'react-webcam';
import ParentNavbar from '../components/ParentNavbar';
import api from '../utils/axiosConfig';
import { AuthContext } from '../context/AuthProvider';

const PRIMARY_COLOR = '#0D3FE2';
const BACKGROUND_COLOR = '#F8F9FA';
const CARD_COLOR = '#FFFFFF';
const TEXT_COLOR = '#1F2937';
const MUTED_COLOR = '#6B7280';
const BORDER_COLOR = '#E5E7EB';

const PAYMENT_TABS = [
    { key: 'resumen', label: 'Resumen', icon: AccountBalanceWalletIcon },
    { key: 'periodos', label: 'Períodos', icon: CalendarMonthIcon },
    { key: 'historial', label: 'Historial', icon: AccessTimeIcon },
    { key: 'boletas', label: 'Boletas', icon: ReceiptLongIcon },
];

const SPANISH_MONTHS = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
];

const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value) => `Q${toNumber(value).toFixed(2)}`;

const formatDate = (value) => {
    if (!value) return 'N/A';

    const datePart = String(value).split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatPeriodName = (period, fallback) => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
    if (!match) return fallback || period || 'Período';

    const monthIndex = Number(match[2]) - 1;
    const monthName = SPANISH_MONTHS[monthIndex];
    if (!monthName) return fallback || period || 'Período';

    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${match[1]}`;
};

const getPaymentSchool = (payment) => payment?.school || payment?.School || null;
const getPaymentCycle = (payment) => payment?.cicloEscolar || payment?.CicloEscolar || null;

const getCycleLabel = (payment) => {
    const cycle = getPaymentCycle(payment);
    return cycle?.label || cycle?.nombre || cycle?.anio || 'Ciclo actual';
};

const getStatusMeta = (status) => {
    const normalized = String(status || 'PENDIENTE').toUpperCase();
    if (normalized === 'MORA') {
        return { label: 'Mora', color: '#D32F2F', background: '#FDEDEC', icon: ErrorOutlineIcon };
    }
    if (normalized === 'CONFIRMADO' || normalized === 'PAGADO') {
        return { label: 'Pagado', color: '#15803D', background: '#E8F5E9', icon: CheckCircleIcon };
    }
    if (normalized === 'ADELANTADO') {
        return { label: 'Adelantado', color: '#2563EB', background: '#EAF1FF', icon: TrendingUpIcon };
    }
    if (normalized === 'EN_PROCESO') {
        return { label: 'En revisión', color: '#B45309', background: '#FEF3C7', icon: HourglassEmptyIcon };
    }
    return { label: 'Pendiente', color: '#B45309', background: '#FEF3C7', icon: AccessTimeIcon };
};

const getMetricToneStyles = (tone) => {
    if (tone === 'danger') return { background: '#FDEDEC', color: '#D32F2F' };
    if (tone === 'info') return { background: '#EAF1FF', color: '#2563EB' };
    if (tone === 'warning') return { background: '#FFF4E6', color: '#B45309' };
    return { background: '#E7F5EF', color: PRIMARY_COLOR };
};

const getOperationLabel = (operation, source) => {
    const src = String(source || '').toUpperCase();
    if (src === 'AUTO_DEBIT') return 'Débito automático';
    if (src === 'CREDIT_AUTO') return 'Crédito automático';
    if (src === 'FULL_DISCOUNT') return 'Descuento completo';

    const type = String(operation || '').toUpperCase();
    const labels = {
        TARIFA: 'Pago de tarifa',
        MORA: 'Pago de mora',
        CREDITO: 'Pago con crédito',
        BILLING: 'Cargo mensual',
        PAYMENT: 'Pago de tarifa',
        REVERSAL: 'Reversión de pago',
        ADJUSTMENT: 'Ajuste de saldo',
        CREDIT_PAYMENT: 'Pago con crédito',
        MORA_PAYMENT: 'Pago de mora',
        OVERPAYMENT: 'Pago adelantado',
        EXONERATION: 'Exoneración de mora',
        EXONERATE_FULL: 'Exoneración total',
        FULL_DISCOUNT: 'Descuento completo',
        DAILY_PENALTY: 'Mora diaria',
        PENALTY_CLEARANCE: 'Limpieza de mora',
    };
    return labels[type] || operation || 'Transacción';
};

const getMovementAmount = (movement) => {
    if (movement?.transaction?.amount !== undefined && movement?.transaction?.amount !== null) {
        return movement.transaction.amount;
    }

    const tariffDelta = Math.abs(toNumber(movement?.balanceDueAfter) - toNumber(movement?.balanceDueBefore));
    const penaltyDelta = Math.abs(toNumber(movement?.penaltyDueAfter) - toNumber(movement?.penaltyDueBefore));
    const creditDelta = Math.abs(toNumber(movement?.creditBalanceAfter) - toNumber(movement?.creditBalanceBefore));
    return Math.max(tariffDelta, penaltyDelta, creditDelta);
};

const getReceiptDisplayDate = (receipt) => receipt?.displayDate || receipt?.uploadedAt || receipt?.createdAt || receipt?.date;
const isReceiptPdf = (receipt) => /\.pdf(\?|$)/i.test(String(receipt?.fileUrl || ''));

const isAdminUploadedReceipt = (receipt) => {
    const source = String(receipt?.uploadSource || receipt?.uploadedByRole || receipt?.source || '').toUpperCase();
    return source === 'ADMIN' || source === 'ADMINISTRADOR' || receipt?.uploadedByAdmin === true;
};

const dataURLtoFile = (url, filename) => {
    const arr = url.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.codePointAt(n);
    return new File([u8arr], filename, { type: mime });
};

const buildPaymentPeriods = (payment) => {
    const sources = [
        payment?.periodsSummary,
        payment?.periods,
        payment?.PaymentPeriods,
        payment?.unpaidPeriods,
        payment?.penaltyPeriods,
    ];
    const byKey = new Map();

    sources.forEach((source) => {
        if (!Array.isArray(source)) return;
        source.forEach((period) => {
            if (!period) return;
            const key = period.id || period.period || `${period.dueDate || ''}-${period.amountDue || ''}`;
            if (!key) return;
            const previous = byKey.get(key) || {};
            byKey.set(key, {
                ...previous,
                ...period,
                paymentId: period.paymentId || payment?.id,
            });
        });
    });

    return Array.from(byKey.values());
};

const StatusBadge = ({ status }) => {
    const meta = getStatusMeta(status);
    const Icon = meta.icon;
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.15,
                py: 0.6,
                borderRadius: 999,
                color: meta.color,
                backgroundColor: meta.background,
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
            }}
        >
            <Icon sx={{ fontSize: 17 }} />
            {meta.label}
        </Box>
    );
};

const SectionCard = ({ title, icon: Icon, children, action }) => (
    <Card
        elevation={0}
        sx={{
            backgroundColor: CARD_COLOR,
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
            mb: 2,
        }}
    >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Icon sx={{ color: PRIMARY_COLOR, fontSize: 22, flexShrink: 0 }} />
                    <Typography variant="h6" sx={{ color: TEXT_COLOR, fontSize: 17, fontWeight: 800, overflowWrap: 'anywhere' }}>
                        {title}
                    </Typography>
                </Box>
                {action}
            </Box>
            {children}
        </CardContent>
    </Card>
);

const MetricCard = ({ label, value, icon: Icon, tone }) => {
    const toneStyles = getMetricToneStyles(tone);
    return (
        <Box
            sx={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 1.5,
                backgroundColor: '#F9FAFB',
                p: 1.5,
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: toneStyles.background,
                    color: toneStyles.color,
                    mb: 1,
                }}
            >
                <Icon sx={{ fontSize: 19 }} />
            </Box>
            <Typography sx={{ color: TEXT_COLOR, fontSize: 18, fontWeight: 900, overflowWrap: 'anywhere' }}>{value}</Typography>
            <Typography sx={{ color: MUTED_COLOR, fontSize: 12, mt: 0.25 }}>{label}</Typography>
        </Box>
    );
};

const InfoRow = ({ label, value, last = false }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            py: 1,
            borderBottom: last ? 0 : `1px solid #F3F4F6`,
        }}
    >
        <Typography sx={{ color: MUTED_COLOR, fontWeight: 700, flex: 1 }}>{label}</Typography>
        <Typography sx={{ color: TEXT_COLOR, fontWeight: 700, flex: 1.2, textAlign: 'right', overflowWrap: 'anywhere' }}>
            {value || 'N/A'}
        </Typography>
    </Box>
);

const DetailSection = ({ label }) => (
    <Box sx={{ backgroundColor: '#F3F4F6', px: 1.75, py: 0.75, borderTop: `1px solid ${BORDER_COLOR}`, borderBottom: `1px solid ${BORDER_COLOR}` }}>
        <Typography sx={{ color: MUTED_COLOR, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {label}
        </Typography>
    </Box>
);

const DetailRow = ({ label, value, valueSx, last = false }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 1.75,
            py: 1.15,
            borderBottom: last ? 0 : '1px solid #F3F4F6',
        }}
    >
        <Typography sx={{ color: MUTED_COLOR, fontSize: 13, flex: 1 }}>{label}</Typography>
        <Typography sx={{ color: TEXT_COLOR, fontSize: 13, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere', ...valueSx }}>
            {value ?? 'N/A'}
        </Typography>
    </Box>
);

const TotalRow = ({ label = 'Total a pagar', value, danger }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 1.75,
            py: 1.3,
            backgroundColor: '#F9FAFB',
            borderTop: `1px solid ${BORDER_COLOR}`,
        }}
    >
        <Typography sx={{ color: TEXT_COLOR, fontSize: 14, fontWeight: 900, flex: 1 }}>{label}</Typography>
        <Typography sx={{ color: danger ? '#D32F2F' : '#15803D', fontSize: 19, fontWeight: 900, textAlign: 'right' }}>{value}</Typography>
    </Box>
);

const EmptyState = ({ icon: Icon, text }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5, px: 2, color: MUTED_COLOR }}>
        <Icon sx={{ fontSize: 42, color: '#CBD5E1', mb: 1 }} />
        <Typography sx={{ textAlign: 'center', lineHeight: 1.6 }}>{text}</Typography>
    </Box>
);

const PeriodItem = ({ period }) => {
    const [expanded, setExpanded] = useState(false);

    const amountDue = toNumber(period.amountDue);
    const penaltyDue = toNumber(period.penaltyDue);
    const penaltyAmount = toNumber(period.penaltyAmount);
    const penaltyPaid = toNumber(period.penaltyPaid);
    const discountApplied = toNumber(period.discountApplied);
    const extraDiscount = toNumber(period.extraordinaryTariffDiscount);
    const dailyRate = toNumber(period.penaltyAccrualBaseAmount);
    const penaltyDiscountApplied = toNumber(period.penaltyDiscountApplied);
    const hasMora = penaltyDue > 0 || penaltyAmount > 0 || !!period.penaltyFrozen || !!period.penaltyCleared;
    const totalPending = amountDue + penaltyDue;

    const penaltyDays = (() => {
        if (period.penaltyStartDate) {
            const endStr = period.penaltyFrozen && period.penaltyFrozenAt
                ? period.penaltyFrozenAt
                : new Date().toISOString().split('T')[0];
            const msPerDay = 1000 * 60 * 60 * 24;
            const days = Math.max(0, Math.floor((new Date(endStr).getTime() - new Date(period.penaltyStartDate).getTime()) / msPerDay));
            return days > 0 ? days : null;
        }
        if (dailyRate > 0 && penaltyAmount > 0) {
            const calculated = Math.round(penaltyAmount / dailyRate);
            return calculated > 0 ? calculated : null;
        }
        return null;
    })();

    const effectivePeriodStatus = penaltyDue > 0 ? 'MORA' : period.status;

    return (
        <Box sx={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 2, overflow: 'hidden', backgroundColor: '#FFFFFF', mb: 1.5 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    p: 1.75,
                    backgroundColor: '#F9FAFB',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: TEXT_COLOR, fontSize: 16, fontWeight: 900, overflowWrap: 'anywhere' }}>
                        {formatPeriodName(period.period, period.periodName)}
                    </Typography>
                    <Typography sx={{ color: MUTED_COLOR, fontSize: 12, mt: 0.25 }}>Vence: {formatDate(period.dueDate)}</Typography>
                </Box>
                <StatusBadge status={effectivePeriodStatus} />
            </Box>

            {!expanded && (
                <>
                    <DetailRow label="Tarifa neta" value={formatMoney(period.netAmount)} />
                    {hasMora && (
                        <DetailRow label="Mora pendiente" value={formatMoney(period.penaltyDue)} valueSx={penaltyDue > 0 ? { color: '#D32F2F' } : undefined} />
                    )}
                    <DetailRow label="Pagado" value={formatMoney(period.amountPaid)} valueSx={{ color: '#15803D' }} last />
                    <TotalRow value={formatMoney(totalPending)} danger={totalPending > 0} />
                </>
            )}

            <Collapse in={expanded} unmountOnExit>
                <DetailSection label="Servicio" />
                <DetailRow label="Tipo de ruta" value={period.routeType || 'N/A'} />
                <DetailRow label="Estudiantes" value={String(period.studentsCount || 1)} last />

                <DetailSection label="Tarifa" />
                <DetailRow label="Tarifa base" value={formatMoney(period.originalAmount)} />
                {discountApplied > 0 && <DetailRow label="Descuento familiar" value={`- ${formatMoney(period.discountApplied)}`} valueSx={{ color: '#15803D' }} />}
                {extraDiscount > 0 && <DetailRow label="Descuento extraordinario" value={`- ${formatMoney(period.extraordinaryTariffDiscount)}`} valueSx={{ color: '#15803D' }} />}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 1.75, py: 1.15, backgroundColor: '#F9FAFB', borderTop: `1px solid ${BORDER_COLOR}`, borderBottom: `1px solid ${BORDER_COLOR}` }}>
                    <Typography sx={{ color: TEXT_COLOR, fontSize: 13, fontWeight: 800 }}>Tarifa neta</Typography>
                    <Typography sx={{ color: TEXT_COLOR, fontSize: 14, fontWeight: 900 }}>{formatMoney(period.netAmount)}</Typography>
                </Box>
                <DetailRow label="Pagado" value={formatMoney(period.amountPaid)} valueSx={{ color: '#15803D' }} last />

                {hasMora && (
                    <>
                        <DetailSection label="Mora" />
                        {dailyRate > 0 && <DetailRow label="Mora por día" value={formatMoney(period.penaltyAccrualBaseAmount)} valueSx={{ color: '#D32F2F' }} />}
                        {penaltyDays !== null && <DetailRow label="Días de mora" value={`${penaltyDays} ${penaltyDays === 1 ? 'día' : 'días'}`} />}
                        {penaltyAmount > 0 && <DetailRow label="Mora acumulada" value={formatMoney(period.penaltyAmount)} />}
                        {penaltyDiscountApplied > 0 && <DetailRow label="Descuento extraordinario" value={`- ${formatMoney(period.penaltyDiscountApplied)}`} valueSx={{ color: '#15803D' }} />}
                        {penaltyPaid > 0 && <DetailRow label="Mora pagada" value={formatMoney(period.penaltyPaid)} valueSx={{ color: '#15803D' }} />}
                        <DetailRow label="Mora pendiente" value={formatMoney(period.penaltyDue)} valueSx={penaltyDue > 0 ? { color: '#D32F2F' } : undefined} last={!period.penaltyFrozen && !period.penaltyCleared} />
                        {(!!period.penaltyFrozen || !!period.penaltyCleared) && (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, px: 1.75, py: 1 }}>
                                {period.penaltyFrozen && <Chip size="small" color="info" variant="outlined" label="Mora congelada" />}
                                {period.penaltyCleared && <Chip size="small" color="success" variant="outlined" label="Mora exonerada" />}
                            </Stack>
                        )}
                    </>
                )}

                <DetailSection label="Resumen" />
                <DetailRow label="Tarifa pendiente" value={formatMoney(period.amountDue)} valueSx={amountDue > 0 ? { color: '#D32F2F' } : { color: '#15803D' }} />
                {penaltyDue > 0 && <DetailRow label="Mora pendiente" value={formatMoney(period.penaltyDue)} valueSx={{ color: '#D32F2F' }} />}
                <TotalRow value={formatMoney(totalPending)} danger={totalPending > 0} />
            </Collapse>

            <Button
                fullWidth
                onClick={() => setExpanded((prev) => !prev)}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ borderTop: `1px solid ${BORDER_COLOR}`, borderRadius: 0, py: 1.1, color: PRIMARY_COLOR, fontWeight: 800, textTransform: 'none' }}
            >
                {expanded ? 'Ocultar detalles' : 'Ver detalles'}
            </Button>
        </Box>
    );
};

const HistoryItem = ({ movement }) => {
    const extraDiscount = toNumber(movement?.transaction?.extraordinaryDiscount);
    const receiptNumber = movement?.transaction?.receiptNumber;
    const paymentDate = formatDate(movement?.transaction?.realPaymentDate || movement?.createdAt);

    return (
        <Box sx={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 1.5, p: 1.5, mb: 1.25, backgroundColor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
                <Typography sx={{ color: TEXT_COLOR, fontSize: 15, fontWeight: 900, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {getOperationLabel(movement?.operation, movement?.transaction?.source || movement?.operation)}
                </Typography>
                <Typography sx={{ color: MUTED_COLOR, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{paymentDate}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <InfoRow label="Monto" value={formatMoney(getMovementAmount(movement))} />
            {!!receiptNumber && <InfoRow label="Boleta" value={receiptNumber} />}
            {extraDiscount > 0 && <InfoRow label="Desc. extraordinario" value={formatMoney(extraDiscount)} />}
            {!!movement?.description && (
                <Typography sx={{ color: MUTED_COLOR, fontSize: 14, lineHeight: 1.55, mt: 1 }}>{movement.description}</Typography>
            )}
        </Box>
    );
};

const ReceiptItem = ({ receipt, onOpen }) => {
    const viewed = !!receipt?.isViewed;
    return (
        <Box
            onClick={() => receipt?.fileUrl && onOpen(receipt)}
            sx={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 1.5,
                p: 1.5,
                mb: 1.25,
                backgroundColor: '#FFFFFF',
                cursor: receipt?.fileUrl ? 'pointer' : 'default',
                transition: 'box-shadow 160ms ease, border-color 160ms ease',
                '&:hover': receipt?.fileUrl ? { boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)', borderColor: '#C7D2FE' } : undefined,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: TEXT_COLOR, fontSize: 15, fontWeight: 900 }}>Boleta de pago</Typography>
                    <Typography sx={{ color: MUTED_COLOR, fontSize: 12, mt: 0.25 }}>{formatDate(getReceiptDisplayDate(receipt))}</Typography>
                </Box>
                <Box
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1,
                        py: 0.5,
                        borderRadius: 999,
                        color: viewed ? '#15803D' : '#B45309',
                        backgroundColor: viewed ? '#E8F5E9' : '#FEF3C7',
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {viewed ? <VisibilityIcon sx={{ fontSize: 16 }} /> : <HourglassEmptyIcon sx={{ fontSize: 16 }} />}
                    {viewed ? 'Vista' : 'En revisión'}
                </Box>
            </Box>
            <Typography sx={{ color: MUTED_COLOR, fontSize: 13, lineHeight: 1.5, mt: 1 }}>
                {isAdminUploadedReceipt(receipt) ? 'Cargada por administración' : 'Cargada por familia'}
            </Typography>
        </Box>
    );
};

const UploadReceiptDialog = ({ open, onClose, file, preview, uploadLoading, isMobile, onSelect, onOpenCamera, onUpload }) => (
    <Dialog open={open} onClose={uploadLoading ? undefined : onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { m: { xs: 1.5, sm: 2 } } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography component="span" sx={{ fontSize: 18, fontWeight: 900 }}>Subir Boleta de Pago</Typography>
            <IconButton onClick={onClose} disabled={uploadLoading} aria-label="cerrar">
                <CloseIcon />
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
            <Typography sx={{ color: MUTED_COLOR, mb: 2 }}>Selecciona una imagen o haz una foto con tu cámara.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: preview ? 2 : 0 }}>
                <Button variant="outlined" component="label" fullWidth={isMobile} startIcon={<ImageIcon />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                    <span>Desde galería</span>
                    <input hidden type="file" accept="image/jpeg,image/png" onChange={onSelect} />
                </Button>
                <Button variant="outlined" onClick={onOpenCamera} fullWidth={isMobile} startIcon={<CameraAltIcon />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                    Tomar foto
                </Button>
            </Stack>
            {preview && (
                <Box sx={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 1.5, p: 1, backgroundColor: '#F9FAFB', textAlign: 'center' }}>
                    <Box component="img" src={preview} alt="previsualización" sx={{ width: '100%', height: 'auto', maxHeight: 'min(350px, 48dvh)', objectFit: 'contain', borderRadius: 1 }} />
                    {file?.name && <Typography sx={{ color: MUTED_COLOR, fontSize: 12, mt: 0.75, overflowWrap: 'anywhere' }}>{file.name}</Typography>}
                </Box>
            )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={onClose} disabled={uploadLoading} sx={{ textTransform: 'none' }}>Cancelar</Button>
            <Button variant="contained" onClick={onUpload} disabled={!file || uploadLoading} startIcon={uploadLoading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                {uploadLoading ? 'Enviando...' : 'Enviar'}
            </Button>
        </DialogActions>
    </Dialog>
);

const ReceiptViewerDialog = ({ receipt, onClose }) => {
    const open = !!receipt;
    const openInNewTab = () => {
        if (receipt?.fileUrl) window.open(receipt.fileUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { height: { xs: 'calc(100dvh - 24px)', sm: '86vh' }, m: { xs: 1.5, sm: 2 } } } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography component="span" sx={{ display: 'block', color: TEXT_COLOR, fontSize: 18, fontWeight: 900 }}>Boleta de pago</Typography>
                    <Typography sx={{ color: MUTED_COLOR, fontSize: 12 }}>{formatDate(getReceiptDisplayDate(receipt))}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                    {receipt?.fileUrl && <Button size="small" onClick={openInNewTab} sx={{ textTransform: 'none' }}>Abrir</Button>}
                    <IconButton onClick={onClose} aria-label="cerrar"><CloseIcon /></IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, backgroundColor: '#F9FAFB', overflow: 'auto' }}>
                {!receipt?.fileUrl && <EmptyState icon={ReceiptLongIcon} text="No hay archivo disponible para esta boleta." />}
                {receipt?.fileUrl && isReceiptPdf(receipt) && (
                    <Box component="iframe" title="boleta-preview" src={receipt.fileUrl} sx={{ width: '100%', height: '100%', minHeight: '70vh', border: 0, display: 'block' }} />
                )}
                {receipt?.fileUrl && !isReceiptPdf(receipt) && (
                    <Box sx={{ minHeight: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', p: { xs: 1, sm: 2 } }}>
                        <Box component="img" src={receipt.fileUrl} alt="boleta de pago" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1, backgroundColor: '#FFFFFF' }} />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

StatusBadge.propTypes = {
    status: PropTypes.string,
};

SectionCard.propTypes = {
    title: PropTypes.string,
    icon: PropTypes.elementType,
    children: PropTypes.node,
    action: PropTypes.node,
};

MetricCard.propTypes = {
    label: PropTypes.string,
    value: PropTypes.node,
    icon: PropTypes.elementType,
    tone: PropTypes.string,
};

InfoRow.propTypes = {
    label: PropTypes.string,
    value: PropTypes.node,
    last: PropTypes.bool,
};

DetailSection.propTypes = {
    label: PropTypes.string,
};

DetailRow.propTypes = {
    label: PropTypes.string,
    value: PropTypes.node,
    valueSx: PropTypes.object,
    last: PropTypes.bool,
};

TotalRow.propTypes = {
    label: PropTypes.string,
    value: PropTypes.node,
    danger: PropTypes.bool,
};

EmptyState.propTypes = {
    icon: PropTypes.elementType,
    text: PropTypes.string,
};

PeriodItem.propTypes = {
    period: PropTypes.object,
};

HistoryItem.propTypes = {
    movement: PropTypes.object,
};

ReceiptItem.propTypes = {
    receipt: PropTypes.object,
    onOpen: PropTypes.func,
};

UploadReceiptDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    file: PropTypes.object,
    preview: PropTypes.string,
    uploadLoading: PropTypes.bool,
    isMobile: PropTypes.bool,
    onSelect: PropTypes.func,
    onOpenCamera: PropTypes.func,
    onUpload: PropTypes.func,
};

ReceiptViewerDialog.propTypes = {
    receipt: PropTypes.object,
    onClose: PropTypes.func,
};

const ParentPaymentPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { auth } = useContext(AuthContext);

    const [pageLoading, setPageLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' });
    const [routeInfo, setRouteInfo] = useState(null);
    const [paymentAccount, setPaymentAccount] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState(null);
    const [receipts, setReceipts] = useState([]);
    const [activeTab, setActiveTab] = useState('resumen');
    const [hasSignedContract, setHasSignedContract] = useState(null);
    const [serviceStatus, setServiceStatus] = useState(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [openCam, setOpenCam] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const webcamRef = useRef(null);
    const videoConstraints = useMemo(() => ({
        width: { ideal: isMobile ? 360 : 600 },
        height: { ideal: isMobile ? 480 : 400 },
        facingMode: 'environment',
    }), [isMobile]);

    useEffect(() => () => {
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    }, [preview]);

    const clearSelectedFile = useCallback(() => {
        setFile(null);
        setPreview(null);
    }, []);

    const fetchPaymentInfo = useCallback(async (signal, silent = false) => {
        const userId = auth?.user?.id;
        if (!userId) {
            setRouteInfo(null);
            setPaymentAccount(null);
            setPaymentHistory(null);
            setReceipts([]);
            setPageLoading(false);
            return;
        }

        if (silent) setRefreshing(true);
        else setPageLoading(true);

        const unwrap = (result) => (result.status === 'fulfilled' ? result.value : null);

        try {
            const [routeRes, serviceRes, accountRes, historyRes, receiptsRes] = await Promise.allSettled([
                api.get(`/parents/${userId}/route-info`, { signal }),
                api.get(`/parents/${userId}/service-status`, { signal }),
                api.get(`/payments/family-account/${userId}`, { signal }),
                api.get(`/parents/${userId}/payment-history`, { params: { limit: 80 }, signal }),
                api.get(`/parents/${userId}/receipts`, { signal }),
            ]);

            if (signal?.aborted) return;

            const routeData = unwrap(routeRes)?.data?.data || null;
            const schoolHasContracts = routeData?.schoolHasContracts === true;
            setRouteInfo(routeData);
            setHasSignedContract(schoolHasContracts ? routeData?.parentHasSignedContract === true : true);
            setServiceStatus(unwrap(serviceRes)?.data?.serviceStatus || routeData?.serviceStatus || null);
            setPaymentAccount(unwrap(accountRes)?.data?.familyAccount || null);
            setPaymentHistory(unwrap(historyRes)?.data || null);
            setReceipts(unwrap(receiptsRes)?.data?.receipts || []);
        } catch (error) {
            if (!signal?.aborted) {
                console.error(error);
                setSnackbar({ open: true, msg: 'Error al obtener información de pago.', sev: 'error' });
            }
        } finally {
            if (!signal?.aborted) {
                setPageLoading(false);
                setRefreshing(false);
            }
        }
    }, [auth?.user?.id]);

    useEffect(() => {
        const controller = new AbortController();
        fetchPaymentInfo(controller.signal);
        return () => controller.abort();
    }, [fetchPaymentInfo]);

    const payments = useMemo(() => paymentAccount?.payments || [], [paymentAccount?.payments]);
    const primaryPayment = payments[0] || null;
    const allPeriods = useMemo(() => payments
        .flatMap((payment) => buildPaymentPeriods(payment))
        .sort((firstPeriod, secondPeriod) => String(secondPeriod.period || '').localeCompare(String(firstPeriod.period || ''))), [payments]);
    const movements = useMemo(() => (paymentHistory?.movements || []).filter((movement) => !!movement?.transaction), [paymentHistory?.movements]);
    const currentStatus = primaryPayment?.finalStatus || (toNumber(paymentAccount?.totals?.penaltyDue) > 0 ? 'MORA' : 'PENDIENTE');
    const effectiveServiceStatus = serviceStatus || primaryPayment?.serviceStatus || null;
    const uploadDisabled = effectiveServiceStatus === 'SUSPENDED' && hasSignedContract !== true;
    const totalPending = toNumber(paymentAccount?.totals?.balanceDue) + toNumber(paymentAccount?.totals?.penaltyDue);

    const capturePhoto = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) {
            setSnackbar({ open: true, msg: 'No se pudo capturar la imagen.', sev: 'warning' });
            return;
        }
        const imageFile = dataURLtoFile(imageSrc, `photo_${Date.now()}.jpg`);
        setFile(imageFile);
        setPreview(imageSrc);
        setOpenCam(false);
    }, []);

    const handleSelect = (event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;

        if (!['image/jpeg', 'image/png'].includes(selected.type)) {
            setSnackbar({ open: true, msg: 'El archivo debe ser una imagen JPG o PNG.', sev: 'warning' });
            event.target.value = '';
            return;
        }

        setFile(selected);
        setPreview(URL.createObjectURL(selected));
        event.target.value = '';
    };

    const handleCloseUploadDialog = () => {
        if (uploadLoading) return;
        clearSelectedFile();
        setUploadDialogOpen(false);
    };

    const handleOpenUploadDialog = () => {
        if (uploadDisabled) return;
        setUploadDialogOpen(true);
    };

    const handleUpload = async () => {
        if (!file) {
            setSnackbar({ open: true, msg: 'Primero selecciona una imagen.', sev: 'warning' });
            return;
        }

        try {
            setUploadLoading(true);
            const form = new FormData();
            form.append('receipt', file);
            await api.post('/parents/upload-receipt', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSnackbar({ open: true, msg: 'Boleta enviada correctamente.', sev: 'success' });
            clearSelectedFile();
            setUploadDialogOpen(false);
            await fetchPaymentInfo(undefined, true);
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, msg: 'Error al subir la boleta.', sev: 'error' });
        } finally {
            setUploadLoading(false);
        }
    };

    const renderUploadButton = (fullWidth = false) => (
        <Box>
            <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handleOpenUploadDialog}
                disabled={uploadDisabled}
                fullWidth={fullWidth}
                sx={{ backgroundColor: '#28A745', textTransform: 'none', fontWeight: 900, py: 1.2, '&:hover': { backgroundColor: '#218838' } }}
            >
                Subir Boleta de Pago
            </Button>
            {uploadDisabled && (
                <Typography sx={{ color: MUTED_COLOR, fontSize: 12, textAlign: fullWidth ? 'center' : 'left', lineHeight: 1.45, mt: 1 }}>
                    La carga de boleta estará disponible cuando el contrato esté firmado.
                </Typography>
            )}
        </Box>
    );

    const renderSummaryTab = () => (
        <>
            <SectionCard title="Resumen financiero" icon={AnalyticsIcon}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: TEXT_COLOR, fontSize: 20, fontWeight: 900, overflowWrap: 'anywhere' }}>
                            {getPaymentSchool(primaryPayment)?.name || routeInfo?.schoolName || 'Transporte Luvan'}
                        </Typography>
                        <Typography sx={{ color: MUTED_COLOR, fontSize: 13, mt: 0.25 }}>{getCycleLabel(primaryPayment)}</Typography>
                    </Box>
                    <StatusBadge status={currentStatus} />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25 }}>
                    <MetricCard label="Tarifa pendiente" value={formatMoney(paymentAccount?.totals?.balanceDue)} icon={CreditCardIcon} tone="primary" />
                    <MetricCard label="Mora pendiente" value={formatMoney(paymentAccount?.totals?.penaltyDue)} icon={ErrorOutlineIcon} tone="danger" />
                    <MetricCard label="Crédito" value={formatMoney(paymentAccount?.totals?.creditBalance)} icon={TrendingUpIcon} tone="info" />
                    <MetricCard label="Períodos pendientes" value={`${paymentAccount?.totals?.unpaidPeriodsCount || 0}`} icon={CalendarMonthIcon} tone="warning" />
                </Box>

                {(primaryPayment?.penaltyGlobalFrozen || toNumber(primaryPayment?.frozenPenaltyPeriodsCount) > 0) && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.25, mt: 1.5, borderRadius: 1.5, backgroundColor: '#EEF6FF', color: '#1E3A8A' }}>
                        <AcUnitIcon sx={{ fontSize: 20, color: '#2563EB', mt: 0.1 }} />
                        <Typography sx={{ fontSize: 13, lineHeight: 1.55 }}>
                            La mora tiene congelamiento activo{primaryPayment?.penaltyGlobalFreezeReason ? `: ${primaryPayment.penaltyGlobalFreezeReason}` : '.'}
                        </Typography>
                    </Box>
                )}
            </SectionCard>

            <SectionCard title="Información de depósito" icon={BusinessIcon}>
                <InfoRow label="Banco" value={routeInfo?.bankName} />
                <InfoRow label="Cuenta bancaria" value={routeInfo?.bankAccount} />
                <InfoRow label="Fecha máxima de pago" value={routeInfo?.duePaymentDay ? `${routeInfo.duePaymentDay} de cada mes` : 'N/A'} />
                <InfoRow label="Cuota completa" value={routeInfo?.transportFeeComplete ? formatMoney(routeInfo.transportFeeComplete) : 'N/A'} />
                <InfoRow label="Cuota media" value={routeInfo?.transportFeeHalf ? formatMoney(routeInfo.transportFeeHalf) : 'N/A'} last />
            </SectionCard>

            <Box sx={{ mb: 2 }}>{renderUploadButton(true)}</Box>
        </>
    );

    const renderPeriodsTab = () => (
        <SectionCard title="Períodos de pago" icon={CalendarMonthIcon}>
            {allPeriods.length > 0 ? (
                allPeriods.map((period) => <PeriodItem key={`${period.paymentId || 'payment'}-${period.id || period.period}`} period={period} />)
            ) : (
                <EmptyState icon={CheckCircleIcon} text="No hay períodos registrados para mostrar." />
            )}
        </SectionCard>
    );

    const renderHistoryTab = () => (
        <SectionCard title="Historial de transacciones" icon={AccessTimeIcon}>
            {movements.length > 0 ? (
                movements.map((movement) => <HistoryItem key={movement.id} movement={movement} />)
            ) : (
                <EmptyState icon={ReceiptLongIcon} text="No hay transacciones registradas todavía." />
            )}
        </SectionCard>
    );

    const renderReceiptsTab = () => (
        <SectionCard
            title="Boletas subidas"
            icon={ReceiptLongIcon}
            action={
                <Button size="small" variant="outlined" startIcon={<CloudUploadIcon />} onClick={handleOpenUploadDialog} disabled={uploadDisabled} sx={{ textTransform: 'none', fontWeight: 800, flexShrink: 0 }}>
                    Subir
                </Button>
            }
        >
            {receipts.length > 0 ? (
                receipts.map((receipt) => <ReceiptItem key={receipt.id} receipt={receipt} onOpen={setSelectedReceipt} />)
            ) : (
                <EmptyState icon={CloudUploadIcon} text="Aún no se han subido boletas de pago." />
            )}
            {uploadDisabled && (
                <Typography sx={{ color: MUTED_COLOR, fontSize: 12, textAlign: 'center', lineHeight: 1.45, mt: 1 }}>
                    La carga de boleta estará disponible cuando el contrato esté firmado.
                </Typography>
            )}
        </SectionCard>
    );

    const renderActiveTab = () => {
        if (activeTab === 'periodos') return renderPeriodsTab();
        if (activeTab === 'historial') return renderHistoryTab();
        if (activeTab === 'boletas') return renderReceiptsTab();
        return renderSummaryTab();
    };

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: BACKGROUND_COLOR }}>
            <ParentNavbar />

            <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 1.5, sm: 3 } }}>
                {pageLoading ? (
                    <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                        <CircularProgress sx={{ color: PRIMARY_COLOR }} />
                        <Typography sx={{ color: MUTED_COLOR, fontSize: 16 }}>Cargando información...</Typography>
                    </Box>
                ) : (
                    <>
                        <Box
                            sx={{
                                backgroundColor: PRIMARY_COLOR,
                                borderRadius: 2,
                                p: { xs: 2, sm: 2.5 },
                                mb: 2,
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: { xs: 'flex-start', sm: 'center' },
                                justifyContent: 'space-between',
                                gap: 2,
                                flexDirection: { xs: 'column', sm: 'row' },
                                boxShadow: '0 14px 28px rgba(13, 63, 226, 0.18)',
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Estado de pago</Typography>
                                <Typography sx={{ color: '#FFFFFF', fontSize: { xs: 34, sm: 42 }, fontWeight: 900, lineHeight: 1.05, mt: 0.5 }}>{formatMoney(totalPending)}</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: 14, mt: 0.75 }}>Total pendiente entre tarifa y mora</Typography>
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                                <StatusBadge status={currentStatus} />
                                <Tooltip title="Actualizar datos">
                                    <span>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => fetchPaymentInfo(undefined, true)}
                                            disabled={refreshing}
                                            sx={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none', fontWeight: 800, '&:hover': { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.08)' } }}
                                        >
                                            {refreshing ? 'Actualizando...' : 'Actualizar'}
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 1.5, p: 1.5, mb: 2 }}>
                            <InfoOutlinedIcon sx={{ color: '#92400E', fontSize: 18, mt: 0.1 }} />
                            <Typography sx={{ color: '#78350F', fontSize: 13, lineHeight: 1.55 }}>
                                <Box component="span" sx={{ fontWeight: 900, color: '#92400E' }}>Sección en desarrollo.</Box>{' '}
                                Si notas algún dato incorrecto o experimentas algún problema, por favor comunícanoslo al correo haricodeoficial@gmail.com.
                            </Typography>
                        </Box>

                        <Box sx={{ overflowX: 'auto', mb: 2, pb: 0.25 }}>
                            <Stack direction="row" spacing={1} sx={{ minWidth: 'max-content' }}>
                                {PAYMENT_TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    const selected = activeTab === tab.key;
                                    return (
                                        <Button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            startIcon={<Icon sx={{ fontSize: 18 }} />}
                                            variant={selected ? 'contained' : 'outlined'}
                                            sx={{
                                                borderRadius: 999,
                                                px: 1.75,
                                                py: 0.9,
                                                textTransform: 'none',
                                                fontWeight: 900,
                                                flexShrink: 0,
                                                backgroundColor: selected ? PRIMARY_COLOR : '#FFFFFF',
                                                borderColor: selected ? PRIMARY_COLOR : '#CDE8DE',
                                                color: selected ? '#FFFFFF' : PRIMARY_COLOR,
                                                '&:hover': { backgroundColor: selected ? PRIMARY_COLOR : '#F8FAFC', borderColor: PRIMARY_COLOR },
                                            }}
                                        >
                                            {tab.label}
                                        </Button>
                                    );
                                })}
                            </Stack>
                        </Box>

                        {renderActiveTab()}
                    </>
                )}
            </Container>

            <UploadReceiptDialog
                open={uploadDialogOpen}
                onClose={handleCloseUploadDialog}
                file={file}
                preview={preview}
                uploadLoading={uploadLoading}
                isMobile={isMobile}
                onSelect={handleSelect}
                onOpenCamera={() => setOpenCam(true)}
                onUpload={handleUpload}
            />

            <Modal open={openCam} onClose={() => setOpenCam(false)} aria-labelledby="modal-camera">
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        bgcolor: '#111',
                        p: { xs: 1.5, sm: 2 },
                        borderRadius: 2,
                        width: { xs: 'calc(100vw - 24px)', sm: 640 },
                        maxWidth: '100vw',
                        maxHeight: 'calc(100dvh - 24px)',
                        overflow: 'auto',
                    }}
                >
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                        style={{ width: '100%', maxHeight: isMobile ? '64dvh' : '70vh', objectFit: 'contain', borderRadius: 8 }}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2, justifyContent: 'center' }}>
                        <Button variant="contained" onClick={capturePhoto} fullWidth={isMobile} startIcon={<CameraAltIcon />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                            Capturar
                        </Button>
                        <Button variant="outlined" onClick={() => setOpenCam(false)} fullWidth={isMobile} sx={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none', fontWeight: 800 }}>
                            Cancelar
                        </Button>
                    </Stack>
                </Box>
            </Modal>

            <ReceiptViewerDialog receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.sev} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ width: '100%' }}>
                    {snackbar.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ParentPaymentPage;