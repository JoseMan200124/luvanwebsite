import React, { useState, useEffect } from 'react';
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
    Divider,
    List,
    ListItem,
    ListItemText,
    Chip,
    Stack
} from '@mui/material';
import TableSortLabel from '@mui/material/TableSortLabel';
import TablePagination from '@mui/material/TablePagination';
import { 
    ReceiptLong as ReceiptIcon, 
    Pause as PauseIcon, 
    PlayArrow as PlayArrowIcon, 
    Block as BlockIcon, 
    CheckCircle as CheckCircleIcon, 
    Restore,
    HelpOutline as HelpIcon,
    NoteAlt as NoteAltIcon
} from '@mui/icons-material';
import moment from 'moment';
import api from '../utils/axiosConfig';
import dateService from '../services/dateService';
import ReceiptsPane from './ReceiptsPane';
import RetroactiveApplyModal from './modals/RetroactiveApplyModal';

// cache TTL (ms)
const PAYMENT_HIST_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const ManagePaymentsModal = ({ open, onClose, payment = {}, onAction = () => {}, onToggleInvoiceSent = () => {} }) => {
    const [localPayment, setLocalPayment] = useState(payment);
    useEffect(() => setLocalPayment(payment), [payment]);
    const family = localPayment?.User?.FamilyDetail || payment?.User?.FamilyDetail || {};
    const finalStatus = ((localPayment || payment)?.finalStatus || '').toString().toUpperCase();
    const isDeleted = finalStatus === 'ELIMINADO' || !!family.deleted;
    const [autoDebit, setAutoDebit] = useState(!!family.autoDebit || false);
    const [requiresInvoice, setRequiresInvoice] = useState(!!family.requiresInvoice || false);
    const [discount, setDiscount] = useState(family.specialFee ?? family.discount ?? 0);

    useEffect(() => {
        setAutoDebit(!!(payment?.User?.FamilyDetail?.autoDebit));
        setRequiresInvoice(!!(payment?.User?.FamilyDetail?.requiresInvoice));
        setDiscount(payment?.User?.FamilyDetail?.specialFee ?? payment?.User?.FamilyDetail?.discount ?? 0);
    }, [payment, open]);

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
    // Help / legend dialog state for the table
    const [openHelpLegend, setOpenHelpLegend] = useState(false);

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
        (uploadedReceipts || []).forEach(r => pushDate(r.createdAt || r.uploadedAt || r.date));
        const arr = Array.from(setMonths).sort().reverse();
        return arr;
    }, [uploadedReceipts]);

    const filteredUploadedReceipts = React.useMemo(() => {
        if (!boletaMonth) return uploadedReceipts || [];
        return (uploadedReceipts || []).filter(r => {
            const d = r.createdAt || r.uploadedAt || r.date;
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
                const arr = transactions.map(tx => ({
                    id: tx.id,
                    lastPaymentDate: tx.realPaymentDate || tx.createdAt,
                    amountPaid: tx.amount,
                    penaltyAfter: 0, // Las transacciones V2 no tienen penaltyAfter en cada tx
                    receiptNumber: tx.receiptNumber || '',
                    requiresInvoice: tx.invoiceSent || false,
                    type: tx.type,
                    source: tx.source,
                    notes: tx.notes,
                    extraordinaryDiscount: Number(tx.extraordinaryDiscount ?? tx.extraDiscount ?? 0)
                }));
                
                const total = arr.length;
                
                // Paginar en cliente
                const start = histPage * histLimit;
                const end = start + histLimit;
                const paginatedArr = arr.slice(start, end);
                
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
        const mutating = ['exoneratePenalty', 'addTransaction', 'updateReceiptNumber', 'updatePayment', 'toggleRequiresInvoice', 'toggleAutoDebit', 'toggleFreezePenalty', 'suspend', 'activate'];
        if (isDeleted && mutating.includes(name)) {
            // silently ignore or optionally show a client-side message
            return;
        }

        // If this action modifies payment history on the server, invalidate client's cached pages for this user
        try {
            const paymentId = payment?.id;
            if (paymentId && mutating.includes(name)) {
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
        if (name === 'toggleFreezePenalty' || name === 'freezePenalty') {
            setLocalPayment(prev => {
                if (!prev) return prev;
                return { ...prev, penaltyFrozen: !prev.penaltyFrozen };
            });
        }
        if (name === 'suspend' || name === 'activate') {
            const desiredStatus = name === 'suspend' ? 'INACTIVO' : 'ACTIVO';
            setLocalPayment(prev => {
                if (!prev) return prev;
                return { ...prev, status: desiredStatus };
            });
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

        // Update local state for suspend/activate actions
        if (name === 'suspend') {
            setLocalPayment(prev => ({ ...prev, status: 'INACTIVO', finalStatus: 'INACTIVO' }));
        } else if (name === 'activate') {
            setLocalPayment(prev => ({ ...prev, status: 'ACTIVO' }));
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
    const totalAfterDiscount = Math.max(0, Number(computedTariff || 0) - parsedDiscount);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Gestión de Pagos</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 1, p: 2, backgroundColor: '#fafafa' }}>
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
                                    // Check payment status (ACTIVO, PENDIENTE, etc.) - not INACTIVO means active
                                    const paymentStatus = (localPayment || payment)?.status;
                                    const isActive = paymentStatus && paymentStatus !== 'INACTIVO';
                                    return (
                                        <Box component="span" sx={{ ml: 1 }}>
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.5, borderRadius: 1, bgcolor: isActive ? 'success.main' : 'error.main', color: 'white', fontSize: 12 }}>
                                                {isActive ? 'Activo' : 'Inactivo'}
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Cant. Hijos</Typography>
                                    <Typography variant="body1">{ (family.Students || []).length || 0 }</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Tipo de Ruta</Typography>
                                    <Typography variant="body1">{family.routeType || '-'}</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Tarifa</Typography>
                                    <Typography variant="h5">Q {totalAfterDiscount}</Typography>
                                </Box>
                                <Box sx={{ ml: 'auto' }}>
                                    <Typography variant="caption" color="text.secondary">Descuento (Q)</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <TextField label="" type="number" size="small" value={discount} onChange={(e) => setDiscount(e.target.value)} sx={{ width: 100 }} disabled={isDeleted} />
                                        <Button variant="outlined" size="small" onClick={() => {
                                            if (isDeleted) return;
                                            // IMPORTANT: Do NOT persist discount here.
                                            // The new flow applies the discount from the modal (retroactive scopes).
                                            setOpenDiscountModal(true);
                                        }} disabled={isDeleted}>APLICAR</Button>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <FormControlLabel control={<Switch checked={autoDebit} onChange={(e) => { setAutoDebit(e.target.checked); if (!isDeleted) onAction('toggleAutoDebit', { payment, value: e.target.checked }); }} disabled={isDeleted} />} label="Débito Automático" />
                            <FormControlLabel control={<Switch checked={requiresInvoice} onChange={(e) => { setRequiresInvoice(e.target.checked); if (!isDeleted) onAction('toggleRequiresInvoice', { payment, value: e.target.checked }); }} disabled={isDeleted} />} label="Factura" />
                        </Box>
                        {/* Download button removed per request */}
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                    <Button variant="outlined" startIcon={<ReceiptIcon />} onClick={() => { if (!isDeleted) handleAction('receipts'); }} disabled={isDeleted}>Boletas</Button>
                    {/* Freeze/Unfreeze penalty button - disponible para todos los pagos */}
                    <Button 
                        variant="outlined" 
                        color={localPayment?.penaltyFrozenAt ? "success" : "primary"}
                        startIcon={localPayment?.penaltyFrozenAt ? <PlayArrowIcon /> : <PauseIcon />}
                        onClick={async () => {
                            if (isDeleted) return;
                            if (localPayment?.penaltyFrozenAt) {
                                handleAction('unfreezePenalty');
                            } else {
                                // Freeze with current date from backend (simulated or real)
                                try {
                                    const currentDate = await dateService.getCurrentDate();
                                    const today = currentDate.format('YYYY-MM-DD');
                                    handleAction('freezePenalty', { freezeDate: today });
                                } catch (error) {
                                    console.error('Error getting current date:', error);
                                    // Fallback to local date if service fails
                                    const today = moment().format('YYYY-MM-DD');
                                    handleAction('freezePenalty', { freezeDate: today });
                                }
                            }
                        }}
                        disabled={isDeleted}
                    >
                        {localPayment?.penaltyFrozenAt ? 'Reanudar Mora' : 'Congelar Mora'}
                    </Button>
                    {/* Suspend/Activate: toggle based on payment status */}
                    <Button variant="outlined" startIcon={(localPayment || payment)?.status !== 'INACTIVO' ? <BlockIcon /> : <CheckCircleIcon />} onClick={() => { if (!isDeleted) handleAction((localPayment || payment)?.status !== 'INACTIVO' ? 'suspend' : 'activate'); }} disabled={isDeleted}>{(localPayment || payment)?.status !== 'INACTIVO' ? 'Suspender' : 'Activar'}</Button>
                    {/* Delete/Revert payment */}
                    <Button variant="outlined" color="warning" startIcon={<Restore />} onClick={() => { if (!isDeleted) setOpenDeleteDialog(true); }} disabled={isDeleted}>Revertir pago</Button>
                </Box>

                {/* Exonerate Dialog */}
                <Dialog open={openExonerateDialog} onClose={() => setOpenExonerateDialog(false)} maxWidth="sm" fullWidth>
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
                <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
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
                <Dialog open={openReceiptsDialog} onClose={() => { setOpenReceiptsDialog(false); setUploadedReceipts([]); setSelectedReceipt(null); setReceiptZoom(1); }} fullWidth maxWidth="md">
                    <DialogTitle>Boletas</DialogTitle>
                    <DialogContent>
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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, mb: 1 }}>
                    <Typography variant="h6">Historial de Pagos</Typography>
                    <MuiIconButton size="small" onClick={() => setOpenHelpLegend(true)} title="Ayuda - Leyenda tabla" sx={{ ml: 0.5 }}>
                        <HelpIcon fontSize="small" />
                    </MuiIconButton>
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center" sx={{ minWidth: 100 }}>
                                <TableSortLabel
                                    active={histOrderBy === 'date'}
                                    direction={histOrderBy === 'date' ? histOrder : 'desc'}
                                    onClick={() => handleHistRequestSort('date')}
                                >
                                    Fecha
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ minWidth: 120 }}>
                                <TableSortLabel
                                    active={histOrderBy === 'type'}
                                    direction={histOrderBy === 'type' ? histOrder : 'asc'}
                                    onClick={() => handleHistRequestSort('type')}
                                >
                                    Tipo
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ minWidth: 100 }}>
                                <TableSortLabel
                                    active={histOrderBy === 'source'}
                                    direction={histOrderBy === 'source' ? histOrder : 'asc'}
                                    onClick={() => handleHistRequestSort('source')}
                                >
                                    Fuente
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ minWidth: 100 }}>Monto</TableCell>
                            <TableCell align="center" sx={{ minWidth: 110 }}>Desc. Extra</TableCell>
                            <TableCell align="center" sx={{ minWidth: 120 }}>N° Boleta</TableCell>
                            <TableCell align="center" sx={{ minWidth: 100 }}>Factura</TableCell>
                            <TableCell align="left" sx={{ minWidth: 140 }}>Notas</TableCell>
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
                        {!histLoading && sortedHistories.slice(histPage * histLimit, histPage * histLimit + histLimit).map((h) => {
                            const dateVal = h.lastPaymentDate || null;
                            const amountVal = Number(h.amountPaid || 0);
                            const typeVal = h.type || 'PAYMENT';
                            const sourceVal = h.source || 'MANUAL';
                            const receiptVal = h.receiptNumber || '—';
                            const invoiceReq = !!h.requiresInvoice;
                            const notesVal = h.notes || '';
                            const key = h.id || `${dateVal || ''}-${amountVal}`;

                            let typeLabel = typeVal;
                            let typeBgColor = '#e0e0e0';
                            switch(typeVal?.toUpperCase()) {
                                case 'TARIFA':
                                case 'PAYMENT':
                                    typeLabel = 'TARIFA';
                                    typeBgColor = '#e8f5e9';
                                    break;
                                case 'MORA':
                                case 'PENALTY_PAYMENT':
                                    typeLabel = 'MORA';
                                    typeBgColor = '#fff3e0';
                                    break;
                                case 'CREDITO':
                                case 'PENALTY_DISCOUNT':
                                    typeLabel = 'CREDITO';
                                    typeBgColor = '#e1f5fe';
                                    break;
                                default:
                                    typeLabel = typeVal || 'Otro';
                                    break;
                            }

                            let sourceLabel = sourceVal;
                            let sourceBgColor = '#f5f5f5';
                            switch(sourceVal?.toUpperCase()) {
                                case 'MANUAL':
                                    sourceLabel = 'MANUAL';
                                    sourceBgColor = '#fff9c4';
                                    break;
                                case 'AUTO_DEBIT':
                                    sourceLabel = 'AUTO_DEBIT';
                                    sourceBgColor = '#c8e6c9';
                                    break;
                                case 'CREDIT_AUTO':
                                    sourceLabel = 'CREDIT_AUTO';
                                    sourceBgColor = '#b3e5fc';
                                    break;
                                case 'FULL_DISCOUNT':
                                    sourceLabel = 'FULL_DISCOUNT';
                                    sourceBgColor = '#d1c4e9';
                                    break;
                                default:
                                    sourceLabel = sourceVal || 'Otro';
                                    break;
                            }

                            return (
                                <TableRow key={key} hover>
                                    <TableCell align="center">
                                        <Typography variant="body2">{dateVal ? moment.parseZone(dateVal).format('DD/MM/YY') : '—'}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 1, backgroundColor: typeBgColor, fontSize: '0.75rem', fontWeight: 600 }}>{typeLabel}</Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 0.5, backgroundColor: sourceBgColor, fontSize: '0.7rem' }}>{sourceLabel}</Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: amountVal >= 0 ? 'success.main' : 'error.main' }}>Q {amountVal.toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">Q {(Number(h.extraordinaryDiscount || 0)).toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{receiptVal}</Typography>
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
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <TablePagination
                                        component="div"
                                        count={histTotal}
                                        page={histPage}
                                        onPageChange={(e, newPage) => setHistPage(newPage)}
                                        rowsPerPage={histLimit}
                                        onRowsPerPageChange={(e) => { setHistLimit(parseInt(e.target.value, 10)); setHistPage(0); }}
                                        rowsPerPageOptions={[5,10,25,50]}
                                        labelRowsPerPage="Filas"
                                    />
                                </Box>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                </Box>

                {/* Dialog: Vista rápida de Notas de Transacciones */}
                <Dialog open={openTxNotes} onClose={() => setOpenTxNotes(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Notas de Transacción</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{txNotes || '—'}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenTxNotes(false)}>Cerrar</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog: Leyenda / Ayuda de la Tabla de Historial (mejor visual) */}
                <Dialog open={openHelpLegend} onClose={() => setOpenHelpLegend(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Leyenda - Historial de Pagos</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>Columnas y etiquetas</Typography>
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
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(ManagePaymentsModal);
