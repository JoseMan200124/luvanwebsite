// src/pages/PaymentsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
import moment from 'moment';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    TextField,
    IconButton,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Badge,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import {
    Send as SendIcon,
    Edit as EditIcon,
    ReceiptLong as ReceiptIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    Payment as PaymentIcon
} from '@mui/icons-material';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import { getSocket } from '../services/socketService';

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const PaymentsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Estados
    const [payments, setPayments] = useState([]);
    const [schools, setSchools] = useState([]);
    const [filteredPayments, setFilteredPayments] = useState([]);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');

    // Paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Mora Global
    const [globalDailyPenalty, setGlobalDailyPenalty] = useState(10);
    const [openPenaltyEdit, setOpenPenaltyEdit] = useState(false);

    // Diálogo Email
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [attachments, setAttachments] = useState([]);

    // Diálogo Edit Payment
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [editPayment, setEditPayment] = useState({});

    // Boletas
    const [openReceiptsDialog, setOpenReceiptsDialog] = useState(false);
    const [fatherReceipts, setFatherReceipts] = useState([]);
    const [fatherName, setFatherName] = useState('');

    // Zoom/Pan
    const [openImageDialog, setOpenImageDialog] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [zoomScale, setZoomScale] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [pos, setPos] = useState({ x: 0, y: 0 });

    // Boletas no vistas
    const [unreadReceiptsMap, setUnreadReceiptsMap] = useState({});

    // Diálogo Registrar Pago
    const [openRegisterPayDialog, setOpenRegisterPayDialog] = useState(false);
    const [registerPaySelected, setRegisterPaySelected] = useState(null);

    const [registerPaymentData, setRegisterPaymentData] = useState({
        paymentId: null,
        amountPaid: '',
        isFullPayment: false,
        isMultipleMonths: false,
        monthsCount: 1
    });

    // Snackbar
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // ==============================
    // 1) Carga Data (acá se hará el recálculo en el backend)
    // ==============================
    const fetchPayments = async () => {
        try {
            const res = await api.get('/payments');
            const arr = res.data.payments || [];
            setPayments(arr);
            setFilteredPayments(arr);
        } catch (error) {
            console.error("fetchPayments: Error obteniendo pagos:", error);
            setSnackbar({ open: true, message: 'Error al obtener pagos', severity: 'error' });
        }
    };

    const fetchSchools = async () => {
        try {
            const res = await api.get('/schools');
            setSchools(res.data.schools || []);
        } catch (error) {
            console.error("fetchSchools: Error obteniendo colegios:", error);
        }
    };

    const fetchGlobalSettings = async () => {
        try {
            const res = await api.get('/system-settings');
            if (res.data.setting) {
                setGlobalDailyPenalty(res.data.setting.dailyPenalty);
            }
        } catch (err) {
            console.error("fetchGlobalSettings: Error obteniendo settings globales:", err);
        }
    };

    const fetchHasUnreadReceipts = async (fatherId) => {
        try {
            const resp = await api.get(`/parents/${fatherId}/hasUnreadReceipts`);
            return !!resp.data.hasUnread;
        } catch (err) {
            console.error(`fetchHasUnreadReceipts: Error para padreId ${fatherId}:`, err);
            return false;
        }
    };

    useEffect(() => {
        (async () => {
            await fetchPayments();
            await fetchSchools();
            await fetchGlobalSettings();
        })();
    }, []);

    // Cargar info de boletas no vistas
    useEffect(() => {
        const fatherIds = new Set();
        payments.forEach((p) => {
            if (p.User) fatherIds.add(p.User.id);
        });
        fatherIds.forEach(async (fid) => {
            const hasUnread = await fetchHasUnreadReceipts(fid);
            setUnreadReceiptsMap((prev) => ({ ...prev, [fid]: hasUnread }));
        });
    }, [payments]);

    // ==============================
    // 2) Filtros
    // ==============================
    useEffect(() => {
        let temp = [...payments];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            temp = temp.filter((p) => {
                const nm = p.User?.name?.toLowerCase() || '';
                const em = p.User?.email?.toLowerCase() || '';
                return nm.includes(q) || em.includes(q);
            });
        }
        if (statusFilter) {
            temp = temp.filter((p) => (p.finalStatus || '').toUpperCase() === statusFilter);
        }
        if (schoolFilter) {
            temp = temp.filter((p) => p.School && String(p.School.id) === String(schoolFilter));
        }
        setFilteredPayments(temp);
    }, [payments, searchQuery, statusFilter, schoolFilter]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };
    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
    };
    const handleSchoolFilterChange = (e) => {
        setSchoolFilter(e.target.value);
    };

    // Paginación
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // ==============================
    // 3) Editar Mora Global
    // ==============================
    const handleTogglePenaltyEdit = () => {
        setOpenPenaltyEdit(!openPenaltyEdit);
    };
    const handleSaveGlobalPenalty = async () => {
        try {
            await api.put('/system-settings', { dailyPenalty: globalDailyPenalty });
            setSnackbar({
                open: true,
                message: 'Mora global actualizada',
                severity: 'success'
            });
            setOpenPenaltyEdit(false);
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al actualizar mora global', severity: 'error' });
        }
    };

    // ==============================
    // 4) Enviar Correo
    // ==============================
    const handleOpenEmailDialog = (payment) => {
        setSelectedPayment(payment);
        setEmailSubject('');
        setEmailMessage('');
        setAttachments([]);
        setOpenEmailDialog(true);
    };
    const handleCloseEmailDialog = () => {
        setOpenEmailDialog(false);
        setSelectedPayment(null);
        setAttachments([]);
    };
    const handleSendEmail = async () => {
        if (!selectedPayment) return;
        try {
            const formData = new FormData();
            formData.append('subject', emailSubject);
            formData.append('message', emailMessage);
            if (attachments?.length > 0) {
                for (let i = 0; i < attachments.length; i++) {
                    formData.append('attachments', attachments[i]);
                }
            }
            await api.post(`/payments/${selectedPayment.id}/sendEmail`, formData);
            setSnackbar({
                open: true,
                message: 'Correo enviado exitosamente',
                severity: 'success'
            });
            handleCloseEmailDialog();
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al enviar correo', severity: 'error' });
        }
    };

    // ==============================
    // 5) Editar Payment
    // ==============================
    const handleOpenEditDialog = (pay) => {
        setEditPayment({
            id: pay.id,
            status: pay.status,
            nextPaymentDate: pay.nextPaymentDate,
            lastPaymentDate: pay.lastPaymentDate,
            schoolId: pay.School ? pay.School.id : '',
            leftover: pay.leftover,
            accumulatedPenalty: pay.accumulatedPenalty,
            totalDue: pay.totalDue,
            creditBalance: pay.creditBalance,
            montoTotal: pay.montoTotal
        });
        setOpenEditDialog(true);
    };
    const handleCloseEditDialog = () => {
        setOpenEditDialog(false);
        setEditPayment({});
    };
    const handleSaveEdit = async () => {
        try {
            await api.put(`/payments/${editPayment.id}`, {
                status: editPayment.status,
                lastPaymentDate: editPayment.lastPaymentDate || null,
                schoolId: editPayment.schoolId !== '' ? editPayment.schoolId : null
            });
            setSnackbar({
                open: true,
                message: 'Pago actualizado',
                severity: 'success'
            });
            handleCloseEditDialog();
            // Refrescamos la lista
            fetchPayments();
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al actualizar pago', severity: 'error' });
        }
    };

    // ==============================
    // 6) Leyenda de colores
    // ==============================
    const getRowColor = (pay) => {
        const st = (pay.finalStatus || '').toUpperCase();
        if (st === 'PAGADO') {
            return '#bbf7d0'; // verde
        }
        if (st === 'MORA') {
            return '#fca5a5'; // rojo
        }
        return '#fde68a'; // amarillo
    };

    // ==============================
    // 7) Agrupar por colegio
    // ==============================
    const paymentsBySchool = {};
    filteredPayments.forEach((p) => {
        const schName = p.School ? p.School.name : 'Sin colegio';
        if (!paymentsBySchool[schName]) paymentsBySchool[schName] = [];
        paymentsBySchool[schName].push(p);
    });

    // ==============================
    // 8) Ver Boletas
    // ==============================
    const handleShowReceipts = async (pay) => {
        if (!pay.User) return;
        setFatherName(pay.User.name || '');
        const fatherId = pay.User.id;
        try {
            const resp = await api.get(`/parents/${fatherId}/receipts`);
            if (resp.data?.receipts) {
                setFatherReceipts(resp.data.receipts);
            } else {
                setFatherReceipts([]);
            }
            setOpenReceiptsDialog(true);
            setUnreadReceiptsMap((prev) => ({ ...prev, [fatherId]: false }));
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al obtener boletas', severity: 'error' });
        }
    };
    const handleCloseReceiptsDialog = () => {
        setOpenReceiptsDialog(false);
        setFatherReceipts([]);
        setFatherName('');
    };

    // ==============================
    // 9) Zoom/Pan Boleta
    // ==============================
    const handleImageClick = (url) => {
        setSelectedImageUrl(url);
        setZoomScale(1);
        setDragging(false);
        setPos({ x: 0, y: 0 });
        setOpenImageDialog(true);
    };
    const handleCloseImageDialog = () => {
        setOpenImageDialog(false);
        setSelectedImageUrl('');
        setZoomScale(1);
        setPos({ x: 0, y: 0 });
        setDragging(false);
    };
    const handleMouseDown = (e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };
    const handleMouseMove = (e) => {
        if (!dragging) return;
        const containerRect = e.currentTarget.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const imgEl = e.currentTarget.querySelector('img');
        if (!imgEl) return;

        const nW = imgEl.naturalWidth;
        const nH = imgEl.naturalHeight;
        const scaledW = nW * zoomScale;
        const scaledH = nH * zoomScale;

        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;

        if (scaledW <= containerWidth) {
            newX = (containerWidth - scaledW) / 2;
        } else {
            const minX = containerWidth - scaledW;
            if (newX < minX) newX = minX;
            if (newX > 0) newX = 0;
        }
        if (scaledH <= containerHeight) {
            newY = (containerHeight - scaledH) / 2;
        } else {
            const minY = containerHeight - scaledH;
            if (newY < minY) newY = minY;
            if (newY > 0) newY = 0;
        }
        setPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
        setDragging(false);
    };
    const handleWheelZoom = (e) => {
        e.preventDefault();
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        let newS = zoomScale + delta;
        if (newS < 0.3) newS = 0.3;
        if (newS > 4) newS = 4;
        setZoomScale(newS);
    };

    // ==============================
    // 10) Registrar Pago (Modal)
    // ==============================
    const handleOpenRegisterPayDialog = (pay) => {
        setRegisterPaySelected(pay);
        setRegisterPaymentData({
            paymentId: pay.id,
            amountPaid: '',
            isFullPayment: false,
            isMultipleMonths: false,
            monthsCount: 1
        });
        setOpenRegisterPayDialog(true);
    };
    const handleCloseRegisterPayDialog = () => {
        setOpenRegisterPayDialog(false);
        setRegisterPaySelected(null);
        setRegisterPaymentData({
            paymentId: null,
            amountPaid: '',
            isFullPayment: false,
            isMultipleMonths: false,
            monthsCount: 1
        });
    };

    const handleSelectMultipleMonths = (checked) => {
        if (!registerPaySelected) return;
        const newData = { ...registerPaymentData };
        newData.isMultipleMonths = checked;
        if (checked) {
            newData.isFullPayment = false;
            newData.amountPaid = '';
            const months = newData.monthsCount || 1;
            const base = parseFloat(registerPaySelected.montoTotal) || 0;
            const total = base * months;
            newData.amountPaid = total.toFixed(2);
        } else {
            newData.monthsCount = 1;
            newData.amountPaid = '';
        }
        setRegisterPaymentData(newData);
    };

    const handleSelectFullPayment = (checked) => {
        if (!registerPaySelected) return;
        const newData = { ...registerPaymentData };
        newData.isFullPayment = checked;
        if (checked) {
            newData.isMultipleMonths = false;
            const td = parseFloat(registerPaySelected.totalDue) || 0;
            newData.amountPaid = td.toFixed(2);
        } else {
            newData.amountPaid = '';
        }
        setRegisterPaymentData(newData);
    };

    const handleMonthsCountChange = (val) => {
        if (!registerPaySelected) return;
        const months = parseInt(val || '1', 10);
        const newData = { ...registerPaymentData, monthsCount: months };
        const base = parseFloat(registerPaySelected.montoTotal) || 0;
        const total = base * months;
        newData.amountPaid = total.toFixed(2);
        setRegisterPaymentData(newData);
    };

    const handleAmountPaidManual = (val) => {
        const v = val.trim();
        const newData = {
            ...registerPaymentData,
            amountPaid: v,
            isMultipleMonths: false,
            isFullPayment: false,
            monthsCount: 1
        };
        setRegisterPaymentData(newData);
    };

    const handleRegisterPayment = async () => {
        try {
            const { paymentId, amountPaid, isFullPayment, isMultipleMonths, monthsCount } = registerPaymentData;
            await api.post(`/payments/${paymentId}/add-transaction`, {
                amountPaid,
                isFullPayment,
                isMultipleMonths,
                monthsCount
            });
            setSnackbar({ open: true, message: 'Pago registrado exitosamente', severity: 'success' });
            handleCloseRegisterPayDialog();
            // Refrescamos la data
            fetchPayments();
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al registrar pago', severity: 'error' });
        }
    };

    // ==============================
    // 11) Socket => boletas
    // ==============================
    useEffect(() => {
        const socket = getSocket();
        if (!socket) {
            return;
        }
        socket.on('receipt-uploaded', ({ fatherId }) => {
            setUnreadReceiptsMap(prev => ({ ...prev, [fatherId]: true }));
        });
        return () => {
            socket.off('receipt-uploaded');
        };
    }, []);

    return (
        <Container>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <Typography variant="h4" gutterBottom>
                    Gestión de Pagos
                </Typography>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div
                        style={{
                            background: '#fff',
                            padding: '16px',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            maxWidth: '300px'
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Estados
                        </Typography>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#bbf7d0', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Pagado
                                </Typography>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#fde68a', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Pago Pendiente
                                </Typography>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 14, height: 14, backgroundColor: '#fca5a5', borderRadius: '50%' }} />
                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                    Mora
                                </Typography>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!openPenaltyEdit ? (
                            <>
                                <Typography sx={{ fontWeight: 'bold' }}>
                                    Mora Global: Q {globalDailyPenalty}
                                </Typography>
                                <Button variant="outlined" onClick={handleTogglePenaltyEdit}>
                                    EDITAR MORA
                                </Button>
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <TextField
                                    label="Mora Global (Q)"
                                    variant="outlined"
                                    size="small"
                                    value={globalDailyPenalty}
                                    onChange={(e) => {
                                        setGlobalDailyPenalty(e.target.value);
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button variant="contained" onClick={handleSaveGlobalPenalty}>
                                        Guardar
                                    </Button>
                                    <Button variant="outlined" onClick={handleTogglePenaltyEdit}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <TextField
                    label="Buscar por nombre o email"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '220px' }}
                />
                <FormControl variant="outlined" size="small" style={{ width: '150px' }}>
                    <InputLabel>Estado</InputLabel>
                    <Select label="Estado" value={statusFilter} onChange={handleStatusFilterChange}>
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="PAGADO">Pagado</MenuItem>
                        <MenuItem value="PENDIENTE">Pago Pendiente</MenuItem>
                        <MenuItem value="MORA">Mora</MenuItem>
                    </Select>
                </FormControl>
                <FormControl variant="outlined" size="small" style={{ width: '200px' }}>
                    <InputLabel>Colegio</InputLabel>
                    <Select label="Colegio" value={schoolFilter} onChange={handleSchoolFilterChange}>
                        <MenuItem value="">Todos</MenuItem>
                        {schools.map((sch) => (
                            <MenuItem key={sch.id} value={sch.id}>
                                {sch.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </div>

            {/* Secciones por colegio */}
            {Object.keys(paymentsBySchool).map((schoolName) => {
                const payArr = paymentsBySchool[schoolName];
                return (
                    <div key={schoolName} style={{ marginBottom: '40px' }}>
                        <Typography variant="h5" style={{ marginBottom: '16px' }}>
                            {schoolName}
                        </Typography>
                        <Paper>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Padre (Usuario)</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell>Próximo Pago</TableCell>
                                            <TableCell>Último Pago</TableCell>
                                            <TableCell>Monto Total</TableCell>
                                            <TableCell>Saldo</TableCell>
                                            <TableCell>Multa Acum.</TableCell>
                                            <TableCell>Total a Pagar</TableCell>
                                            <TableCell>Crédito Extra</TableCell>
                                            <TableCell>Usuario Activo</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {payArr
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((payment) => {
                                                const fatherId = payment.User?.id;
                                                const hasUnread = fatherId ? unreadReceiptsMap[fatherId] === true : false;

                                                const mt = parseFloat(payment.montoTotal) || 0;
                                                const lo = parseFloat(payment.leftover) || 0;
                                                const pen = parseFloat(payment.accumulatedPenalty) || 0;
                                                const td = parseFloat(payment.totalDue) || 0;
                                                const cb = parseFloat(payment.creditBalance) || 0;

                                                return (
                                                    <TableRow
                                                        key={payment.id}
                                                        style={{ backgroundColor: getRowColor(payment) }}
                                                    >
                                                        <TableCell>{payment.User?.name}</TableCell>
                                                        <TableCell>{payment.User?.email}</TableCell>
                                                        <TableCell>{payment.finalStatus}</TableCell>
                                                        <TableCell>
                                                            {payment.nextPaymentDate
                                                                ? moment(payment.nextPaymentDate).format('DD/MM/YYYY')
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {payment.lastPaymentDate
                                                                ? moment(payment.lastPaymentDate).format('DD/MM/YYYY')
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>Q {mt.toFixed(2)}</TableCell>
                                                        <TableCell>Q {lo.toFixed(2)}</TableCell>
                                                        <TableCell>Q {pen.toFixed(2)}</TableCell>
                                                        <TableCell>Q {td.toFixed(2)}</TableCell>
                                                        <TableCell>Q {cb.toFixed(2)}</TableCell>
                                                        <TableCell>{payment.User?.state === 1 ? 'Sí' : 'No'}</TableCell>
                                                        <TableCell align="center">
                                                            <IconButton title="Enviar Correo" onClick={() => handleOpenEmailDialog(payment)}>
                                                                <SendIcon />
                                                            </IconButton>
                                                            <IconButton title="Editar" onClick={() => handleOpenEditDialog(payment)}>
                                                                <EditIcon />
                                                            </IconButton>
                                                            <IconButton title="Ver Boletas" onClick={() => handleShowReceipts(payment)}>
                                                                <Badge color="primary" variant="dot" overlap="circular" invisible={!hasUnread}>
                                                                    <ReceiptIcon />
                                                                </Badge>
                                                            </IconButton>
                                                            <IconButton title="Registrar Pago" onClick={() => handleOpenRegisterPayDialog(payment)}>
                                                                <PaymentIcon />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={payArr.length}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                rowsPerPageOptions={[5, 10, 25]}
                                labelRowsPerPage="Filas por página"
                            />
                        </Paper>
                    </div>
                );
            })}

            {/* Dialog Email */}
            <Dialog open={openEmailDialog} onClose={handleCloseEmailDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Correo al Padre</DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="Asunto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Mensaje"
                        type="text"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                    />
                    <Button variant="outlined" component="label" sx={{ mt: 2 }}>
                        Adjuntar Archivos
                        <input
                            type="file"
                            multiple
                            hidden
                            onChange={(e) => {
                                setAttachments(e.target.files);
                            }}
                        />
                    </Button>
                    {attachments?.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {Array.from(attachments).map((f) => f.name).join(', ')}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEmailDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSendEmail}>
                        Enviar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Editar Pago */}
            <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Editar Pago</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Estado (interno)</InputLabel>
                        <Select
                            label="Estado"
                            value={editPayment.status || ''}
                            onChange={(e) => {
                                setEditPayment({ ...editPayment, status: e.target.value });
                            }}
                        >
                            <MenuItem value="PENDIENTE">Pendiente</MenuItem>
                            <MenuItem value="EN_PROCESO">En Proceso</MenuItem>
                            <MenuItem value="CONFIRMADO">Confirmado</MenuItem>
                            <MenuItem value="VENCIDO">Vencido</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        label="Monto Total"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.montoTotal || 0}
                        disabled
                    />
                    <TextField
                        label="Saldo"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.leftover || 0}
                        disabled
                    />
                    <TextField
                        label="Multa Acumulada"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.accumulatedPenalty || 0}
                        disabled
                    />
                    <TextField
                        label="Total a Pagar"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.totalDue || 0}
                        disabled
                    />
                    <TextField
                        label="Crédito Extra"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.creditBalance || 0}
                        disabled
                    />
                    <TextField
                        label="Próximo Pago"
                        margin="dense"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={editPayment.nextPaymentDate ? moment(editPayment.nextPaymentDate).format('YYYY-MM-DD') : ''}
                        disabled
                    />
                    <TextField
                        label="Último Pago"
                        margin="dense"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={editPayment.lastPaymentDate ? moment(editPayment.lastPaymentDate).format('YYYY-MM-DD') : ''}
                        onChange={(e) => {
                            setEditPayment({ ...editPayment, lastPaymentDate: e.target.value });
                        }}
                    />
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            label="Colegio"
                            value={editPayment.schoolId || ''}
                            onChange={(e) => {
                                setEditPayment({ ...editPayment, schoolId: e.target.value });
                            }}
                        >
                            <MenuItem value="">
                                <em>Ninguno</em>
                            </MenuItem>
                            {schools.map((sch) => (
                                <MenuItem key={sch.id} value={sch.id}>
                                    {sch.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveEdit}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Boletas */}
            <Dialog open={openReceiptsDialog} onClose={handleCloseReceiptsDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Boletas de Pago de {fatherName}</DialogTitle>
                <DialogContent dividers style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {fatherReceipts.length === 0 ? (
                        <Typography>No hay boletas.</Typography>
                    ) : (
                        fatherReceipts.map((rcpt) => (
                            <div key={rcpt.id} style={{ marginBottom: '16px' }}>
                                <Typography variant="body1">
                                    Subida el: {moment(rcpt.uploadedAt).format('DD/MM/YYYY HH:mm')}
                                </Typography>
                                <img
                                    src={rcpt.fileUrl}
                                    alt="Boleta"
                                    style={{
                                        maxWidth: '100%',
                                        marginTop: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleImageClick(rcpt.fileUrl)}
                                />
                            </div>
                        ))
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseReceiptsDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Zoom/Pan Boleta */}
            <Dialog open={openImageDialog} onClose={handleCloseImageDialog} maxWidth="xl" fullWidth>
                <DialogTitle>Vista de la Boleta</DialogTitle>
                <DialogContent
                    dividers
                    style={{ width: '100%', height: '600px', position: 'relative', overflow: 'hidden' }}
                    onWheel={handleWheelZoom}
                >
                    {selectedImageUrl ? (
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: dragging ? 'grabbing' : 'grab'
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <img
                                src={selectedImageUrl}
                                alt="BoletaZoom"
                                style={{
                                    position: 'absolute',
                                    left: `${pos.x}px`,
                                    top: `${pos.y}px`,
                                    transform: `scale(${zoomScale})`,
                                    transformOrigin: 'top left',
                                    maxWidth: 'none',
                                    maxHeight: 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <Typography>No se cargó la boleta</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <IconButton onClick={() => setZoomScale((z) => Math.max(0.3, z - 0.1))} title="Zoom Out">
                        <ZoomOutIcon />
                    </IconButton>
                    <IconButton onClick={() => setZoomScale((z) => Math.min(4, z + 0.1))} title="Zoom In">
                        <ZoomInIcon />
                    </IconButton>
                    <Button onClick={handleCloseImageDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Registrar Pago */}
            <Dialog open={openRegisterPayDialog} onClose={handleCloseRegisterPayDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogContent>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={registerPaymentData.isMultipleMonths}
                                onChange={(e) => handleSelectMultipleMonths(e.target.checked)}
                                disabled={
                                    !registerPaymentData.isMultipleMonths &&
                                    (registerPaymentData.isFullPayment ||
                                        (registerPaymentData.amountPaid && parseFloat(registerPaymentData.amountPaid) > 0))
                                }
                            />
                        }
                        label="Más de un mes"
                    />
                    {registerPaymentData.isMultipleMonths && (
                        <TextField
                            label="Cantidad de meses"
                            margin="dense"
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={registerPaymentData.monthsCount}
                            onChange={(e) => handleMonthsCountChange(e.target.value)}
                        />
                    )}

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={registerPaymentData.isFullPayment}
                                onChange={(e) => handleSelectFullPayment(e.target.checked)}
                                disabled={
                                    !registerPaymentData.isFullPayment &&
                                    (registerPaymentData.isMultipleMonths ||
                                        (registerPaymentData.amountPaid && parseFloat(registerPaymentData.amountPaid) > 0))
                                }
                            />
                        }
                        label="Pago Completo"
                    />

                    <TextField
                        label="Monto Pagado (Q)"
                        margin="dense"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={registerPaymentData.amountPaid}
                        onChange={(e) => handleAmountPaidManual(e.target.value)}
                        disabled={registerPaymentData.isMultipleMonths || registerPaymentData.isFullPayment}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRegisterPayDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleRegisterPayment}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default React.memo(PaymentsManagementPage);
