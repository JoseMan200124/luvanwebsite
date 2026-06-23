import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Typography,
    Switch,
    FormControlLabel,
    TextField,
    Button,
    Box,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Checkbox,
    Tooltip,
    IconButton as MuiIconButton,
    List,
    ListItem,
    ListItemText,
    Chip,
    Stack,
    Paper,
    Snackbar,
    Alert,
    useMediaQuery,
    useTheme
} from '@mui/material';
import TableSortLabel from '@mui/material/TableSortLabel';
import TablePagination from '@mui/material/TablePagination';
import { 
    ReceiptLong as ReceiptIcon, 
    Pause as PauseIcon, 
    PlayArrow as PlayArrowIcon, 
    Restore,
    NoteAlt as NoteAltIcon,
    Timeline as TimelineIcon
} from '@mui/icons-material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import moment from 'moment';
import api from '../utils/axiosConfig';
import dateService from '../services/dateService';
import ReceiptsPane from './ReceiptsPane';
import RetroactiveApplyModal from './modals/RetroactiveApplyModal';
import PaymentFlowTimeline from './PaymentFlowTimeline';

// cache TTL (ms)
const PAYMENT_HIST_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const getReceiptDisplayDateValue = (receipt) => receipt?.displayDate || receipt?.date || receipt?.createdAt || receipt?.uploadedAt || '';

const getTransactionTypeMeta = (typeVal) => {
    switch(typeVal?.toUpperCase()) {
        case 'TARIFA':
        case 'PAYMENT':
            return { label: 'TARIFA', backgroundColor: '#e8f5e9' };
        case 'MORA':
        case 'PENALTY_PAYMENT':
            return { label: 'MORA', backgroundColor: '#fff3e0' };
        case 'CREDITO':
        case 'PENALTY_DISCOUNT':
            return { label: 'CREDITO', backgroundColor: '#e1f5fe' };
        default:
            return { label: typeVal || 'Otro', backgroundColor: '#e0e0e0' };
    }
};

const getTransactionSourceMeta = (sourceVal) => {
    switch(sourceVal?.toUpperCase()) {
        case 'MANUAL':
            return { label: 'MANUAL', backgroundColor: '#fff9c4' };
        case 'AUTO_DEBIT':
            return { label: 'AUTO_DEBIT', backgroundColor: '#c8e6c9' };
        case 'CREDIT_AUTO':
            return { label: 'CREDIT_AUTO', backgroundColor: '#b3e5fc' };
        case 'FULL_DISCOUNT':
            return { label: 'FULL_DISCOUNT', backgroundColor: '#d1c4e9' };
        default:
            return { label: sourceVal || 'Otro', backgroundColor: '#f5f5f5' };
    }
};

/** Extraer los períodos a los que se aplicó una transacción.
 *  Usa metadata de la transacción + ledgerEntries para determinar distribución. */
function getTransactionAppliedPeriods(h) {
    const meta = h.metadata || {};
    const type = String(h.type || '').toUpperCase();
    const source = String(h.source || '').toUpperCase();

    // CREDITO_AUTO: el backend guarda `period` en metadata
    if (type === 'CREDITO' && source === 'CREDIT_AUTO' && meta.period) {
        const periodsFromMeta = (Array.isArray(meta.periodsApplied) && meta.periodsApplied.length > 0)
            ? meta.periodsApplied.map(p => ({ period: p.period, amount: Number(p.amount || 0), isCredit: true }))
            : [{ period: meta.period, amount: Number(meta.creditApplied || h.amountPaid || 0), isCredit: true }];
        return periodsFromMeta;
    }

    // TARIFA manual: usar ledgerEntries para determinar distribución
    if (type === 'TARIFA' && source === 'MANUAL' && Array.isArray(h.ledgerEntries)) {
        const results = [];

        for (const le of h.ledgerEntries) {
            const op = String(le.operation || '').toUpperCase();
            const leMeta = le.metadata || {};

            if (op === 'PAYMENT' && le.balanceDueBefore > 0) {
                const appliedToTarifa = Number(leMeta.amountToBalance || (le.balanceDueBefore - le.balanceDueAfter) || 0);
                if (appliedToTarifa > 0) {
                    results.push({ period: 'Tarifa', amount: appliedToTarifa, isCredit: false });
                }
            }

            if (op === 'OVERPAYMENT') {
                const overpaymentAmt = Number(leMeta.overpaymentAmount || leMeta.overpayment || 0);
                if (overpaymentAmt > 0) {
                    results.push({ period: 'Crédito generado', amount: overpaymentAmt, isCredit: true, isGeneratedCredit: true });
                }
            }
        }

        // Fallback si los ledger no aportaron datos: usar metadata directa
        if (results.length === 0 && meta.overpayment && Number(meta.overpayment) > 0) {
            return [
                { period: 'Tarifa', amount: Number(meta.amountToBalance || h.amountPaid || 0), isCredit: false },
                { period: 'Crédito generado', amount: Number(meta.overpayment || 0), isCredit: true, isGeneratedCredit: true }
            ];
        }

        if (results.length > 0) return results;
    }

    // CREDITO manual (no CREDIT_AUTO): ver si hay ledger que indique consumo de crédito
    if (type === 'CREDITO' && Array.isArray(h.ledgerEntries)) {
        for (const le of h.ledgerEntries) {
            if (String(le.operation || '').toUpperCase() === 'CREDIT_PAYMENT') {
                const leMeta = le.metadata || {};
                const period = leMeta.period || meta.period || '';
                if (period) {
                    return [{ period, amount: Number(leMeta.creditApplied || h.amountPaid || 0), isCredit: true }];
                }
            }
        }
    }

    return [];
}

/** Nombre legible para un período YYYY-MM */
function formatPeriodLabel(period) {
    if (!period) return '';
    const parts = String(period).split('-');
    if (parts.length < 2) return period;
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const m = Number.parseInt(parts[1], 10) - 1;
    const monthLabel = monthNames[m] || parts[1];
    return `${monthLabel} ${parts[0]}`;
}

/** Nombre completo del mes */
function formatPeriodFullLabel(period) {
    if (!period) return '';
    const parts = String(period).split('-');
    if (parts.length < 2) return period;
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const m = Number.parseInt(parts[1], 10) - 1;
    const monthLabel = monthNames[m] || parts[1];
    return `${monthLabel} de ${parts[0]}`;
}

