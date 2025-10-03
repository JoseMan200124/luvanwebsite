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
    Checkbox
} from '@mui/material';
import TablePagination from '@mui/material/TablePagination';
import { ReceiptLong as ReceiptIcon, Pause as PauseIcon, MonetizationOn as MoneyIcon, Block as BlockIcon, PlayArrow as PlayArrowIcon, CheckCircle as CheckCircleIcon, Delete as DeleteIcon, Restore } from '@mui/icons-material';
import moment from 'moment';
import api from '../utils/axiosConfig';
import ReceiptsPane from './ReceiptsPane';

// cache TTL (ms)
const PAYMENT_HIST_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const ManagePaymentsModal = ({ open, onClose, payment = {}, onAction = () => {}, onToggleInvoiceSent = () => {}, onSaveDiscount = () => {} }) => {
    const [localPayment, setLocalPayment] = useState(payment);
    useEffect(() => setLocalPayment(payment), [payment]);
    const family = localPayment?.User?.FamilyDetail || payment?.User?.FamilyDetail || {};
    const [autoDebit, setAutoDebit] = useState(!!family.autoDebit || false);
    const [requiresInvoice, setRequiresInvoice] = useState(!!family.requiresInvoice || false);
    const [discount, setDiscount] = useState(family.specialFee || family.discount || 0);

    useEffect(() => {
        setAutoDebit(!!(payment?.User?.FamilyDetail?.autoDebit));
        setRequiresInvoice(!!(payment?.User?.FamilyDetail?.requiresInvoice));
        setDiscount(payment?.User?.FamilyDetail?.specialFee || payment?.User?.FamilyDetail?.discount || 0);
    }, [payment, open]);

    // Prefer Sequelize included PaymentTransactions (backend includes them as PaymentTransactions)
    const [histories, setHistories] = useState([]);
    const [histLoading, setHistLoading] = useState(false);
    const [histPage, setHistPage] = useState(0);
    const [histLimit, setHistLimit] = useState(10);
    const [histTotal, setHistTotal] = useState(0);

    // module-level cache (persists across renders)
    if (!global.__paymentHistCache) global.__paymentHistCache = new Map();
    const histCacheRef = React.useRef(global.__paymentHistCache);

    // Load payment histories from paymenthistory (ledger) via API
    useEffect(() => {
        const loadHistories = async () => {
            if (!open || !payment?.User?.id) {
                setHistories([]);
                return;
            }
            setHistLoading(true);
            try {
                const userId = payment.User.id;
                const cacheKey = `${userId}:${histPage}:${histLimit}`;
                const now = Date.now();

                // Try cache
                const cached = histCacheRef.current.get(cacheKey);
                if (cached && (now - cached.ts) < PAYMENT_HIST_CACHE_TTL) {
                    setHistories(cached.data || []);
                    setHistTotal(cached.total || 0);
                    setHistLoading(false);
                    return;
                }

                // Use the userId to fetch only this family's histories
                const params = { userId, limit: histLimit, page: histPage };
                const res = await api.get('/payments/paymenthistory', { params });
                const arr = res.data.histories || []; // controller returns { histories }
                const total = res.data.totalRecords || res.data.total || 0;
                setHistories(arr);
                setHistTotal(total);

                // Save to cache
                histCacheRef.current.set(cacheKey, { ts: now, data: arr, total });
            } catch (err) {
                console.error('Error cargando historial de pagos:', err);
                setHistories([]);
            } finally {
                setHistLoading(false);
            }
        };
        loadHistories();
    }, [open, payment, histPage, histLimit]);

    // compute tariff: prefer school's transport fees based on routeType, fallback to payment tariff/rate
    const school = payment?.User.School || {};
    // routeType is one of: 'Completa', 'Media AM', 'Media PM' — use exact mapping to school's fees
    const routeType = (family.routeType || payment?.routeType || '');

    const transportFeeComplete = Number(school.transportFeeComplete ?? school.transport_fee_complete ?? 0) || 0;
    const transportFeeHalf = Number(school.transportFeeHalf ?? school.transport_fee_half ?? 0) || 0;
    let computedTariff = 0;
    if (routeType === 'Completa') computedTariff = transportFeeComplete;
    else if (routeType === 'Media AM' || routeType === 'Media PM') computedTariff = transportFeeHalf;

    const [openExonerateDialog, setOpenExonerateDialog] = useState(false);
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
        // If this action modifies payment history on the server, invalidate client's cached pages for this user
        const mutating = ['exoneratePenalty', 'addTransaction', 'updateReceiptNumber', 'updatePayment', 'toggleRequiresInvoice', 'toggleAutoDebit', 'toggleFreezePenalty', 'suspend', 'activate'];
        try {
            const uid = payment?.User?.id;
            if (uid && mutating.includes(name)) {
                // clear all cache entries for this userId
                const prefix = `${uid}:`;
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
                return { ...prev, penaltyPaused: !prev.penaltyPaused };
            });
        }
        if (name === 'suspend' || name === 'activate') {
            const desiredState = name === 'suspend' ? 0 : 1;
            setLocalPayment(prev => {
                if (!prev) return prev;
                return { ...prev, User: { ...(prev.User || {}), state: desiredState } };
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

        onAction(name, { payment: localPayment || payment, ...payload });
    };

    const handleToggleInvoiceRow = (row) => {
        const newVal = !row.requiresInvoice;
        // Optimistically update UI
        setHistories((prev) => prev.map(h => (h.id === row.id ? { ...h, requiresInvoice: newVal } : h)));

        // Invalidate cache for this user so subsequent reads are fresh
        try {
            const uid = payment?.User?.id;
            if (uid) {
                const prefix = `${uid}:`;
                for (const k of Array.from(histCacheRef.current.keys())) {
                    if (k.startsWith(prefix)) histCacheRef.current.delete(k);
                }
            }
        } catch (err) {
            console.warn('Error invalidando cache tras toggle invoice:', err);
        }

        // Persist change to backend. Prefer updating the specific history record when id present,
        // otherwise create a meta history record for the payment.
        (async () => {
            try {
                const payloadRow = { ...row, paymentId: payment?.id };
                if (row && row.id) {
                    // Update specific history row
                    await api.put(`/payments/history/${row.id}/invoice`, { invoiceSended: newVal });
                } else {
                    // Create a meta history record linked to the payment
                    await api.put(`/payments/${payment?.id}/voice`, { invoiceSended: newVal }).catch(async () => {
                        // fallback in case of typo or older backend: try the intended endpoint
                        await api.put(`/payments/${payment?.id}/invoice`, { invoiceSended: newVal });
                    });
                }

                // Notify parent of the successful change
                onToggleInvoiceSent(payloadRow, newVal);
            } catch (err) {
                console.error('Error guardando estado de factura en backend:', err);
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

    const handleSaveDiscount = () => {
        // Invalidate cached histories for this user (discount may affect snapshots)
        try {
            const uid = (localPayment || payment)?.User?.id;
            if (uid) {
                const prefix = `${uid}:`;
                for (const k of Array.from(histCacheRef.current.keys())) {
                    if (k.startsWith(prefix)) histCacheRef.current.delete(k);
                }
            }
        } catch (err) {
            console.warn('Error invalidando cache tras guardar descuento:', err);
        }
        onSaveDiscount(localPayment || payment, Number(discount || 0));
    };

    // compute total after discount (clamp to zero)
    const parsedDiscount = Number(discount || 0) || 0;
    const totalAfterDiscount = Math.max(0, Number(computedTariff * (family.Students || []).length || 0) - parsedDiscount);

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
                                {(() => {
                                    // Prefer explicit FamilyDetail.active if present; otherwise derive from localPayment (optimistic) or prop
                                    const userState = (localPayment || payment)?.User?.state;
                                    const isActive = typeof family.active !== 'undefined' ? !!family.active : (userState === 1);
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
                                        <TextField label="" type="number" size="small" value={discount} onChange={(e) => setDiscount(e.target.value)} sx={{ width: 100 }} />
                                        <Button variant="outlined" size="small" onClick={handleSaveDiscount}>GUARDAR</Button>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <FormControlLabel control={<Switch checked={autoDebit} onChange={(e) => { setAutoDebit(e.target.checked); onAction('toggleAutoDebit', { payment, value: e.target.checked }); }} />} label="Débito Automático" />
                            <FormControlLabel control={<Switch checked={requiresInvoice} onChange={(e) => { setRequiresInvoice(e.target.checked); onAction('toggleRequiresInvoice', { payment, value: e.target.checked }); }} />} label="Factura" />
                        </Box>
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center', width: '100%' }}>
                    <Button variant="outlined" startIcon={<ReceiptIcon />} onClick={() => handleAction('receipts')}>Boletas</Button>
                    {/* Freeze/resume mora: show 'Reanudar Mora' if penaltyPaused true */}
                    <Button variant="outlined" startIcon={localPayment?.penaltyPaused ? <PlayArrowIcon /> : <PauseIcon />} onClick={() => handleAction('toggleFreezePenalty')}>{localPayment?.penaltyPaused ? 'Reanudar Mora' : 'Congelar Mora'}</Button>
                    <Button variant="outlined" startIcon={<MoneyIcon />} onClick={() => setOpenExonerateDialog(true)}>Exonerar Mora</Button>
                    {/* Suspend/Activate: toggle based on user state */}
                    <Button variant="outlined" startIcon={localPayment?.User?.state === 1 ? <BlockIcon /> : <CheckCircleIcon />} onClick={() => handleAction(localPayment?.User?.state === 1 ? 'suspend' : 'activate')}>{localPayment?.User?.state === 1 ? 'Suspender' : 'Activar'}</Button>
                    {/* Delete/Revert payment */}
                    <Button variant="outlined" color="warning" startIcon={<Restore />} onClick={() => setOpenDeleteDialog(true)}>Revertir pago</Button>
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

                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Historial de Pagos</Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center">Fecha de Pago</TableCell>
                            <TableCell align="center">Monto</TableCell>
                            <TableCell align="center">Mora</TableCell>
                            <TableCell align="center">Número de Boleta</TableCell>
                            <TableCell align="center">Factura Envíada</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(!histLoading && histories.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">No hay pagos registrados.</TableCell>
                            </TableRow>
                        )}
                        {histLoading && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">Cargando historial...</TableCell>
                            </TableRow>
                        )}
                        {!histLoading && histories.map((h) => {
                            // PaymentHistory fields: snapshotDate, lastPaymentDate, amountPaid, tarif, accumulatedPenalty, totalDue, requiresInvoice, familyLastName
                            const dateVal = h.lastPaymentDate || h.snapshotDate || null;
                            // Prefer amountPaid (ledger actual paid amount). Fallback to tarif or totalDue for older records.
                            const amountVal = (typeof h.amountPaid !== 'undefined' && h.amountPaid !== null) ? h.amountPaid : (h.tarif ?? h.totalDue ?? 0);
                            const penaltyVal = h.accumulatedPenalty ?? 0;
                            const receiptVal = h.receiptNumber || '';
                            const invoiceReq = !!h.requiresInvoice;
                            const key = h.id || `${dateVal || ''}-${amountVal}`;

                            return (
                                <TableRow key={key}>
                                    <TableCell align="center">{dateVal ? moment.parseZone(dateVal).format('DD/MM/YY') : '—'}</TableCell>
                                    <TableCell align="center">Q {Number(amountVal).toFixed(2)}</TableCell>
                                    <TableCell align="center">Q {Number(penaltyVal).toFixed(2)}</TableCell>
                                    <TableCell align="center">{receiptVal}</TableCell>
                                    <TableCell align="center">
                                        <Checkbox checked={invoiceReq} onChange={() => handleToggleInvoiceRow(h)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {/* Pagination row inserted as last table row */}
                        <TableRow>
                            <TableCell colSpan={6} sx={{ border: 'none', py: 1 }}>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(ManagePaymentsModal);
