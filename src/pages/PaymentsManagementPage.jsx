// src/pages/PaymentsManagementPage.jsx

import React, { useEffect, useState, useContext } from 'react';
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

import { Send as SendIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const PaymentsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Listado de pagos
    const [payments, setPayments] = useState([]);
    const [filteredPayments, setFilteredPayments] = useState([]);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Para enviar correo
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    // const [file, setFile] = useState(null); // si deseas enviar adjunto

    // Notificaciones
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // ============================
    // 1) Cargar Pagos
    // ============================
    const fetchPayments = async () => {
        try {
            const res = await api.get('/payments', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setPayments(res.data.payments || []);
            setFilteredPayments(res.data.payments || []);
        } catch (error) {
            console.error('Error al obtener pagos:', error);
            setSnackbar({ open: true, message: 'Error al obtener pagos', severity: 'error' });
        }
    };

    useEffect(() => {
        fetchPayments();
        // eslint-disable-next-line
    }, []);

    // ============================
    // 2) Filtros (búsqueda / status)
    // ============================
    useEffect(() => {
        let temp = [...payments];

        // Filtro por búsqueda (nombre del padre, email)
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            temp = temp.filter((pay) => {
                const userName = pay.User?.name?.toLowerCase() || '';
                const userEmail = pay.User?.email?.toLowerCase() || '';
                return userName.includes(query) || userEmail.includes(query);
            });
        }

        // Filtro por status
        if (statusFilter !== '') {
            temp = temp.filter((pay) => pay.status === statusFilter);
        }

        setFilteredPayments(temp);
    }, [payments, searchQuery, statusFilter]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
    };

    // ============================
    // 3) Paginación
    // ============================
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // ============================
    // 4) Dialog Enviar Correo
    // ============================
    const handleOpenEmailDialog = (payment) => {
        setSelectedPayment(payment);
        setEmailSubject('');
        setEmailMessage('');
        // setFile(null);
        setOpenEmailDialog(true);
    };

    const handleCloseEmailDialog = () => {
        setOpenEmailDialog(false);
        setSelectedPayment(null);
    };

    const handleSendEmail = async () => {
        if (!selectedPayment) return;
        try {
            // Ejemplo sin adjunto:
            await api.post(
                `/payments/${selectedPayment.id}/sendEmail`,
                {
                    subject: emailSubject,
                    message: emailMessage
                },
                { headers: { Authorization: `Bearer ${auth.token}` } }
            );

            // Si quisieras mandar adjunto con form-data y multer:
            // const formData = new FormData();
            // formData.append('subject', emailSubject);
            // formData.append('message', emailMessage);
            // if (file) formData.append('file', file);
            // await api.post(`/payments/${selectedPayment.id}/sendEmail`, formData, {
            //   headers: {
            //     Authorization: `Bearer ${auth.token}`,
            //     'Content-Type': 'multipart/form-data'
            //   }
            // });

            setSnackbar({ open: true, message: 'Correo enviado exitosamente', severity: 'success' });
            handleCloseEmailDialog();
        } catch (error) {
            console.error('Error al enviar correo:', error);
            setSnackbar({ open: true, message: 'Error al enviar correo', severity: 'error' });
        }
    };

    // ============================
    // 5) Actualizar estado (confirmar pago, etc.)
    // ============================
    const handleUpdateStatus = async (payment, newStatus) => {
        try {
            await api.put(
                `/payments/${payment.id}`,
                { status: newStatus, lastPaymentDate: new Date() },
                { headers: { Authorization: `Bearer ${auth.token}` } }
            );
            setSnackbar({ open: true, message: 'Estado actualizado', severity: 'success' });
            fetchPayments(); // recargar la tabla
        } catch (error) {
            console.error('Error al actualizar estado:', error);
            setSnackbar({ open: true, message: 'Error al actualizar estado', severity: 'error' });
        }
    };

    // ============================
    // Helper para color de fila
    // ============================
    const getRowColor = (payment) => {
        // Lógica de color:
        // - "VENCIDO": fondo rojo
        // - "EN_PROCESO" o "PENDIENTE": amarillo
        // - "CONFIRMADO": verde
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

    // Render
    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                Gestión de Pagos
            </Typography>

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
                                                ? new Date(payment.nextPaymentDate).toLocaleDateString()
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {payment.lastPaymentDate
                                                ? new Date(payment.lastPaymentDate).toLocaleDateString()
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
                                            {/* Ejemplo de cambio rápido de estado */}
                                            {payment.status !== 'CONFIRMADO' && (
                                                <Button
                                                    variant="outlined"
                                                    color="success"
                                                    onClick={() => handleUpdateStatus(payment, 'CONFIRMADO')}
                                                    style={{ marginLeft: '10px' }}
                                                >
                                                    Confirmar
                                                </Button>
                                            )}
                                            {payment.status !== 'VENCIDO' && (
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => handleUpdateStatus(payment, 'VENCIDO')}
                                                    style={{ marginLeft: '10px' }}
                                                >
                                                    Marcar Vencido
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            }
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
                    {/* Si deseas adjunto:
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginTop: '10px' }}
          />
          */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEmailDialog}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSendEmail}>
                        Enviar
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