/** Generar explicación legible de una transacción para el diálogo de detalle */
function buildTransactionExplanation(h, allHistories = []) {
    const type = String(h.type || '').toUpperCase();
    const source = String(h.source || '').toUpperCase();
    const amount = Number(h.amountPaid || 0);
    const date = h.lastPaymentDate ? moment.parseZone(h.lastPaymentDate).format('DD/MM/YYYY') : '—';
    const receipt = h.receiptNumber || '—';
    const meta = h.metadata || {};
    const lines = [];

    // Helper para formatear montos
    const fmt = (v) => `Q${Number(v || 0).toFixed(2)}`;

    if (type === 'TARIFA' && source === 'MANUAL') {
        lines.push(`💳 Pago manual registrado el ${date}.`);
        lines.push(`   • Monto total recibido: ${fmt(amount)}`);
        if (receipt !== '—') lines.push(`   • N° de boleta: ${receipt}`);

        // Buscar ledger entries para ver distribución
        const lePayment = Array.isArray(h.ledgerEntries)
            ? h.ledgerEntries.find(le => String(le.operation || '').toUpperCase() === 'PAYMENT') : null;
        const leOverpay = Array.isArray(h.ledgerEntries)
            ? h.ledgerEntries.find(le => String(le.operation || '').toUpperCase() === 'OVERPAYMENT') : null;

        if (lePayment || leOverpay) {
            lines.push('');
            lines.push('📊 Distribución del pago:');

            const appliedToBalance = lePayment
                ? Number(lePayment.metadata?.amountToBalance || (lePayment.balanceDueBefore - lePayment.balanceDueAfter) || 0)
                : 0;
            const overpaymentAmt = leOverpay
                ? Number(leOverpay.metadata?.overpaymentAmount || leOverpay.metadata?.overpayment || 0)
                : (lePayment ? Number(lePayment.metadata?.overpayment || 0) : 0);

            if (appliedToBalance > 0) {
                lines.push(`   ✅ Aplicado a tarifa: ${fmt(appliedToBalance)}`);
                if (lePayment) {
                    lines.push(`      (Saldo antes: ${fmt(lePayment.balanceDueBefore)} → después: ${fmt(lePayment.balanceDueAfter)})`);
                }
            }
            if (overpaymentAmt > 0) {
                lines.push(`   ↗ Convertido a crédito disponible: ${fmt(overpaymentAmt)}`);
            }
            if (appliedToBalance <= 0 && overpaymentAmt <= 0) {
                lines.push('   ℹ️ Este pago se aplicó completamente a la tarifa del período.');
            }
        } else {
            // Sin ledger: mostrar nota genérica
            lines.push('');
            lines.push('ℹ️ No hay datos de distribución disponibles para este pago.');
        }
    }

    else if (type === 'CREDITO' && source === 'CREDIT_AUTO') {
        const period = meta.period || '';
        const periodLabel = period ? formatPeriodFullLabel(period) : 'un período';
        const creditApplied = Number(meta.creditApplied || h.amountPaid || 0);

        lines.push(`🔄 Aplicación automática de crédito.`);
        lines.push(`   • Crédito aplicado: ${fmt(creditApplied)}`);
        lines.push(`   • Destino: tarifa de ${periodLabel}`);

        // Buscar origen del crédito (sourceTxIds)
        const sourceTxIds = Array.isArray(meta.sourceTxIds) ? meta.sourceTxIds : [];
        if (sourceTxIds.length > 0 && Array.isArray(allHistories)) {
            const sourceTxs = allHistories.filter(t => sourceTxIds.includes(t.id));
            if (sourceTxs.length > 0) {
                lines.push('');
                lines.push('📎 Este crédito proviene de:');
                sourceTxs.forEach(stx => {
                    const stxDate = stx.lastPaymentDate ? moment.parseZone(stx.lastPaymentDate).format('DD/MM/YYYY') : '—';
                    const stxAmt = Number(stx.amountPaid || 0);
                    lines.push(`   • Pago del ${stxDate} por ${fmt(stxAmt)} (boleta: ${stx.receiptNumber || '—'})`);
                });
            }
        }

        // Si hay creditAllocations, mostrar
        const allocations = Array.isArray(meta.creditAllocations) ? meta.creditAllocations : [];
        if (allocations.length > 0) {
            lines.push('');
            lines.push('📋 Asignaciones de crédito:');
            allocations.forEach(al => {
                const alPeriod = formatPeriodFullLabel(al.period);
                const alAmt = Number(al.amount || 0);
                const alDate = al.date ? moment(al.date).format('DD/MM/YYYY') : '—';
                lines.push(`   • ${fmt(alAmt)} del pago del ${alDate} → ${alPeriod}`);
            });
        }

        // Explicación del contexto: cuánto cubrió vs cuánto faltó
        lines.push('');
        lines.push('💡 El crédito disponible se aplica automáticamente al generar');
        lines.push('   la factura mensual. Si el crédito no cubre la tarifa completa,');
        lines.push('   el saldo restante queda pendiente hasta el siguiente pago.');
    }

    else if (type === 'CREDITO' && source !== 'CREDIT_AUTO') {
        lines.push(`🔄 Transacción de crédito.`);
        lines.push(`   • Monto: ${fmt(amount)}`);
        lines.push(`   • Fecha: ${date}`);

        const leEntries = Array.isArray(h.ledgerEntries) ? h.ledgerEntries : [];
        const creditLe = leEntries.find(le => String(le.operation || '').toUpperCase() === 'CREDIT_PAYMENT');
        if (creditLe) {
            const leMeta = creditLe.metadata || {};
            const targetPeriod = leMeta.period || meta.period || '';
            const targetLabel = targetPeriod ? formatPeriodFullLabel(targetPeriod) : 'tarifa';
            lines.push('');
            lines.push(`   📌 Aplicado a: ${targetLabel}`);
            if (creditLe.creditBalanceBefore !== undefined) {
                lines.push(`      Crédito antes: ${fmt(creditLe.creditBalanceBefore)} → después: ${fmt(creditLe.creditBalanceAfter)}`);
            }
        }
    }

    else if (type === 'MORA') {
        lines.push(`⚠️ Pago de mora registrado el ${date}.`);
        lines.push(`   • Monto: ${fmt(amount)}`);

        if (h.extraordinaryDiscount > 0) {
            lines.push(`   • Descuento/exoneración aplicado: ${fmt(h.extraordinaryDiscount)}`);
        }
        if (receipt !== '—') lines.push(`   • N° de boleta: ${receipt}`);
    }

    else {
        lines.push(`📄 Transacción de tipo "${type}".`);
        lines.push(`   • Monto: ${fmt(amount)}`);
        lines.push(`   • Fecha: ${date}`);
    }

    // Siempre mostrar estado del crédito/balance después de esta transacción
    const leEntries = Array.isArray(h.ledgerEntries) ? h.ledgerEntries : [];
    const lastLe = leEntries[leEntries.length - 1];
    if (lastLe) {
        const hasBalanceChange = Number(lastLe.balanceDueAfter || 0) !== Number(lastLe.balanceDueBefore || 0);
        const hasCreditChange = Number(lastLe.creditBalanceAfter || 0) !== Number(lastLe.creditBalanceBefore || 0);
        const hasPenaltyChange = Number(lastLe.penaltyDueAfter || 0) !== Number(lastLe.penaltyDueBefore || 0);
        if (hasBalanceChange || hasCreditChange || hasPenaltyChange) {
            lines.push('');
            lines.push('📈 Estado financiero después de esta transacción:');
            lines.push(`   • Saldo de tarifa: ${fmt(lastLe.balanceDueAfter)}`);
            lines.push(`   • Crédito disponible: ${fmt(lastLe.creditBalanceAfter)}`);
            lines.push(`   • Mora pendiente: ${fmt(lastLe.penaltyDueAfter)}`);
        }
    }

    return lines.join('\n');
}

