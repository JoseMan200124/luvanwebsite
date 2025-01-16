// src/pages/PaymentsManagementPage.jsx

import React, { useEffect, useState, useContext, useRef } from 'react';
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
    Badge
} from '@mui/material';
import {
    Send as SendIcon,
    Edit as EditIcon,
    ReceiptLong as ReceiptIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon
} from '@mui/icons-material';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import { getSocket } from '../services/socketService';

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const PaymentsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // ==============================
    // ESTADOS
    // ==============================
    const [payments, setPayments] = useState([]);
    const [schools, setSchools] = useState([]);
    const [filteredPayments, setFilteredPayments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Diálogo de enviar correo
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [attachments, setAttachments] = useState([]);

    // Diálogo de editar Payment
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [editPayment, setEditPayment] = useState({
        id: null,
        status: '',
        amount: '',
        nextPaymentDate: '',
        lastPaymentDate: '',
        schoolId: ''
    });

    // Snackbar
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Diálogo para boletas
    const [openReceiptsDialog, setOpenReceiptsDialog] = useState(false);
    const [fatherReceipts, setFatherReceipts] = useState([]);
    const [fatherName, setFatherName] = useState('');

    // Zoom
    const [openImageDialog, setOpenImageDialog] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [zoomScale, setZoomScale] = useState(1);

    // Panning
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [pos, setPos] = useState({ x: 0, y: 0 });

    // Mapa fatherId => boolean (indica si hay boletas sin ver)
    const [unreadReceiptsMap, setUnreadReceiptsMap] = useState({});

    const imageContainerRef = useRef(null);

    // ==============================
    // 1) Funciones para cargar data
    // ==============================
    const fetchPayments = async () => {
        try {
            const res = await api.get('/payments');
            const fetched = res.data.payments || [];
            setPayments(fetched);
            setFilteredPayments(fetched);
        } catch (error) {
            console.error('Error al obtener pagos:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener pagos',
                severity: 'error'
            });
        }
    };

    const fetchSchools = async () => {
        try {
            const res = await api.get('/schools');
            setSchools(res.data.schools || []);
        } catch (error) {
            console.error('Error al obtener colegios:', error);
        }
    };

    // Endpoint para saber si un padre tiene boletas sin ver
    const fetchHasUnreadReceipts = async (fatherId) => {
        try {
            const res = await api.get(`/parents/${fatherId}/hasUnreadReceipts`);
            return !!res.data.hasUnread; // boolean
        } catch (err) {
            console.error('Error fetchHasUnreadReceipts:', err);
            return false;
        }
    };

    // ==============================
    // 2) useEffect => cargar data al montar
    // ==============================
    useEffect(() => {
        // Cargamos payments y schools
        (async () => {
            await fetchPayments();
            await fetchSchools();
        })();
    }, []);

    // ==============================
    // 3) Cuando cambie `payments`,
    //    consultamos boletas no vistas
    // ==============================
    useEffect(() => {
        // Tomamos fatherIds a partir de payments
        const fatherIds = new Set();
        payments.forEach((p) => {
            if (p.User) {
                fatherIds.add(p.User.id);
            }
        });

        // Para cada father => consultamos
        fatherIds.forEach(async (fid) => {
            const hasUnread = await fetchHasUnreadReceipts(fid);
            setUnreadReceiptsMap((prev) => ({ ...prev, [fid]: hasUnread }));
        });
    }, [payments]);

    // ==============================
    // 4) Filtros
    // ==============================
    useEffect(() => {
        let temp = [...payments];
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            temp = temp.filter((p) => {
                const userName = p.User?.name?.toLowerCase() || '';
                const userEmail = p.User?.email?.toLowerCase() || '';
                return userName.includes(q) || userEmail.includes(q);
            });
        }
        if (statusFilter !== '') {
            temp = temp.filter((p) => p.status === statusFilter);
        }
        if (schoolFilter !== '') {
            temp = temp.filter(
                (p) => p.School && String(p.School.id) === String(schoolFilter)
            );
        }
        setFilteredPayments(temp);
    }, [payments, searchQuery, statusFilter, schoolFilter]);

    const handleSearchChange = (e) => setSearchQuery(e.target.value);
    const handleStatusFilterChange = (e) => setStatusFilter(e.target.value);
    const handleSchoolFilterChange = (e) => setSchoolFilter(e.target.value);

    // ==============================
    // 5) Paginación
    // ==============================
    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // ==============================
    // 6) Enviar correo
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
        } catch (error) {
            console.error('Error al enviar correo:', error);
            setSnackbar({
                open: true,
                message: 'Error al enviar correo',
                severity: 'error'
            });
        }
    };

    // ==============================
    // 7) Editar Payment
    // ==============================
    const handleOpenEditDialog = (payment) => {
        setEditPayment({
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            nextPaymentDate: payment.nextPaymentDate || '',
            lastPaymentDate: payment.lastPaymentDate || '',
            schoolId: payment.School ? payment.School.id : ''
        });
        setOpenEditDialog(true);
    };
    const handleCloseEditDialog = () => {
        setOpenEditDialog(false);
        setEditPayment({
            id: null,
            status: '',
            amount: '',
            nextPaymentDate: '',
            lastPaymentDate: '',
            schoolId: ''
        });
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
                message: 'Pago actualizado exitosamente',
                severity: 'success'
            });
            handleCloseEditDialog();
            fetchPayments();
        } catch (error) {
            console.error('Error al actualizar pago:', error);
            setSnackbar({
                open: true,
                message: 'Error al actualizar pago',
                severity: 'error'
            });
        }
    };

    // ==============================
    // 8) Color de fila
    // ==============================
    const getRowColor = (payment) => {
        switch (payment.status) {
            case 'VENCIDO':
                return '#fca5a5';
            case 'EN_PROCESO':
            case 'PENDIENTE':
                return '#fde68a';
            case 'CONFIRMADO':
                return '#bbf7d0';
            default:
                return '#fff';
        }
    };

    // ==============================
    // 9) Agrupar por colegio
    // ==============================
    const paymentsBySchool = {};
    filteredPayments.forEach((p) => {
        const schoolName = p.School ? p.School.name : 'Sin colegio';
        if (!paymentsBySchool[schoolName]) paymentsBySchool[schoolName] = [];
        paymentsBySchool[schoolName].push(p);
    });
    const schoolSections = Object.keys(paymentsBySchool).map((schoolName) => ({
        schoolName,
        payments: paymentsBySchool[schoolName]
    }));

    // ==============================
    // 10) Manejo de boletas
    // ==============================
    const handleShowReceipts = async (payment) => {
        try {
            if (!payment.User) return;
            setFatherName(payment.User.name || '');

            const fatherId = payment.User.id;
            // Obtenemos boletas completas
            const res = await api.get(`/parents/${fatherId}/receipts`);
            if (res.data?.receipts) {
                setFatherReceipts(res.data.receipts);
            } else {
                setFatherReceipts([]);
            }

            setOpenReceiptsDialog(true);

            // Marcamos en DB => isViewed=true
            // Quitar el punto azul
            setUnreadReceiptsMap((prev) => ({
                ...prev,
                [fatherId]: false
            }));
        } catch (error) {
            console.error('Error al obtener boletas:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener boletas de pago',
                severity: 'error'
            });
        }
    };
    const handleCloseReceiptsDialog = () => {
        setOpenReceiptsDialog(false);
        setFatherReceipts([]);
        setFatherName('');
    };

    // ==============================
    // 11) Zoom + Arrastre
    // ==============================
    const handleImageClick = (imageUrl) => {
        setSelectedImageUrl(imageUrl);
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
    const handleZoomIn = () => {
        setZoomScale((prev) => prev + 0.2);
    };
    const handleZoomOut = () => {
        setZoomScale((prev) => (prev > 0.4 ? prev - 0.2 : prev));
    };
    const onMouseDown = (e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };
    const onMouseMove = (e) => {
        if (!dragging) return;
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => {
        setDragging(false);
    };

    // ==============================
    // 12) Socket: actualiza punto azul
    // ==============================
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        socket.on('receipt-uploaded', ({ fatherId }) => {
            setUnreadReceiptsMap((prev) => ({
                ...prev,
                [fatherId]: true
            }));
        });

        return () => {
            socket.off('receipt-uploaded');
        };
    }, []);

    // ==============================
    // RENDER
    // ==============================
    return (
        <Container>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <Typography variant="h4" gutterBottom>
                    Gestión de Pagos
                </Typography>
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
                        Leyenda de Colores
                    </Typography>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#bbf7d0' }} />
                            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                Confirmado
                            </Typography>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fde68a' }} />
                            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                Pendiente / En Proceso
                            </Typography>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fca5a5' }} />
                            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                Vencido
                            </Typography>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div tw="flex gap-4 mb-4">
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
                    <Select
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                        label="Estado"
                    >
                        <MenuItem value="">Todos</MenuItem>
                        <MenuItem value="PENDIENTE">Pendiente</MenuItem>
                        <MenuItem value="EN_PROCESO">En Proceso</MenuItem>
                        <MenuItem value="CONFIRMADO">Confirmado</MenuItem>
                        <MenuItem value="VENCIDO">Vencido</MenuItem>
                    </Select>
                </FormControl>
                <FormControl variant="outlined" size="small" style={{ width: '200px' }}>
                    <InputLabel>Colegio</InputLabel>
                    <Select
                        value={schoolFilter}
                        onChange={handleSchoolFilterChange}
                        label="Colegio"
                    >
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
            {schoolSections.map((section) => (
                <div key={section.schoolName} style={{ marginBottom: '40px' }}>
                    <Typography variant="h5" style={{ marginBottom: '16px' }}>
                        {section.schoolName}
                    </Typography>
                    <Paper>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Padre (Usuario)</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Próximo Pago</TableCell>
                                        <TableCell>Último Pago</TableCell>
                                        <TableCell>Monto</TableCell>
                                        <TableCell align="center">Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {section.payments
                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        .map((payment) => {
                                            const fatherId = payment.User?.id;
                                            // Mostramos el puntito si fatherId existe y unreadReceiptsMap[fatherId] === true
                                            const hasUnreadBoleta = fatherId
                                                ? unreadReceiptsMap[fatherId] === true
                                                : false;

                                            return (
                                                <TableRow
                                                    key={payment.id}
                                                    style={{ backgroundColor: getRowColor(payment) }}
                                                >
                                                    <TableCell>
                                                        {payment.User ? payment.User.name : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {payment.User ? payment.User.email : '—'}
                                                    </TableCell>
                                                    <TableCell>{payment.status}</TableCell>
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
                                                    <TableCell>
                                                        Q {payment.amount}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton
                                                            onClick={() => handleOpenEmailDialog(payment)}
                                                            title="Enviar correo"
                                                            color="primary"
                                                        >
                                                            <SendIcon />
                                                        </IconButton>
                                                        <IconButton
                                                            onClick={() => handleOpenEditDialog(payment)}
                                                            title="Editar"
                                                            color="secondary"
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                        <IconButton
                                                            onClick={() => handleShowReceipts(payment)}
                                                            title="Ver Boletas"
                                                        >
                                                            <Badge
                                                                color="primary"
                                                                variant="dot"
                                                                overlap="circular"
                                                                invisible={!hasUnreadBoleta}
                                                            >
                                                                <ReceiptIcon />
                                                            </Badge>
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    {section.payments.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                No hay pagos registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={section.payments.length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[5, 10, 25]}
                            labelRowsPerPage="Filas por página"
                        />
                    </Paper>
                </div>
            ))}

            {/* Dialog: Enviar Correo */}
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
                            onChange={(e) => setAttachments(e.target.files)}
                        />
                    </Button>
                    {attachments?.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {Array.from(attachments).map((file) => file.name).join(', ')}
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

            {/* Dialog: Editar Payment */}
            <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Editar Pago</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Estado</InputLabel>
                        <Select
                            value={editPayment.status}
                            onChange={(e) =>
                                setEditPayment({ ...editPayment, status: e.target.value })
                            }
                            label="Estado"
                        >
                            <MenuItem value="PENDIENTE">Pendiente</MenuItem>
                            <MenuItem value="EN_PROCESO">En Proceso</MenuItem>
                            <MenuItem value="CONFIRMADO">Confirmado</MenuItem>
                            <MenuItem value="VENCIDO">Vencido</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        margin="dense"
                        label="Monto"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={editPayment.amount}
                        onChange={(e) =>
                            setEditPayment({ ...editPayment, amount: e.target.value })
                        }
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                        disabled
                    />
                    <TextField
                        margin="dense"
                        label="Próximo Pago"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={
                            editPayment.nextPaymentDate
                                ? moment(editPayment.nextPaymentDate).format('YYYY-MM-DD')
                                : ''
                        }
                        onChange={(e) =>
                            setEditPayment({ ...editPayment, nextPaymentDate: e.target.value })
                        }
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                        disabled
                    />
                    <TextField
                        margin="dense"
                        label="Último Pago"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={
                            editPayment.lastPaymentDate
                                ? moment(editPayment.lastPaymentDate).format('YYYY-MM-DD')
                                : ''
                        }
                        onChange={(e) =>
                            setEditPayment({ ...editPayment, lastPaymentDate: e.target.value })
                        }
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                    />
                    {/* Seleccionar Colegio */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            value={editPayment.schoolId}
                            onChange={(e) =>
                                setEditPayment({ ...editPayment, schoolId: e.target.value })
                            }
                            label="Colegio"
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

            {/* Dialog: Boletas */}
            <Dialog
                open={openReceiptsDialog}
                onClose={handleCloseReceiptsDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Boletas de Pago de {fatherName}</DialogTitle>
                <DialogContent dividers style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {fatherReceipts.length === 0 ? (
                        <Typography>Este padre no tiene boletas de pago.</Typography>
                    ) : (
                        fatherReceipts.map((receipt) => (
                            <div key={receipt.id} style={{ marginBottom: '16px' }}>
                                <Typography variant="body1">
                                    Subida el:{' '}
                                    {moment(receipt.uploadedAt).format('DD/MM/YYYY HH:mm')}
                                </Typography>
                                <img
                                    src={receipt.fileUrl}
                                    alt="Boleta de pago"
                                    style={{
                                        maxWidth: '100%',
                                        marginTop: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleImageClick(receipt.fileUrl)}
                                />
                            </div>
                        ))
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseReceiptsDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog: Zoom + Pan */}
            <Dialog open={openImageDialog} onClose={handleCloseImageDialog} maxWidth="md">
                <DialogTitle>Vista de la Boleta</DialogTitle>
                <DialogContent
                    dividers
                    style={{ width: '100%', height: '70vh', overflow: 'hidden' }}
                >
                    {selectedImageUrl ? (
                        <div
                            ref={imageContainerRef}
                            style={{
                                width: '100%',
                                height: '100%',
                                cursor: dragging ? 'grabbing' : 'grab',
                                position: 'relative'
                            }}
                            onMouseDown={(e) => {
                                setDragging(true);
                                setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
                            }}
                            onMouseMove={(e) => {
                                if (!dragging) return;
                                const newX = e.clientX - dragStart.x;
                                const newY = e.clientY - dragStart.y;
                                setPos({ x: newX, y: newY });
                            }}
                            onMouseUp={() => setDragging(false)}
                            onMouseLeave={() => setDragging(false)}
                        >
                            <img
                                src={selectedImageUrl}
                                alt="Boleta Zoom"
                                style={{
                                    position: 'absolute',
                                    left: `${pos.x}px`,
                                    top: `${pos.y}px`,
                                    transform: `scale(${zoomScale})`,
                                    transformOrigin: 'center center',
                                    transition: dragging ? 'none' : 'transform 0.2s ease',
                                    maxWidth: 'none',
                                    maxHeight: 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <Typography>No se cargó la imagen</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <IconButton onClick={handleZoomOut} title="Zoom Out">
                        <ZoomOutIcon />
                    </IconButton>
                    <IconButton onClick={handleZoomIn} title="Zoom In">
                        <ZoomInIcon />
                    </IconButton>
                    <Button onClick={handleCloseImageDialog}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default PaymentsManagementPage;
