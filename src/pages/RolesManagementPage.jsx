// src/pages/RolesManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    IconButton,
    Tooltip,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
    Grid
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

const RolesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

// Roles con sus IDs reales
const roleOptions = [
    { id: 1, name: 'Gestor' },
    { id: 2, name: 'Administrador' },
    { id: 3, name: 'Padre' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
];

const RolesManagementPage = () => {
    const { auth } = useContext(AuthContext);

    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);

    const [selectedUser, setSelectedUser] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);

    const [familyDetail, setFamilyDetail] = useState({
        motherName: '',
        motherCellphone: '',
        motherEmail: '',
        fatherName: '',
        fatherCellphone: '',
        fatherEmail: '',
        razonSocial: '',
        nit: '',
        mainAddress: '',
        alternativeAddress: '',
        students: [],
        scheduleSlots: []
    });

    // Para añadir un Student (alumno) o un Slot (horario) temporal
    const [newStudent, setNewStudent] = useState({ fullName: '', grade: '' });
    const [newSlot, setNewSlot] = useState({ time: '', note: '' });

    // Manejo de notificaciones
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Búsqueda y paginación
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Loading
    const [loading, setLoading] = useState(false);

    // 1) Obtener usuarios
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            console.log("ESTE ES EL RESPONSE: ", response);
            setUsers(Array.isArray(response.data.users) ? response.data.users : []);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener usuarios:', err);
            setSnackbar({ open: true, message: 'Error al obtener usuarios', severity: 'error' });
            setLoading(false);
        }
    };

    const fetchSchools = async () => {
        try {
            const resp = await api.get('/schools', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSchools(Array.isArray(resp.data.schools) ? resp.data.schools : []);
        } catch (err) {
            console.error('Error al obtener colegios:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchSchools();
    }, [auth.token]);

    const handleEditClick = (user) => {
        setSelectedUser(user);

        if (user.roleId === 3 && user.FamilyDetail) {
            setFamilyDetail({
                motherName: user.FamilyDetail.motherName || '',
                motherCellphone: user.FamilyDetail.motherCellphone || '',
                motherEmail: user.FamilyDetail.motherEmail || '',
                fatherName: user.FamilyDetail.fatherName || '',
                fatherCellphone: user.FamilyDetail.fatherCellphone || '',
                fatherEmail: user.FamilyDetail.fatherEmail || '',
                razonSocial: user.FamilyDetail.razonSocial || '',
                nit: user.FamilyDetail.nit || '',
                mainAddress: user.FamilyDetail.mainAddress || '',
                alternativeAddress: user.FamilyDetail.alternativeAddress || '',
                students: user.FamilyDetail.Students || [],
                scheduleSlots: user.FamilyDetail.ScheduleSlots || []
            });
        } else {
            // De lo contrario limpiamos
            setFamilyDetail({
                motherName: '',
                motherCellphone: '',
                motherEmail: '',
                fatherName: '',
                fatherCellphone: '',
                fatherEmail: '',
                razonSocial: '',
                nit: '',
                mainAddress: '',
                alternativeAddress: '',
                students: [],
                scheduleSlots: []
            });
        }
        setOpenDialog(true);
    };

    // 4) Abrir para crear
    const handleAddUser = () => {
        // Se define un usuario "nuevo"
        setSelectedUser({
            id: null,
            name: '',
            email: '',
            password: '',
            roleId: '',
            school: ''
        });
        // Se limpia el familyDetail
        setFamilyDetail({
            motherName: '',
            motherCellphone: '',
            motherEmail: '',
            fatherName: '',
            fatherCellphone: '',
            fatherEmail: '',
            razonSocial: '',
            nit: '',
            mainAddress: '',
            alternativeAddress: '',
            students: [],
            scheduleSlots: []
        });
        setOpenDialog(true);
    };

    // 5) Cerrar diálogo
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
    };

    // 6) Eliminar usuario
    const handleDeleteClick = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/users/${userId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({ open: true, message: 'Usuario eliminado exitosamente', severity: 'success' });
                fetchUsers();
            } catch (err) {
                console.error('Error al eliminar usuario:', err);
                setSnackbar({ open: true, message: 'Error al eliminar usuario', severity: 'error' });
            }
        }
    };

    // 7) Manejo de inputs en el user
    const handleUserChange = (e) => {
        setSelectedUser({
            ...selectedUser,
            [e.target.name]: e.target.value
        });
    };

    // 8) Cambiar rol
    const handleRoleIdChange = (e) => {
        const newRoleId = parseInt(e.target.value, 10);
        setSelectedUser((prev) => ({
            ...prev,
            roleId: newRoleId
        }));
    };

    // 9) Manejo de familyDetail
    const handleFamilyDetailChange = (e) => {
        setFamilyDetail({
            ...familyDetail,
            [e.target.name]: e.target.value
        });
    };

    // 10) Agregar un Student
    const handleAddStudent = () => {
        if (!newStudent.fullName) return;
        setFamilyDetail((prev) => ({
            ...prev,
            students: [...prev.students, newStudent]
        }));
        setNewStudent({ fullName: '', grade: '' });
    };

    // 11) Agregar un horario
    const handleAddSlot = () => {
        if (!newSlot.time) return;
        setFamilyDetail((prev) => ({
            ...prev,
            scheduleSlots: [...prev.scheduleSlots, newSlot]
        }));
        setNewSlot({ time: '', note: '' });
    };

    // 12) Guardar usuario
    const handleSaveUser = async () => {
        try {
            // Creamos un payload partiendo solo de los campos que SÍ queremos enviar
            let payload = {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email,
                password: selectedUser.password,
                roleId: selectedUser.roleId,
                school: selectedUser.school
            };

            // Si "Padre" => añadir familyDetail
            if (payload.roleId === 3) {
                payload.familyDetail = familyDetail;
            }

            // Log para verificar
            console.log('Payload final que se envía al backend:', payload);

            if (selectedUser.id) {
                // UPDATE
                await api.put(`/users/${selectedUser.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({ open: true, message: 'Usuario actualizado exitosamente', severity: 'success' });
            } else {
                // CREATE
                await api.post('/users', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({ open: true, message: 'Usuario creado exitosamente', severity: 'success' });
            }

            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('Error guardando usuario:', err);
            setSnackbar({ open: true, message: 'Error al guardar usuario', severity: 'error' });
        }
    };

    // 13) Búsqueda
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // 14) Paginación
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // 15) Filtrar usuarios
    const filteredUsers = users.filter((u) =>
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <RolesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Usuarios y Roles
            </Typography>
            <div tw="flex justify-between mb-4">
                <TextField
                    label="Buscar usuarios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    tw="w-1/3"
                />
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={handleAddUser}
                >
                    Añadir Usuario
                </Button>
            </div>

            {loading ? (
                <div tw="flex justify-center p-4">
                    <CircularProgress />
                </div>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>RolId</TableCell>
                                    <TableCell>Colegio</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredUsers
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>{user.roleId}</TableCell>
                                            <TableCell>{user.school}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleEditClick(user)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton onClick={() => handleDeleteClick(user.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                                {filteredUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No se encontraron usuarios.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredUsers.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}

            {/* Diálogo para crear/editar usuario */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedUser?.id ? 'Editar Usuario' : 'Añadir Usuario'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedUser?.id
                            ? 'Actualiza la información del usuario.'
                            : 'Completa la información para crear un nuevo usuario.'}
                    </DialogContentText>

                    {/* Datos principales del usuario */}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                autoFocus
                                name="name"
                                label="Nombre Completo"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.name || ''}
                                onChange={handleUserChange}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                name="email"
                                label="Correo Electrónico"
                                type="email"
                                fullWidth
                                variant="outlined"
                                value={selectedUser?.email || ''}
                                onChange={handleUserChange}
                                required
                                disabled={Boolean(selectedUser?.id)}
                            />
                        </Grid>
                        {!selectedUser?.id && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="password"
                                    label="Contraseña"
                                    type="password"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.password || ''}
                                    onChange={handleUserChange}
                                    required
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                            <FormControl variant="outlined" fullWidth required>
                                <InputLabel>Rol</InputLabel>
                                <Select
                                    name="roleId"
                                    value={selectedUser?.roleId || ''}
                                    onChange={handleRoleIdChange}
                                    label="Rol"
                                >
                                    <MenuItem value="">
                                        <em>Seleccione un rol</em>
                                    </MenuItem>
                                    {roleOptions.map((r) => (
                                        <MenuItem key={r.id} value={r.id}>
                                            {r.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/* Colegio */}
                        <Grid item xs={12} md={6}>
                            <FormControl variant="outlined" fullWidth>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    name="school"
                                    value={selectedUser?.school || ''}
                                    onChange={handleUserChange}
                                    label="Colegio"
                                >
                                    <MenuItem value="">
                                        <em>Seleccione un colegio</em>
                                    </MenuItem>
                                    {schools.map((sch) => (
                                        <MenuItem key={sch.id} value={sch.id}>
                                            {sch.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {selectedUser?.roleId === 3 && (
                        <>
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Datos de la Familia (Padre)
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {/* MADRE */}
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherName"
                                        label="Nombre de la Madre"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherName}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherCellphone"
                                        label="Celular Madre"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherCellphone}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherEmail"
                                        label="Correo Madre"
                                        type="email"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherEmail}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                {/* PADRE */}
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherName"
                                        label="Nombre del Padre"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherName}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherCellphone"
                                        label="Celular Padre"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherCellphone}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherEmail"
                                        label="Correo Padre"
                                        type="email"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherEmail}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                {/* RAZON SOCIAL / NIT */}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="razonSocial"
                                        label="Razón Social"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.razonSocial}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="nit"
                                        label="NIT (sin guiones)"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.nit}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                {/* DIRECCIONES */}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="mainAddress"
                                        label="Dirección Principal"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.mainAddress}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="alternativeAddress"
                                        label="Dirección Alterna"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.alternativeAddress}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                            </Grid>

                            {/* ALUMNOS */}
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Alumnos
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {familyDetail.students.map((st, idx) => (
                                    <Grid item xs={12} key={idx}>
                                        <Typography variant="body2" sx={{ ml: 2 }}>
                                            • {st.fullName} ({st.grade})
                                        </Typography>
                                    </Grid>
                                ))}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="fullName"
                                        label="Nombre Completo Alumno"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={newStudent.fullName}
                                        onChange={(e) => setNewStudent({
                                            ...newStudent,
                                            fullName: e.target.value
                                        })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="grade"
                                        label="Grado"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={newStudent.grade}
                                        onChange={(e) => setNewStudent({
                                            ...newStudent,
                                            grade: e.target.value
                                        })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2} display="flex" alignItems="center">
                                    <Button
                                        variant="outlined"
                                        onClick={handleAddStudent}
                                        sx={{ mt: 1 }}
                                    >
                                        Agregar Alumno
                                    </Button>
                                </Grid>
                            </Grid>

                            {/* HORARIOS DE PARADA */}
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Horarios de Parada
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {familyDetail.scheduleSlots.map((slot, idx) => (
                                    <Grid item xs={12} key={idx}>
                                        <Typography variant="body2" sx={{ ml: 2 }}>
                                            • {slot.time} {slot.note && `(${slot.note})`}
                                        </Typography>
                                    </Grid>
                                ))}
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="time"
                                        label="Hora (HH:MM)"
                                        type="time"
                                        fullWidth
                                        variant="outlined"
                                        value={newSlot.time}
                                        onChange={(e) => setNewSlot({
                                            ...newSlot,
                                            time: e.target.value
                                        })}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="note"
                                        label="Nota / Parada"
                                        type="text"
                                        fullWidth
                                        variant="outlined"
                                        value={newSlot.note}
                                        onChange={(e) => setNewSlot({
                                            ...newSlot,
                                            note: e.target.value
                                        })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2} display="flex" alignItems="center">
                                    <Button
                                        variant="outlined"
                                        onClick={handleAddSlot}
                                        sx={{ mt: 1 }}
                                    >
                                        Agregar
                                    </Button>
                                </Grid>
                            </Grid>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSaveUser}
                        color="primary"
                        variant="contained"
                    >
                        {selectedUser?.id ? 'Guardar Cambios' : 'Crear Usuario'}
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
        </RolesContainer>
    );
};

export default RolesManagementPage;