const TransactionBadge = ({ label, backgroundColor, compact = false }) => (
    <Box
        sx={{
            display: 'inline-block',
            px: compact ? 1 : 1.5,
            py: compact ? 0.25 : 0.5,
            borderRadius: 1,
            backgroundColor,
            fontSize: compact ? '0.7rem' : '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap'
        }}
    >
        {label}
    </Box>
);

const HistoryMobileCard = ({ history, onToggleInvoiceRow, onOpenNotes, onOpenExplanation }) => {
    const dateVal = history.lastPaymentDate || null;
    const amountVal = Number(history.amountPaid || 0);
    const typeMeta = getTransactionTypeMeta(history.type || 'PAYMENT');
    const sourceMeta = getTransactionSourceMeta(history.source || 'MANUAL');
    const receiptVal = history.receiptNumber || '—';
    const invoiceReq = !!history.requiresInvoice;
    const notesVal = history.notes || '';

    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={1.25}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Fecha</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{dateVal ? moment.parseZone(dateVal).format('DD/MM/YY') : '—'}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: amountVal >= 0 ? 'success.main' : 'error.main' }}>Q {amountVal.toFixed(2)}</Typography>
                </Box>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <TransactionBadge label={typeMeta.label} backgroundColor={typeMeta.backgroundColor} compact />
                    <TransactionBadge label={sourceMeta.label} backgroundColor={sourceMeta.backgroundColor} compact />
                </Stack>

                {/* Botón detalle */}
                {(() => {
                    const hasDetails = getTransactionAppliedPeriods(history).length > 0 || (history.ledgerEntries && history.ledgerEntries.length > 0);
                    if (!hasDetails) return null;
                    return (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <MuiIconButton
                                size="small"
                                onClick={() => {
                                    if (onOpenExplanation) onOpenExplanation(history);
                                }}
                                title="Ver detalle de esta transacción"
                                sx={{
                                    color: '#1565c0',
                                    backgroundColor: '#e3f2fd',
                                    '&:hover': { backgroundColor: '#bbdefb' },
                                    width: 32,
                                    height: 32
                                }}
                            >
                                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>ℹ️</Typography>
                            </MuiIconButton>
                        </Box>
                    );
                })()}

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">Desc. Extra</Typography>
                        <Typography variant="body2">Q {(Number(history.extraordinaryDiscount || 0)).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">N° Boleta</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{receiptVal}</Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <FormControlLabel
                        control={<Checkbox checked={invoiceReq} onChange={() => onToggleInvoiceRow(history)} />}
                        label="Factura"
                        sx={{ m: 0 }}
                    />
                    <MuiIconButton size="small" onClick={() => onOpenNotes(notesVal)} title={notesVal ? 'Ver notas' : 'Agregar nota'}>
                        <NoteAltIcon fontSize="small" color={notesVal ? 'action' : 'disabled'} />
                    </MuiIconButton>
                </Box>
            </Stack>
        </Paper>
    );
};

