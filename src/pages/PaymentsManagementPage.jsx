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

    // Listado de pagos
    const [payments, setPayments] = useState([]);
    // Listado de colegios
    const [schools, setSchools] = useState([]);

    // Filtrado
    const [filteredPayments, setFilteredPayments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');

    // Paginación
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dialog de enviar correo
    const [openEmailDialog, setOpenEmailDialog] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [attachments, setAttachments] = useState([]);

    // Dialog de editar Payment
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

    // ============================
    // 1) Cargar Pagos y Colegios
    // ============================
    const fetchPayments = async () => {
        try {
            const res = await api.get('/payments', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            let fetchedPayments = res.data.payments || [];
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

    const fetchSchools = async () => {
        try {
            const res = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSchools(res.data.schools || []);
        } catch (error) {
            console.error('Error al obtener colegios:', error);
        }
    };

    useEffect(() => {
        fetchPayments();
        fetchSchools();
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
            await api.put(
                `/payments/${editPayment.id}`,
                {
                    status: editPayment.status,
                    lastPaymentDate: editPayment.lastPaymentDate || null,
                    schoolId: editPayment.schoolId !== '' ? editPayment.schoolId : null
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

    // ============================
    // 7) Agrupar por colegio
    // ============================
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

    // ============================
    // Render principal
    // ============================
    return (
        <Container>
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

                {/* Leyenda de Colores */}
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
                                                </TableCell>
                                            </TableRow>
                                        ))}
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

            {/* Dialog de enviar correo */}
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
