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
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

const RolesContainer = tw.div`p-8 bg-gray-100 min-h-screen`; // Corrección de estilos

const RolesManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [roles] = useState(['Gestor', 'Administrador', 'Padre', 'Monitora', 'Piloto', 'Supervisor']);
    const [selectedUser, setSelectedUser] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // NUEVO: Estado para almacenar la lista de colegios
    const [schools, setSchools] = useState([]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            console.log('Respuesta de la API:', response.data);
            setUsers(Array.isArray(response.data.users) ? response.data.users : []);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener usuarios:', err);
            setSnackbar({ open: true, message: 'Error al obtener usuarios', severity: 'error' });
            setLoading(false);
        }
    };

    // NUEVO: Función para obtener la lista de colegios
    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            // Asumiendo que la respuesta es algo como { schools: [...] }
            setSchools(Array.isArray(response.data.schools) ? response.data.schools : []);
        } catch (err) {
            console.error('Error al obtener colegios:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
        }
    };

    useEffect(() => {
        // Primero obtenemos los usuarios
        fetchUsers();
    }, [auth.token]);

    // NUEVO: Una vez que tenemos usuarios o al montar, también obtenemos colegios
    useEffect(() => {
        fetchSchools();
    }, [auth.token]);

    const handleEditClick = (user) => {
        setSelectedUser(user);
        setOpenDialog(true);
    };

    const handleDeleteClick = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/users/${userId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Usuario eliminado exitosamente', severity: 'success' });
                fetchUsers();
            } catch (err) {
                console.error('Error al eliminar usuario:', err);
                setSnackbar({ open: true, message: 'Error al eliminar usuario', severity: 'error' });
            }
        }
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
    };

    const handleInputChange = (e) => {
        setSelectedUser({
            ...selectedUser,
            [e.target.name]: e.target.value,
        });
    };

    const handleRoleChange = (e) => {
        setSelectedUser({
            ...selectedUser,
            role: e.target.value,
        });
    };

    const handleSave = async () => {
        try {
            await api.put(`/users/${selectedUser.id}`, selectedUser, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setSnackbar({ open: true, message: 'Usuario actualizado exitosamente', severity: 'success' });
            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('Error al actualizar usuario:', err);
            setSnackbar({ open: true, message: 'Error al actualizar usuario', severity: 'error' });
        }
    };

    const handleAddUser = () => {
        setSelectedUser({
            firstName: '',
            lastName: '',
            email: '',
            role: '',
            school: '',
            password: '',
        });
        setOpenDialog(true);
    };

    const handleCreate = async () => {
        try {
            await api.post('/users', selectedUser, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setSnackbar({ open: true, message: 'Usuario creado exitosamente', severity: 'success' });
            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('Error al crear usuario:', err);
            setSnackbar({ open: true, message: 'Error al crear usuario', severity: 'error' });
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Filtrar usuarios basados en la consulta de búsqueda
    const filteredUsers = users.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
            fullName.includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.role.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

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
                                    <TableCell>Apellido</TableCell>
                                    <TableCell>Correo Electrónico</TableCell>
                                    <TableCell>Rol</TableCell>
                                    <TableCell>Colegio</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.firstName}</TableCell>
                                        <TableCell>{user.lastName}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.role}</TableCell>
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
                                ))}
                                {filteredUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
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
            {/* Diálogo para Editar/Añadir Usuario */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedUser && selectedUser.id ? 'Editar Usuario' : 'Añadir Usuario'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedUser && selectedUser.id
                            ? 'Actualiza la información del usuario.'
                            : 'Completa la información para crear un nuevo usuario.'}
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="firstName"
                        label="Nombre"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedUser ? selectedUser.firstName : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="lastName"
                        label="Apellido"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedUser ? selectedUser.lastName : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="email"
                        label="Correo Electrónico"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={selectedUser ? selectedUser.email : ''}
                        onChange={handleInputChange}
                        required
                        disabled={selectedUser && selectedUser.id}
                    />
                    {!selectedUser?.id && (
                        <TextField
                            margin="dense"
                            name="password"
                            label="Contraseña"
                            type="password"
                            fullWidth
                            variant="outlined"
                            value={selectedUser ? selectedUser.password : ''}
                            onChange={handleInputChange}
                            required
                        />
                    )}
                    <FormControl variant="outlined" fullWidth margin="dense" required>
                        <InputLabel>Rol</InputLabel>
                        <Select
                            name="role"
                            value={selectedUser ? selectedUser.role : ''}
                            onChange={handleRoleChange}
                            label="Rol"
                        >
                            <MenuItem value="">
                                <em>Seleccione un rol</em>
                            </MenuItem>
                            {roles.map((role) => (
                                <MenuItem key={role} value={role}>
                                    {role}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {/* Cambiamos el campo de texto por un SELECT con todos los colegios */}
                    <FormControl variant="outlined" fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            name="school"
                            value={selectedUser ? selectedUser.school : ''}
                            onChange={handleInputChange}
                            label="Colegio"
                        >
                            <MenuItem value="">
                                <em>Seleccione un colegio</em>
                            </MenuItem>
                            {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={selectedUser && selectedUser.id ? handleSave : handleCreate}
                        color="primary"
                        variant="contained"
                    >
                        {selectedUser && selectedUser.id ? 'Guardar Cambios' : 'Crear Usuario'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Snackbar para retroalimentación */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </RolesContainer>
    );

};

export default RolesManagementPage;