const ManagePaymentsModal = ({ open, onClose, payment = {}, onAction = () => {}, onToggleInvoiceSent = () => {} }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [localPayment, setLocalPayment] = useState(payment);
    useEffect(() => setLocalPayment(payment), [payment]);
    const family = localPayment?.User?.FamilyDetail || payment?.User?.FamilyDetail || {};
    const finalStatus = ((localPayment || payment)?.finalStatus || '').toString().toUpperCase();
    const isDeleted = finalStatus === 'ELIMINADO' || !!family.deleted;
    const activePayment = localPayment || payment || {};
    const isGlobalPenaltyFrozen = !!activePayment.penaltyGlobalFrozen;
    const frozenPenaltyPeriodsCount = Number(activePayment.frozenPenaltyPeriodsCount || 0);

    const [autoDebit, setAutoDebit] = useState(!!family.autoDebit || false);
    const [requiresInvoice, setRequiresInvoice] = useState(!!family.requiresInvoice || false);
    const [discount, setDiscount] = useState(family.specialFee ?? family.discount ?? 0);
    const [percentDiscount, setPercentDiscount] = useState(() => {
        try {
            const pRaw = family.specialFeePercentage ?? null;
            return (pRaw !== null && typeof pRaw !== 'undefined' && pRaw !== '') ? (Number(pRaw) * 100) : '';
        } catch (e) {
            return '';
        }
    });

    useEffect(() => {
        setAutoDebit(!!(payment?.User?.FamilyDetail?.autoDebit));
        setRequiresInvoice(!!(payment?.User?.FamilyDetail?.requiresInvoice));
        setDiscount(payment?.User?.FamilyDetail?.specialFee ?? payment?.User?.FamilyDetail?.discount ?? 0);
        try {
            const pRaw = typeof payment?.User?.FamilyDetail?.specialFeePercentage !== 'undefined' ? payment?.User?.FamilyDetail?.specialFeePercentage : null;
            setPercentDiscount(pRaw !== null && typeof pRaw !== 'undefined' && pRaw !== '' ? (Number(pRaw) * 100) : '');
        } catch (e) {
            setPercentDiscount('');
        }
        // note: fullDiscount removed — percent-based discounts used instead
    }, [payment, open]);

    // Tab state: 'payments' | 'flow'
    const [tabValue, setTabValue] = useState('payments');

    // Prefer Sequelize included PaymentTransactions (backend includes them as PaymentTransactions)
    const [histories, setHistories] = useState([]);
    const [histLoading, setHistLoading] = useState(false);
    const [histPage, setHistPage] = useState(0);
    const [histLimit, setHistLimit] = useState(10);
    const [histTotal, setHistTotal] = useState(0);
    // Sorting for history table
    const [histOrderBy, setHistOrderBy] = useState('date'); // 'date' | 'type' | 'source'
    const [histOrder, setHistOrder] = useState('desc'); // 'asc' | 'desc'

    // module-level cache (persists across renders)
    if (!global.__paymentHistCache) global.__paymentHistCache = new Map();
    const histCacheRef = React.useRef(global.__paymentHistCache);

    const handleHistRequestSort = (property) => {
        const isAsc = histOrderBy === property && histOrder === 'asc';
        setHistOrder(isAsc ? 'desc' : 'asc');
        setHistOrderBy(property);
    };

    const sortedHistories = React.useMemo(() => {
        if (!Array.isArray(histories)) return [];
        const arr = [...histories];
        const cmp = (a, b) => {
            const dir = histOrder === 'asc' ? 1 : -1;
            if (histOrderBy === 'date') {
                const da = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
                const db = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
                return (da - db) * dir;
            }
            if (histOrderBy === 'type') {
                const ta = String(a.type || '').toLowerCase();
                const tb = String(b.type || '').toLowerCase();
                return ta < tb ? -1 * dir : ta > tb ? 1 * dir : 0;
            }
            if (histOrderBy === 'source') {
                const sa = String(a.source || '').toLowerCase();
                const sb = String(b.source || '').toLowerCase();
                return sa < sb ? -1 * dir : sa > sb ? 1 * dir : 0;
            }
            return 0;
        };
        arr.sort(cmp);
        return arr;
    }, [histories, histOrderBy, histOrder]);

    const computedTariff = Number(payment?.monthlyFee || 0);

    const [openExonerateDialog, setOpenExonerateDialog] = useState(false);
    const [openDiscountModal, setOpenDiscountModal] = useState(false);
    const [exonerateAmount, setExonerateAmount] = useState('');
    const [globalFreezeDialogMode, setGlobalFreezeDialogMode] = useState(null);
    const [globalFreezeReason, setGlobalFreezeReason] = useState('');

    // Delete confirmation dialog
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

    // Receipts dialog state
    const [openReceiptsDialog, setOpenReceiptsDialog] = useState(false);
    const [uploadedReceipts, setUploadedReceipts] = useState([]);
    const [uploadedReceiptsLoading, setUploadedReceiptsLoading] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [receiptZoom, setReceiptZoom] = useState(1);
    const [boletaMonth, setBoletaMonth] = useState('');

    // Transaction notes quick-view dialog state
    const [openTxNotes, setOpenTxNotes] = useState(false);
    const [txNotes, setTxNotes] = useState('');

    // Transaction explanation dialog state
    const [openTxExplanation, setOpenTxExplanation] = useState(false);
    const [txExplanation, setTxExplanation] = useState({ title: '', text: '' });
    // Help / legend dialog state for the table
    const [openHelpLegend, setOpenHelpLegend] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // derive month options only from uploaded receipts (Boletas should show uploaded files only)
    const boletaMonthOptions = React.useMemo(() => {
        const setMonths = new Set();
        const pushDate = (d) => {
            if (!d) return;
            try {
                const m = moment.parseZone(d).format('YYYY-MM');
                setMonths.add(m);
            } catch (e) { /* ignore */ }
        };
        (uploadedReceipts || []).forEach(r => pushDate(getReceiptDisplayDateValue(r)));
        const arr = Array.from(setMonths).sort().reverse();
        return arr;
    }, [uploadedReceipts]);

    const filteredUploadedReceipts = React.useMemo(() => {
        if (!boletaMonth) return uploadedReceipts || [];
        return (uploadedReceipts || []).filter(r => {
            const d = getReceiptDisplayDateValue(r);
            if (!d) return false;
            return moment.parseZone(d).format('YYYY-MM') === boletaMonth;
        });
    }, [uploadedReceipts, boletaMonth]);

    // Load payment histories from paymenthistory (ledger) via API
    useEffect(() => {
        const loadHistories = async () => {
            if (!open || !payment?.id) {
                setHistories([]);
                return;
            }
            setHistLoading(true);
            try {
                const paymentId = payment.id;
                const cacheKey = `${paymentId}:${histPage}:${histLimit}`;
                const now = Date.now();

                // Try cache
                const cached = histCacheRef.current.get(cacheKey);
                if (cached && (now - cached.ts) < PAYMENT_HIST_CACHE_TTL) {
                    setHistories(cached.data || []);
                    setHistTotal(cached.total || 0);
                    setHistLoading(false);
                    return;
                }
                
                // V2: Usar endpoint de transacciones del nuevo sistema
                const res = await api.get(`/payments/${paymentId}/history`);
                const transactions = res.data.transactions || [];
                
                // Transformar transacciones V2 a formato esperado por la UI
                const arr = transactions.map(tx => {
                    // Parsear metadata si es string (ocurre con ciertos formatos de BD)
                    let metadata = tx.metadata || null;
                    if (typeof metadata === 'string') {
                        try { metadata = JSON.parse(metadata); } catch (e) { metadata = null; }
                    }
                    const ledgerEntries = Array.isArray(tx.ledgerEntries)
                        ? tx.ledgerEntries.map(le => {
                            let leMeta = le.metadata || null;
                            if (typeof leMeta === 'string') { try { leMeta = JSON.parse(leMeta); } catch(e) { leMeta = null; } }
                            return {
                                id: le.id,
                                operation: le.operation,
                                description: le.description,
                                balanceDueBefore: Number(le.balanceDueBefore || 0),
                                balanceDueAfter: Number(le.balanceDueAfter || 0),
                                creditBalanceBefore: Number(le.creditBalanceBefore || 0),
                                creditBalanceAfter: Number(le.creditBalanceAfter || 0),
                                penaltyDueBefore: Number(le.penaltyDueBefore || 0),
                                penaltyDueAfter: Number(le.penaltyDueAfter || 0),
                                metadata: leMeta
                            };
                        })
                        : [];

                    return {
                        id: tx.id,
                        lastPaymentDate: tx.realPaymentDate || tx.createdAt,
                        amountPaid: tx.amount,
                        penaltyAfter: 0, // Las transacciones V2 no tienen penaltyAfter en cada tx
                        receiptNumber: tx.receiptNumber || '',
                        requiresInvoice: tx.invoiceSent || false,
                        type: tx.type,
                        source: tx.source,
                        notes: tx.notes,
                        extraordinaryDiscount: Number(tx.extraordinaryDiscount ?? tx.extraDiscount ?? 0),
                        metadata,
                        ledgerEntries
                    };
                });
                
                // Filtrar transacciones automáticas del sistema para el historial simplificado.
                // CREDIT_AUTO y FULL_DISCOUNT son generados automáticamente y pueden confundir al usuario.
                // Se muestran en la sección "Flujo Completo" (PaymentFlowTimeline).
                const manualFiltered = arr.filter(tx => {
                    const src = String(tx.source || '').toUpperCase();
                    return src !== 'CREDIT_AUTO' && src !== 'FULL_DISCOUNT';
                });
                
                const total = manualFiltered.length;
                
                // Paginar en cliente
                const start = histPage * histLimit;
                const end = start + histLimit;
                const paginatedArr = manualFiltered.slice(start, end);
                
                setHistories(paginatedArr);
                setHistTotal(total);

                // Save to cache
                histCacheRef.current.set(cacheKey, { ts: now, data: paginatedArr, total });
            } catch (err) {
                console.error('Error cargando historial de pagos:', err);
                setHistories([]);
            } finally {
                setHistLoading(false);
            }
        };
        loadHistories();
    }, [open, payment, histPage, histLimit]);

    // Excel export removed; function deleted per request

    const fetchReceiptsForUser = async (userId) => {
        if (!userId) return [];
        setUploadedReceiptsLoading(true);
        try {
            const res = await api.get(`/parents/${userId}/receipts`);
            const arr = res.data.receipts || [];
            setUploadedReceipts(arr);
            setUploadedReceiptsLoading(false);
            return arr;
        } catch (err) {
            console.error('Error fetching receipts for user', userId, err);
            setUploadedReceipts([]);
            setUploadedReceiptsLoading(false);
            return [];
        }
    };

    const handleAction = (name, payload = {}) => {
        // Prevent mutating actions for deleted families
        const mutating = new Set([
            'exoneratePenalty',
            'addTransaction',
            'updateReceiptNumber',
            'updatePayment',
            'toggleRequiresInvoice',
            'toggleAutoDebit',
            'toggleFreezePenalty',
            'freezePenalty',
            'unfreezePenalty',
            'freezeGlobalPenalty',
            'unfreezeGlobalPenalty',
            'payPenalty',
            'discountPenalty',
            'deletePayment'
        ]);
        if (isDeleted && mutating.has(name)) {
            // silently ignore or optionally show a client-side message
            return;
        }

        // If this action modifies payment history on the server, invalidate client's cached pages for this user
        try {
            const paymentId = payment?.id;
            if (paymentId && mutating.has(name)) {
                // clear all cache entries for this paymentId
                const prefix = `${paymentId}:`;
                for (const k of Array.from(histCacheRef.current.keys())) {
                    if (k.startsWith(prefix)) histCacheRef.current.delete(k);
                }
            }
        } catch (err) {
            // non-fatal
            console.warn('Error invalidando cache de historial:', err);
        }

        // Optimistic UI updates for certain actions
        if (name === 'toggleFreezePenalty' || name === 'freezePenalty' || name === 'unfreezePenalty' || name === 'freezeGlobalPenalty' || name === 'unfreezeGlobalPenalty') {
            // Refresh from parent instead of optimistic update on removed field
        }

        // Special-case receipts: open receipts dialog and fetch receipts
        if (name === 'receipts') {
            const uid = (localPayment || payment)?.User?.id || (localPayment || payment)?.userId;
            if (!uid) {
                console.warn('No user id for receipts');
                return;
            }
            (async () => {
                await fetchReceiptsForUser(uid);
                setOpenReceiptsDialog(true);
            })();
            return;
        }

        onAction(name, { payment: localPayment || payment, ...payload });
    };

    const handleToggleInvoiceRow = (row) => {
        if (isDeleted) return;
        const newVal = !row.requiresInvoice;
        // Optimistically update UI
        setHistories((prev) => prev.map(h => (h.id === row.id ? { ...h, requiresInvoice: newVal } : h)));

        // Invalidate cache for this payment (discount may affect snapshots)
        try {
            const paymentId = payment?.id;
            if (paymentId) {
                const prefix = `${paymentId}:`;
                for (const k of Array.from(histCacheRef.current.keys())) {
                    if (k.startsWith(prefix)) histCacheRef.current.delete(k);
                }
            }
        } catch (err) {
            console.warn('Error invalidando cache tras toggle invoice:', err);
        }

        // Persist change to backend using V2 transactions endpoint
        (async () => {
            try {
                const payloadRow = { ...row, paymentId: payment?.id };
                if (row && row.id) {
                    // Update transaction invoice status (V2 endpoint)
                    const response = await api.put(`/payments/v2/transactions/${row.id}/invoice`, { invoiceSent: newVal });
                    console.log('✅ Factura actualizada exitosamente:', response.data);
                } else {
                    console.warn('No se puede actualizar factura: transacción sin ID');
                    return;
                }

                // Notify parent of the successful change
                onToggleInvoiceSent(payloadRow, newVal);
            } catch (err) {
                console.error('❌ Error guardando estado de factura en backend:', err);
                console.error('Response data:', err.response?.data);
                // revert optimistic change on error
                setHistories((prev) => prev.map(h => (h.id === row.id ? { ...h, requiresInvoice: !newVal } : h)));
            }
        })();
    };

    // Receipts dialog UI helpers
    const downloadFile = (url, filename) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleOpenExplanation = useCallback((h) => {
        const dateVal = h.lastPaymentDate || null;
        const amountVal = Number(h.amountPaid || 0);
        const typeLabel = getTransactionTypeMeta(h.type || 'PAYMENT').label;
        const dateStr = dateVal ? moment.parseZone(dateVal).format('DD/MM/YYYY') : '—';
        const explanation = buildTransactionExplanation(h, sortedHistories);
        setTxExplanation({
            title: `${typeLabel} · Q${amountVal.toFixed(2)} · ${dateStr}`,
            text: explanation
        });
        setOpenTxExplanation(true);
    }, [sortedHistories]);

    const invalidateHistoryCacheForPayment = () => {
        try {
            const paymentId = (localPayment || payment)?.id;
            if (paymentId) {
                const prefix = `${paymentId}:`;
                for (const k of Array.from(histCacheRef.current.keys())) {
                    if (k.startsWith(prefix)) histCacheRef.current.delete(k);
                }
            }
        } catch (err) {
            console.warn('Error invalidando cache:', err);
        }
    };

    // compute total after discount (clamp to zero)
    const parsedDiscount = Number(discount || 0) || 0;
    const parsedPercent = (() => {
        const p = percentDiscount;
        if (p === null || typeof p === 'undefined' || String(p).trim() === '') return null;
        const n = Number(p);
        return Number.isFinite(n) ? n : null;
    })();
    const percentDiscountAmount = (parsedPercent !== null) ? Math.round(((Number(computedTariff || 0) * parsedPercent) / 100) * 100) / 100 : 0;
    const totalAfterDiscount = (parsedPercent !== null)
        ? Math.max(0, Number(computedTariff || 0) - percentDiscountAmount)
        : Math.max(0, Number(computedTariff || 0) - parsedDiscount);

    const handleOpenGlobalFreezeDialog = (mode) => {
        setGlobalFreezeDialogMode(mode);
        setGlobalFreezeReason('');
    };

    const handleCloseGlobalFreezeDialog = () => {
        setGlobalFreezeDialogMode(null);
        setGlobalFreezeReason('');
    };

    const handleConfirmGlobalFreezeAction = async () => {
        if (globalFreezeDialogMode === 'freeze') {
            const reason = globalFreezeReason.trim();
            if (!reason) return;
            try {
                const currentDate = await dateService.getCurrentDate();
                handleAction('freezeGlobalPenalty', {
                    freezeDate: currentDate.format('YYYY-MM-DD'),
                    reason,
                    notes: reason
                });
            } catch (error) {
                console.error('Error getting current date:', error);
                handleAction('freezeGlobalPenalty', {
                    freezeDate: moment().format('YYYY-MM-DD'),
                    reason,
                    notes: reason
                });
            }
        } else if (globalFreezeDialogMode === 'unfreeze') {
            handleAction('unfreezeGlobalPenalty', {
                notes: 'Mora global descongelada desde hoy'
            });
        }
        handleCloseGlobalFreezeDialog();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { m: { xs: 0, sm: 2 }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 64px)' } } }}>
            <DialogTitle>Gestión de Pagos</DialogTitle>
            <DialogContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ border: 'none', borderRadius: 1, p: 2, backgroundColor: '#fafafa' }}>
                            <Typography variant="subtitle1">Familia</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="h6"><strong>{family.familyLastName || '-'}</strong></Typography>
                                {/** status badge */}
                                {isDeleted ? (
                                    <Box component="span" sx={{ ml: 1 }}>
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.5, borderRadius: 1, bgcolor: '#000000', color: 'white', fontSize: 12 }}>
                                            ELIMINADO
                                        </Box>
                                    </Box>
                                ) : (() => {
                                    // Check service status and render badge for multiple states
                                    const svcStatus = (localPayment || payment)?.serviceStatus || (payment?.User?.familyServiceStatus?.status) || 'ACTIVE';
                                    const resumeAt = (localPayment || payment)?.resumeDate || payment?.User?.familyServiceStatus?.resumeAt || payment?.User?.FamilyDetail?.resumeAt;

                                    const renderBadge = () => {
                                        let label = '-';
                                        let sx = { display: 'inline-flex', alignItems: 'center', px: 1, py: 0.5, borderRadius: 1, color: 'white', fontSize: 12 };

                                        if (svcStatus === 'ACTIVE') {
                                            label = 'Activo';
                                            sx = { ...sx, bgcolor: 'success.main' };
                                        } else if (svcStatus === 'PAUSED') {
                                            label = 'Pausado';
                                            sx = { ...sx, bgcolor: 'warning.main' };
                                        } else if (svcStatus === 'SUSPENDED') {
                                            label = 'Suspendido';
                                            sx = { ...sx, bgcolor: 'error.main' };
                                        } else if (svcStatus === 'INACTIVE') {
                                            label = 'Inactivo';
                                            sx = { ...sx, bgcolor: '#9e9e9e' };
                                        } else {
                                            label = svcStatus;
                                            sx = { ...sx, bgcolor: '#757575' };
                                        }

                                        const content = (
                                            <Box component="span" sx={{ ml: 1 }}>
                                                <Box sx={sx}>{label}</Box>
                                            </Box>
                                        );

                                        if (svcStatus === 'PAUSED' && resumeAt) {
                                            const formatted = (() => {
                                                try {
                                                    return moment.parseZone(resumeAt).format('DD/MM/YYYY');
                                                } catch (e) {
                                                    return String(resumeAt);
                                                }
                                            })();
                                            return (
                                                <Tooltip title={`Se reactivará automáticamente el ${formatted}`}>
                                                    <span>{content}</span>
                                                </Tooltip>
                                            );
                                        }

                                        return content;
                                    };

                                    return renderBadge();
                                })()}
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Cant. Hijos</Typography>
                                    <Typography variant="body1">{family.studentsCount || 0}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Tipo de Ruta</Typography>
                                    <Typography variant="body1">{family.routeType || '-'}</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'baseline' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Tarifa</Typography>
                                    <Typography variant="h5">Q {totalAfterDiscount}</Typography>
                                </Box>
                                <Box sx={{ ml: { xs: 0, sm: 'auto' } }}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Descuento (Q)</Typography>
                                            <TextField label="Q" type="number" size="small" value={discount} onChange={(e) => setDiscount(e.target.value)} sx={{ width: { xs: '100%', sm: 120 } }} disabled={isDeleted} />
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Descuento (%)</Typography>
                                            <TextField label="%" type="number" size="small" value={percentDiscount} onChange={(e) => setPercentDiscount(e.target.value)} sx={{ width: { xs: '100%', sm: 120 } }} disabled={isDeleted} />
                                        </Box>
                                        <Button variant="outlined" size="small" onClick={() => {
                                            if (isDeleted) return;
                                            const pctRaw = percentDiscount;
                                            const pctHas = !(pctRaw === null || pctRaw === '' || typeof pctRaw === 'undefined') && !Number.isNaN(Number(pctRaw)) && Number(pctRaw) !== 0;
                                            const fixedHas = !(discount === null || discount === '' || typeof discount === 'undefined') && !Number.isNaN(Number(discount)) && Number(discount) !== 0;
                                            // Validation: only one of the inputs may have a value when opening the apply-discount modal
                                            if (pctHas && fixedHas) {
                                                setSnackbar({ open: true, message: 'Solo puede aplicar un único tipo de descuento: monto o porcentaje.', severity: 'error' });
                                                return;
                                            }

                                            // Open modal if either value is present or none (modal allows choosing configured amount)
                                            setOpenDiscountModal(true);
                                        }} disabled={isDeleted}>APLICAR</Button>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <FormControlLabel control={<Switch checked={autoDebit} onChange={(e) => { setAutoDebit(e.target.checked); if (!isDeleted) onAction('toggleAutoDebit', { payment, value: e.target.checked }); }} disabled={isDeleted} />} label="Débito Automático" />
                            <FormControlLabel control={<Switch checked={requiresInvoice} onChange={(e) => { setRequiresInvoice(e.target.checked); if (!isDeleted) onAction('toggleRequiresInvoice', { payment, value: e.target.checked }); }} disabled={isDeleted} />} label="Factura" />
                        </Box>
                        {/* Download button removed per request */}
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                    <Button variant="outlined" startIcon={<ReceiptIcon />} onClick={() => { if (!isDeleted) handleAction('receipts'); }} disabled={isDeleted}>Boletas</Button>
                    <Button 
                        variant="outlined" 
                        color={isGlobalPenaltyFrozen ? "success" : "primary"}
                        startIcon={isGlobalPenaltyFrozen ? <PlayArrowIcon /> : <PauseIcon />}
                        onClick={() => {
                            if (isDeleted) return;
                            handleOpenGlobalFreezeDialog(isGlobalPenaltyFrozen ? 'unfreeze' : 'freeze');
                        }}
                        disabled={isDeleted}
                    >
                        {isGlobalPenaltyFrozen ? 'Descongelar mora global' : 'Congelar mora global'}
                    </Button>
                    {/* State changes handled elsewhere; action buttons removed */}
                    {/* Delete/Revert payment */}
                    <Button variant="outlined" color="warning" startIcon={<Restore />} onClick={() => { if (!isDeleted) setOpenDeleteDialog(true); }} disabled={isDeleted}>Revertir pago</Button>
                </Box>

                <Dialog open={!!globalFreezeDialogMode} onClose={handleCloseGlobalFreezeDialog} maxWidth="xs" fullWidth fullScreen={isMobile}>
                    <DialogTitle>
                        {globalFreezeDialogMode === 'freeze' ? 'Congelar mora global' : 'Descongelar mora global'}
                    </DialogTitle>
                    <DialogContent>
                        {globalFreezeDialogMode === 'freeze' ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Esta acción pausa la mora de la familia completa. Los períodos actuales y futuros no generarán nueva mora hasta descongelar.
                                </Typography>
                                <TextField
                                    label="Razón"
                                    value={globalFreezeReason}
                                    onChange={(event) => setGlobalFreezeReason(event.target.value)}
                                    fullWidth
                                    required
                                    multiline
                                    minRows={2}
                                    autoFocus
                                />
                                <Typography variant="caption" color="text.secondary">
                                    Mora actual: Q {Number(activePayment.penaltyDue || 0).toFixed(2)}
                                </Typography>
                            </Stack>
                        ) : (
                            <Stack spacing={1.5} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    La mora volverá a generarse desde hoy. No se cobrará retroactivo por los días en que estuvo congelada.
                                </Typography>
                                {activePayment.penaltyGlobalFrozenAt && (
                                    <Typography variant="caption" color="text.secondary">
                                        Congelada desde: {moment.parseZone(activePayment.penaltyGlobalFrozenAt).format('DD/MM/YYYY')}
                                    </Typography>
                                )}
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseGlobalFreezeDialog}>Cancelar</Button>
                        <Button
                            variant="contained"
                            color={globalFreezeDialogMode === 'unfreeze' ? 'success' : 'primary'}
                            onClick={handleConfirmGlobalFreezeAction}
                            disabled={globalFreezeDialogMode === 'freeze' && !globalFreezeReason.trim()}
                        >
                            Confirmar
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Exonerate Dialog */}
                <Dialog open={openExonerateDialog} onClose={() => setOpenExonerateDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
                    <DialogTitle>Exonerar Mora</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 1 }}>Ingrese el monto a exonerar (Q)</Typography>
                        <TextField fullWidth type="number" value={exonerateAmount} onChange={(e) => setExonerateAmount(e.target.value)} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setOpenExonerateDialog(false); setExonerateAmount(''); }}>Cancelar</Button>
                        <Button variant="contained" onClick={() => {
                            const amt = Number(exonerateAmount || 0);
                            if (!amt || Number.isNaN(amt) || amt <= 0) return;
                            handleAction('exoneratePenalty', { exonerateAmount: amt });
                            setOpenExonerateDialog(false);
                            setExonerateAmount('');
                        }}>Exonerar</Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Payment Confirmation Dialog */}
                <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
                    <DialogTitle>Confirmar revertir último pago</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">¿Está seguro que desea revertir el último pago? Esta acción no se puede deshacer.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
                        <Button variant="contained" color="error" onClick={() => {
                            // call parent action to delete the payment
                            handleAction('deletePayment');
                            setOpenDeleteDialog(false);
                        }}>Revertir pago</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Boletas (Receipts) */}
                <Dialog open={openReceiptsDialog} onClose={() => { setOpenReceiptsDialog(false); setUploadedReceipts([]); setSelectedReceipt(null); setReceiptZoom(1); }} fullWidth maxWidth="md" fullScreen={isMobile}>
                    <DialogTitle>Boletas</DialogTitle>
                    <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
                        <ReceiptsPane
                            uploadedReceipts={uploadedReceipts}
                            uploadedReceiptsLoading={uploadedReceiptsLoading}
                            boletaMonth={boletaMonth}
                            setBoletaMonth={setBoletaMonth}
                            boletaMonthOptions={boletaMonthOptions}
                            filteredUploadedReceipts={filteredUploadedReceipts}
                            selectedReceipt={selectedReceipt}
                            setSelectedReceipt={setSelectedReceipt}
                            receiptZoom={receiptZoom}
                            setReceiptZoom={setReceiptZoom}
                            downloadFile={downloadFile}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setOpenReceiptsDialog(false); setUploadedReceipts([]); setSelectedReceipt(null); setReceiptZoom(1); }}>Cerrar</Button>
                    </DialogActions>
                </Dialog>

                {/* Discount modal */}
                <RetroactiveApplyModal
                    open={openDiscountModal}
                    onClose={() => setOpenDiscountModal(false)}
                    mode="DISCOUNT"
                    payment={localPayment || payment}
                    currentDiscount={discount}
                    currentPercent={percentDiscount}
                    onApplied={() => {
                        (async () => {
                            invalidateHistoryCacheForPayment();

                            // Refresh local payment snapshot inside this modal
                            try {
                                const id = (localPayment || payment)?.id;
                                if (id) {
                                    const res = await api.get(`/payments/${id}`);
                                    if (res?.data) setLocalPayment(res.data.payment || res.data);
                                }
                            } catch (err) {
                                console.error('Error fetching updated payment after applying discount', err);
                            }

                            // Ask parent page to refresh list/analysis (no legacy discount-save flow)
                            onAction('refreshPayments', { payment: (localPayment || payment) });
                        })();
                    }}
                />
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={5000}
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        severity={snackbar.severity}
                        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
                {!histLoading && sortedHistories.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontStyle: 'italic' }}>
                        ℹ️ Mostrando solo pagos realizados. Para ver el flujo completo (créditos automáticos, distribuciones, etc.) usa la pestaña "Flujo Completo".
                    </Typography>
                )}

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                    <Tabs
                        value={tabValue}
                        onChange={(e, newVal) => setTabValue(newVal)}
                        variant="fullWidth"
                        textColor="primary"
                        indicatorColor="primary"
                    >
                        <Tab
                            value="payments"
                            label="Pagos Registrados"
                            icon={<ReceiptIcon fontSize="small" />}
                            iconPosition="start"
                        />
                        <Tab
                            value="flow"
                            label="Flujo Completo"
                            icon={<TimelineIcon fontSize="small" />}
                            iconPosition="start"
                        />
                    </Tabs>
                </Box>

                {/* Tab: Pagos Registrados (historial simplificado) */}
                {tabValue === 'payments' && (
                <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
                {isMobile ? (
                    <Stack spacing={1.25}>
                        {(!histLoading && sortedHistories.length === 0) && (
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">No hay transacciones registradas.</Typography>
                            </Paper>
                        )}
                        {histLoading && (
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary">Cargando historial...</Typography>
                            </Paper>
                        )}
                        {!histLoading && sortedHistories.map((h) => (
                            <HistoryMobileCard
                                key={h.id || `${h.lastPaymentDate || ''}-${Number(h.amountPaid || 0)}`}
                                history={h}
                                onToggleInvoiceRow={handleToggleInvoiceRow}
                                onOpenNotes={(notes) => { setTxNotes(notes || ''); setOpenTxNotes(true); }}
                                onOpenExplanation={handleOpenExplanation}
                            />
                        ))}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '100%' }}>
                            <TablePagination
                                component="div"
                                count={histTotal}
                                page={histPage}
                                onPageChange={(e, newPage) => setHistPage(newPage)}
                                rowsPerPage={histLimit}
                                onRowsPerPageChange={(e) => { setHistLimit(parseInt(e.target.value, 10)); setHistPage(0); }}
                                rowsPerPageOptions={[5,10,25,50]}
                                labelRowsPerPage="Filas"
                                sx={{
                                    '& .MuiTablePagination-toolbar': { justifyContent: 'flex-start', paddingLeft: 0, flexWrap: 'wrap' },
                                    '& .MuiTablePagination-spacer': { display: 'none' }
                                }}
                            />
                        </Box>
                    </Stack>
                ) : (
                <Table size="small" sx={{ width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={histOrderBy === 'date'}
                                    direction={histOrderBy === 'date' ? histOrder : 'desc'}
                                    onClick={() => handleHistRequestSort('date')}
                                >
                                    Fecha
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={histOrderBy === 'type'}
                                    direction={histOrderBy === 'type' ? histOrder : 'asc'}
                                    onClick={() => handleHistRequestSort('type')}
                                >
                                    Tipo
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">
                                <TableSortLabel
                                    active={histOrderBy === 'source'}
                                    direction={histOrderBy === 'source' ? histOrder : 'asc'}
                                    onClick={() => handleHistRequestSort('source')}
                                >
                                    Fuente
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center">Monto</TableCell>
                            <TableCell align="center">Desc. Extra</TableCell>
                            <TableCell align="center">N° Boleta</TableCell>
                            <TableCell align="center">Factura</TableCell>
                            <TableCell align="left">Notas</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(!histLoading && sortedHistories.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">No hay transacciones registradas.</TableCell>
                            </TableRow>
                        )}
                        {histLoading && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">Cargando historial...</TableCell>
                            </TableRow>
                        )}
                        {!histLoading && sortedHistories.map((h) => {
                            const dateVal = h.lastPaymentDate || null;
                            const amountVal = Number(h.amountPaid || 0);
                            const typeVal = h.type || 'PAYMENT';
                            const sourceVal = h.source || 'MANUAL';
                            const receiptVal = h.receiptNumber || '—';
                            const invoiceReq = !!h.requiresInvoice;
                            const notesVal = h.notes || '';
                            const key = h.id || `${dateVal || ''}-${amountVal}`;

                            const typeMeta = getTransactionTypeMeta(typeVal);
                            const sourceMeta = getTransactionSourceMeta(sourceVal);

                            return (
                                <TableRow key={key} hover>
                                    <TableCell align="center">
                                        <Typography variant="body2">{dateVal ? moment.parseZone(dateVal).format('DD/MM/YY') : '—'}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <TransactionBadge label={typeMeta.label} backgroundColor={typeMeta.backgroundColor} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <TransactionBadge label={sourceMeta.label} backgroundColor={sourceMeta.backgroundColor} compact />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: amountVal >= 0 ? 'success.main' : 'error.main' }}>Q {amountVal.toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">Q {(Number(h.extraordinaryDiscount || 0)).toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {receiptVal}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Checkbox checked={invoiceReq} onChange={() => handleToggleInvoiceRow(h)} />
                                    </TableCell>
                                    <TableCell align="left">
                                        <MuiIconButton size="small" onClick={() => { setTxNotes(h.notes || ''); setOpenTxNotes(true); }} title={notesVal ? 'Ver notas' : 'Agregar nota'}>
                                            <NoteAltIcon fontSize="small" color={notesVal ? 'action' : 'disabled'} />
                                        </MuiIconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        <TableRow>
                            <TableCell colSpan={8} sx={{ border: 'none', py: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <TablePagination
                                        component="div"
                                        count={histTotal}
                                        page={histPage}
                                        onPageChange={(e, newPage) => setHistPage(newPage)}
                                        rowsPerPage={histLimit}
                                        onRowsPerPageChange={(e) => { setHistLimit(parseInt(e.target.value, 10)); setHistPage(0); }}
                                        rowsPerPageOptions={[5,10,25,50]}
                                        labelRowsPerPage="Filas"
                                        sx={{
                                            '& .MuiTablePagination-toolbar': { justifyContent: 'flex-start', paddingLeft: 0, flexWrap: 'wrap' },
                                            '& .MuiTablePagination-spacer': { display: 'none' }
                                        }}
                                    />
                                </Box>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                )}
                </Box>
                )}

                {/* Tab: Flujo Completo */}
                {tabValue === 'flow' && (
                    <PaymentFlowTimeline
                        paymentId={payment?.id}
                        userId={payment?.userId || payment?.User?.id}
                        familyLastName={family.familyLastName || ''}
                    />
                )}

                {/* Dialog: Vista rápida de Notas de Transacciones */}
                <Dialog open={openTxNotes} onClose={() => setOpenTxNotes(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
                    <DialogTitle>Notas de Transacción</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{txNotes || '—'}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenTxNotes(false)}>Cerrar</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Explicación detallada de Transacción */}
                <Dialog open={openTxExplanation} onClose={() => setOpenTxExplanation(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
                    PaperProps={{ sx: { borderRadius: 2 } }}>
                    <DialogTitle sx={{
                        pb: 1,
                        borderBottom: '1px solid #e0e0e0',
                        backgroundColor: '#f5f7fa',
                        fontWeight: 700
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '50%',
                                backgroundColor: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem'
                            }}>ℹ️</Box>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                    {txExplanation.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Detalle de cómo se distribuyó esta transacción
                                </Typography>
                            </Box>
                        </Box>
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2.5 }}>
                        <Typography
                            variant="body2"
                            sx={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                lineHeight: 1.8,
                                '& strong': { fontWeight: 600 }
                            }}
                        >
                            {txExplanation.text || 'No hay información disponible para esta transacción.'}
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
                        <Button onClick={() => setOpenTxExplanation(false)} variant="outlined" size="small">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Leyenda / Ayuda de la Tabla de Historial (mejor visual) */}
                <Dialog open={openHelpLegend} onClose={() => setOpenHelpLegend(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
                    <DialogTitle>Leyenda - Historial de Pagos</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>Columnas y etiquetas</Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" sx={{ mb: 1, display: 'inline-block', px: 1, py: 0.5, bgcolor: 'grey.100', borderRadius: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Período Aplicado</Typography>
                                <List dense>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="caption" sx={{ px: 0.6, py: 0.15, borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#fff3e0', color: '#e65100' }}>
                                                        ✓ Tarifa
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Ene 2026 Q910.00</Typography>
                                                </Box>
                                            }
                                            secondary="Pago aplicado directamente al período. Muestra el mes y monto asignado."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="caption" sx={{ px: 0.6, py: 0.15, borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#e3f2fd', color: '#1565c0' }}>
                                                        ↘ Crédito
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Jun 2026 Q12.13</Typography>
                                                </Box>
                                            }
                                            secondary="Indica que se usó crédito disponible para pagar parte de la tarifa de ese período."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="caption" sx={{ px: 0.6, py: 0.15, borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
                                                        ↗ Crédito
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Crédito Q12.13</Typography>
                                                </Box>
                                            }
                                            secondary="Muestra que esta transacción generó crédito (sobrepago). El monto se agregó al saldo de crédito disponible."
                                        />
                                    </ListItem>
                                </List>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" sx={{ mb: 1, display: 'inline-block', px: 1, py: 0.5, bgcolor: 'grey.100', borderRadius: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Tipo</Typography>
                                <List dense>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="TARIFA" size="small" sx={{ fontWeight: 700, backgroundColor: '#e8f5e9', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Pago de la tarifa mensual."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="MORA"  size="small" sx={{ fontWeight: 700, backgroundColor: '#fff3e0', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Pago aplicado a mora."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="CREDITO" size="small" sx={{ fontWeight: 700, backgroundColor: '#e1f5fe', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Transacción que representa uso/actualización de crédito o descuentos."
                                        />
                                    </ListItem>
                                </List>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2" sx={{ mb: 1, display: 'inline-block', px: 1, py: 0.5, bgcolor: 'grey.100', borderRadius: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Fuente</Typography>
                                <List dense>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                                primary={<Chip label="MANUAL" size="small" sx={{ fontWeight: 700, backgroundColor: '#fff9c4', color: 'rgba(0,0,0,0.87)' }} />}
                                                secondary="Registro manual en el sistema."
                                            />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="AUTO_DEBIT" size="small" sx={{ fontWeight: 700, backgroundColor: '#c8e6c9', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Débito automático."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="CREDIT_AUTO" size="small" sx={{ fontWeight: 700, backgroundColor: '#b3e5fc', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Uso automático de crédito disponible."
                                        />
                                    </ListItem>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText
                                            primary={<Chip label="FULL_DISCOUNT" size="small" sx={{ fontWeight: 700, backgroundColor: '#d1c4e9', color: 'rgba(0,0,0,0.87)' }} />}
                                            secondary="Descuento total aplicado automáticamente."
                                        />
                                    </ListItem>
                                </List>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenHelpLegend(false)}>Cerrar</Button>
                    </DialogActions>
                </Dialog>
            </DialogContent>
            <DialogActions sx={{ px: { xs: 1.5, sm: 3 }, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Button onClick={onClose} fullWidth={isMobile}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(ManagePaymentsModal);
