// Comando para instalar moment.js
// npm install moment

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
    FormControl
} from '@mui/material';

import { Send as SendIcon, Edit as EditIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const PaymentsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Listado completo
    const [payments, setPayments] = useState([]);
    const [filteredPayments, setFilteredPayments] = useState([]);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dialog de enviar correo
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [attachments, setAttachments] = useState([]); // Para adjuntar archivos

    // Dialog de editar Payment
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [editPayment, setEditPayment] = useState({
        id: null,
        status: '',
        amount: '',
        nextPaymentDate: '',
        lastPaymentDate: ''
    });

    // Notificaciones
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // ============================
    // 1) Cargar Pagos y actualizar estados vencidos
    // ============================
    const fetchPayments = async () => {
        try {
            const res = await api.get('/payments', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            let fetchedPayments = res.data.payments || [];

            // Obtener la fecha actual (sin hora)
            const today = moment().startOf('day');

            // Array para almacenar las promesas de actualización
            const updatePromises = [];

            // Iterar sobre los pagos para actualizar el estado si es necesario
            fetchedPayments.forEach((payment) => {
                const nextPaymentDate = payment.nextPaymentDate
                    ? moment(payment.nextPaymentDate, 'YYYY-MM-DD').startOf('day')
                    : null;

                if (
                    nextPaymentDate &&
                    nextPaymentDate.isBefore(today) &&
                    payment.status !== 'VENCIDO'
                ) {
                    // Actualizar el estado a 'VENCIDO'
                    const updatePromise = api
                        .put(
                            `/payments/${payment.id}`,
                            { status: 'VENCIDO' },
                            { headers: { Authorization: `Bearer ${auth.token}` } }
                        )
                        .then(() => {
                            payment.status = 'VENCIDO';
                        })
                        .catch((error) => {
                            console.error(`Error al actualizar el pago ID ${payment.id}:`, error);
                        });

                    updatePromises.push(updatePromise);
                }
            });

            // Esperar a que todas las actualizaciones se completen
            await Promise.all(updatePromises);

            setPayments(fetchedPayments);
            setFilteredPayments(fetchedPayments);
        } catch (error) {
            console.error('Error al obtener pagos:', error);
            setSnackbar({
                open: true,
                message: 'Error al obtener pagos',
                severity: 'error'
            });
        }
    };

    useEffect(() => {
        fetchPayments();
        // eslint-disable-next-line
    }, []);

    // ============================
    // 2) Filtros
    // ============================
    useEffect(() => {
        let temp = [...payments];
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            temp = temp.filter((p) => {
                const userName = p.User?.name?.toLowerCase() || '';
                const userEmail = p.User?.email?.toLowerCase() || '';
                return userName.includes(query) || userEmail.includes(query);
            });
        }
        if (statusFilter !== '') {
            temp = temp.filter((p) => p.status === statusFilter);
        }
        setFilteredPayments(temp);
    }, [payments, searchQuery, statusFilter]);

    const handleSearchChange = (e) => setSearchQuery(e.target.value);
    const handleStatusFilterChange = (e) => setStatusFilter(e.target.value);

    // ============================
    // 3) Paginación
    // ============================
    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // ============================
    // 4) Enviar Correo
    // ============================
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
            // Usamos FormData para adjuntar archivos
            const formData = new FormData();
            formData.append('subject', emailSubject);
            formData.append('message', emailMessage);

            if (attachments && attachments.length > 0) {
                for (let i = 0; i < attachments.length; i++) {
                    formData.append('attachments', attachments[i]);
                }
            }

            await api.post(
                `/payments/${selectedPayment.id}/sendEmail`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

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

    // ============================
    // 5) Editar Payment
    // ============================
    const handleOpenEditDialog = (payment) => {
        setEditPayment({
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            // Al abrir el diálogo, mostramos la fecha sin conversión que cause shift
            nextPaymentDate: payment.nextPaymentDate || '',
            lastPaymentDate: payment.lastPaymentDate || ''
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
            lastPaymentDate: ''
        });
    };

    const handleSaveEdit = async () => {
        try {
            // Enviamos las fechas tal cual en formato YYYY-MM-DD
            // (sin convertir a Date para evitar cambios de día por zonas horarias)
            await api.put(
                `/payments/${editPayment.id}`,
                {
                    status: editPayment.status,
                    amount: editPayment.amount,
                    nextPaymentDate: editPayment.nextPaymentDate || null,
                    lastPaymentDate: editPayment.lastPaymentDate || null
                },
                { headers: { Authorization: `Bearer ${auth.token}` } }
            );

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

    // ============================
    // 6) Helper para color de fila (Tabla)
    // ============================
    const getRowColor = (payment) => {
        switch (payment.status) {
            case 'VENCIDO':
                return '#fca5a5'; // rojo claro
            case 'EN_PROCESO':
            case 'PENDIENTE':
                return '#fde68a'; // amarillo claro
            case 'CONFIRMADO':
                return '#bbf7d0'; // verde claro
            default:
                return '#fff';
        }
    };

    // ============================
    // Render principal
    // ============================
    return (
        <Container>
            {/* Encabezado y leyenda en la misma fila, con la leyenda a la derecha */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px'
                }}
            >
                <Typography variant="h4" gutterBottom>
                    Gestión de Pagos
                </Typography>

                {/* LEYENDA DE COLORES a la derecha */}
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

                    {/* Cada estado con un círculo y texto */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: '#bbf7d0'
                                }}
                            />
                            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                Confirmado
                            </Typography>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: '#fde68a'
                                }}
                            />
                            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                Pendiente / En Proceso
                            </Typography>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: '#fca5a5'
                                }}
                            />
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
                    style={{ width: '300px' }}
                />
                <FormControl variant="outlined" size="small" style={{ width: '200px' }}>
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
            </div>

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
                            {filteredPayments
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((payment) => (
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
                                                ? moment(payment.nextPaymentDate, 'YYYY-MM-DD').format(
                                                    'DD/MM/YYYY'
                                                )
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {payment.lastPaymentDate
                                                ? moment(payment.lastPaymentDate, 'YYYY-MM-DD').format(
                                                    'DD/MM/YYYY'
                                                )
                                                : '—'}
                                        </TableCell>
                                        <TableCell>Q {payment.amount}</TableCell>
                                        <TableCell align="center">
                                            {/* Botón para enviar correo */}
                                            <IconButton
                                                onClick={() => handleOpenEmailDialog(payment)}
                                                title="Enviar correo"
                                                color="primary"
                                            >
                                                <SendIcon />
                                            </IconButton>

                                            {/* Botón para editar */}
                                            <IconButton
                                                onClick={() => handleOpenEditDialog(payment)}
                                                title="Editar"
                                                color="secondary"
                                            >
                                                <EditIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            {filteredPayments.length === 0 && (
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
                    count={filteredPayments.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                    labelRowsPerPage="Filas por página"
                />
            </Paper>

            {/* Dialog para enviar correo */}
            <Dialog
                open={openEmailDialog}
                onClose={handleCloseEmailDialog}
                maxWidth="sm"
                fullWidth
            >
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
                    {attachments && attachments.length > 0 && (
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

            {/* Dialog para editar Payment */}
            <Dialog
                open={openEditDialog}
                onClose={handleCloseEditDialog}
                maxWidth="sm"
                fullWidth
            >
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
                        // Un poco de padding lateral
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                    />
                    <TextField
                        margin="dense"
                        label="Próximo Pago"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={editPayment.nextPaymentDate}
                        onChange={(e) =>
                            setEditPayment({ ...editPayment, nextPaymentDate: e.target.value })
                        }
                        // Un poco de padding lateral
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                    />
                    <TextField
                        margin="dense"
                        label="Último Pago"
                        type="date"
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        value={editPayment.lastPaymentDate}
                        onChange={(e) =>
                            setEditPayment({ ...editPayment, lastPaymentDate: e.target.value })
                        }
                        // Un poco de padding lateral
                        style={{ paddingLeft: '8px', paddingRight: '8px' }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveEdit}>
                        Guardar
                    </Button>
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
