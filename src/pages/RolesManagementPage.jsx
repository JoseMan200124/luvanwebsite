// src/pages/RolesManagementPage.js

import React, { useState, useEffect, useContext, useCallback, memo } from 'react';
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
    Grid,
    Checkbox,
    Box,
    Link,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { Edit, Delete, Add, FileUpload } from '@mui/icons-material';

import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import styled from 'styled-components';

const RolesContainer = tw.div`
  p-8 bg-gray-100 min-h-screen w-full
`;

const roleOptions = [
    { id: 1, name: 'Gestor' },
    { id: 2, name: 'Administrador' },
    { id: 3, name: 'Padre' },
    { id: 4, name: 'Monitora' },
    { id: 5, name: 'Piloto' },
    { id: 6, name: 'Supervisor' },
];

const SupervisorPilotsList = memo(({ allPilots, selectedSupervisorPilots, onToggle }) => {
    return (
        <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
            {allPilots.map((pilot) => {
                const pilotIdNum = Number(pilot.id);
                const checked = selectedSupervisorPilots.includes(pilotIdNum);
                return (
                    <div
                        key={pilotIdNum}
                        style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}
                    >
                        <Checkbox
                            checked={checked}
                            onChange={() => {
                                onToggle(pilotIdNum);
                            }}
                            color="primary"
                        />
                        <span>{`${pilot.name} (ID: ${pilotIdNum})`}</span>
                    </div>
                );
            })}
        </div>
    );
});

/* ========= Responsive Table Styles (para desktop) ========= */
const ResponsiveTableHead = styled(TableHead)`
    @media (max-width: 600px) {
        display: none;
    }
`;

const ResponsiveTableCell = styled(TableCell)`
  @media (max-width: 600px) {
    display: block;
    text-align: right;
    position: relative;
    padding-left: 50%;
    white-space: nowrap;
    &:before {
      content: attr(data-label);
      position: absolute;
      left: 0;
      width: 45%;
      padding-left: 15px;
      font-weight: bold;
      text-align: left;
      white-space: nowrap;
    }
  }
`;

/* ========= Styles para la vista móvil en formato "card" ========= */
const MobileCard = styled(Paper)`
    padding: 16px;
    margin-bottom: 16px;
`;

const MobileField = styled(Box)`
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
`;

const MobileLabel = styled(Typography)`
  font-weight: bold;
  font-size: 0.875rem;
  color: #555;
`;

const MobileValue = styled(Typography)`
  font-size: 1rem;
`;

const RolesManagementPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const { auth } = useContext(AuthContext);

    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [contracts, setContracts] = useState([]);

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
        scheduleSlots: [],
        specialFee: 0
    });
    const [newStudent, setNewStudent] = useState({ fullName: '', grade: '' });
    const [newSlot, setNewSlot] = useState({ time: '', note: '' });
    const [selectedContractUuid, setSelectedContractUuid] = useState('');

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const [allPilots, setAllPilots] = useState([]);
    const [selectedSupervisorPilots, setSelectedSupervisorPilots] = useState([]);

    const [availablePilotSchedules, setAvailablePilotSchedules] = useState([]);
    const [selectedPilotSchedules, setSelectedPilotSchedules] = useState([]);

    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    const [schoolGrades, setSchoolGrades] = useState([]);

    useEffect(() => {
        fetchUsers();
        fetchSchools();
        fetchBuses();
        fetchContracts();
        fetchAllPilots();
    }, []);

    const fetchAllPilots = async () => {
        try {
            const resp = await api.get('/users/pilots');
            setAllPilots(resp.data.users || []);
        } catch (error) {
            console.error('[fetchAllPilots] Error:', error);
            setAllPilots([]);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users');
            setUsers(response.data.users || []);
        } catch (err) {
            console.error('[fetchUsers] Error:', err);
            setSnackbar({ open: true, message: 'Error al obtener usuarios', severity: 'error' });
        }
        setLoading(false);
    };

    const fetchSchools = async () => {
        try {
            const resp = await api.get('/schools');
            setSchools(resp.data.schools || []);
        } catch (err) {
            console.error('[fetchSchools] Error:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
        }
    };

    const fetchBuses = async () => {
        try {
            const resp = await api.get('/buses');
            setBuses(resp.data.buses || []);
        } catch (error) {
            console.error('[fetchBuses] Error:', error);
            setSnackbar({ open: true, message: 'Error al obtener buses', severity: 'error' });
        }
    };

    const fetchContracts = async () => {
        try {
            const resp = await api.get('/contracts');
            setContracts(resp.data || []);
        } catch (err) {
            console.error('[fetchContracts] Error:', err);
        }
    };

    const fetchSchedulesForSchool = async (schoolId) => {
        try {
            const resp = await api.get(`/schools/${schoolId}/schedules`);
            if (resp.data && Array.isArray(resp.data.schedules)) {
                const expanded = [];
                resp.data.schedules.forEach((schObj) => {
                    schObj.times.forEach((t) => {
                        expanded.push({ day: schObj.day, time: t });
                    });
                });
                setAvailablePilotSchedules(expanded);
            } else {
                setAvailablePilotSchedules([]);
            }
        } catch (error) {
            console.error('[fetchSchedulesForSchool] Error:', error);
            setAvailablePilotSchedules([]);
        }
    };

    const fetchSchoolGrades = async (schoolId) => {
        try {
            const response = await api.get(`/schools/${schoolId}`);
            if (response.data && response.data.school && Array.isArray(response.data.school.grades)) {
                setSchoolGrades(response.data.school.grades);
            } else {
                setSchoolGrades([]);
            }
        } catch (error) {
            console.error('[fetchSchoolGrades] Error:', error);
            setSchoolGrades([]);
        }
    };

    const fetchPilotAssignedSchedules = async (pilotId) => {
        try {
            const resp = await api.get(`/transportistas/${pilotId}/schedules`);
            setSelectedPilotSchedules(resp.data.schedules || []);
        } catch (error) {
            console.error('[fetchPilotAssignedSchedules] Error:', error);
            setSelectedPilotSchedules([]);
        }
    };

    const handleToggleSupervisorPilot = useCallback((pilotId) => {
        setSelectedSupervisorPilots(prev => {
            if (prev.includes(pilotId)) {
                return prev.filter(x => x !== pilotId);
            } else {
                return [...prev, pilotId];
            }
        });
    }, []);

    const handleEditClick = async (user) => {
        const parsedRoleId = Number(user.roleId);
        setSelectedUser({
            ...user,
            roleId: parsedRoleId,
            password: ''
        });

        if (parsedRoleId === 3 && user.FamilyDetail) {
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
                scheduleSlots: user.FamilyDetail.ScheduleSlots || [],
                specialFee: user.FamilyDetail.specialFee ?? 0
            });
            if (user.school) {
                await fetchSchoolGrades(user.school);
            }
        } else {
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
                scheduleSlots: [],
                specialFee: 0
            });
        }

        setSelectedContractUuid('');
        setAvailablePilotSchedules([]);
        setSelectedPilotSchedules([]);
        setSelectedSupervisorPilots([]);

        if (parsedRoleId === 5) {
            if (user.school) {
                await fetchSchedulesForSchool(user.school);
            }
            await fetchPilotAssignedSchedules(user.id);
        }

        if (parsedRoleId === 6 || (user.Role && user.Role.name === 'Supervisor')) {
            const newArray = user.supervisorPilots ? user.supervisorPilots.map(sp => Number(sp.pilotId)) : [];
            setSelectedSupervisorPilots(newArray);
        }

        setOpenDialog(true);
    };

    const handleAddUser = () => {
        setSelectedUser({
            id: null,
            name: '',
            email: '',
            password: '',
            roleId: '',
            school: '',
            busId: ''
        });
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
            scheduleSlots: [],
            specialFee: 0
        });
        setSelectedContractUuid('');
        setAvailablePilotSchedules([]);
        setSelectedPilotSchedules([]);
        setSelectedSupervisorPilots([]);
        setSchoolGrades([]);
        setOpenDialog(true);
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedUser(null);
        setSelectedSupervisorPilots([]);
    };

    const handleDeleteClick = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/users/${userId}`);
                setSnackbar({ open: true, message: 'Usuario eliminado exitosamente', severity: 'success' });
                fetchUsers();
            } catch (err) {
                console.error('[handleDeleteClick] Error:', err);
                setSnackbar({ open: true, message: 'Error al eliminar usuario', severity: 'error' });
            }
        }
    };

    const handleUserChange = (e) => {
        setSelectedUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRoleIdChange = (e) => {
        const newRoleId = Number(e.target.value);
        setSelectedUser(prev => ({ ...prev, roleId: newRoleId }));
    };

    const handleBusChange = (e) => {
        const busIdVal = parseInt(e.target.value, 10) || null;
        setSelectedUser(prev => ({ ...prev, busId: busIdVal }));
    };

    const handleFamilyDetailChange = (e) => {
        setFamilyDetail(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleAddStudent = () => {
        if (!newStudent.fullName) return;
        setFamilyDetail(prev => ({
            ...prev,
            students: [...prev.students, newStudent]
        }));
        setNewStudent({ fullName: '', grade: '' });
    };

    const handleAddSlot = () => {
        if (!newSlot.time) return;
        setFamilyDetail(prev => ({
            ...prev,
            scheduleSlots: [...prev.scheduleSlots, newSlot]
        }));
        setNewSlot({ time: '', note: '' });
    };

    const handleTogglePilotSchedule = (day, time) => {
        const found = selectedPilotSchedules.find(s => s.day === day && s.time === time);
        if (found) {
            setSelectedPilotSchedules(prev => prev.filter(x => x !== found));
        } else {
            setSelectedPilotSchedules(prev => [...prev, { day, time }]);
        }
    };

    const finalizePilotSchedules = async (pilotId) => {
        try {
            await api.post(`/transportistas/${pilotId}/schedules`, {
                schedules: selectedPilotSchedules
            });
        } catch (err) {
            console.error('[finalizePilotSchedules] Error:', err);
        }
    };

    const handleSaveUser = async () => {
        try {
            let payload = {
                id: selectedUser.id,
                name: selectedUser.name,
                email: selectedUser.email,
                roleId: Number(selectedUser.roleId),
                school: selectedUser.school,
                busId: selectedUser.busId || null,
                phoneNumber: selectedUser.phoneNumber || null
            };

            if (selectedUser.password && selectedUser.password.trim() !== '') {
                payload.password = selectedUser.password;
            }

            if (payload.roleId === 3) {
                payload.familyDetail = familyDetail;
                payload.selectedContractUuid = selectedContractUuid;
            }

            if (payload.roleId === 6) {
                payload.supervisorPilots = selectedSupervisorPilots;
            }

            if (selectedUser.id) {
                await api.put(`/users/${selectedUser.id}`, payload);
                if (payload.roleId === 5) {
                    await finalizePilotSchedules(selectedUser.id);
                }
                setSnackbar({ open: true, message: 'Usuario actualizado exitosamente', severity: 'success' });
            } else {
                const resp = await api.post('/users', payload);
                const newUserId = resp.data.user.id;
                if (payload.roleId === 5) {
                    await finalizePilotSchedules(newUserId);
                }
                setSnackbar({ open: true, message: 'Usuario creado exitosamente', severity: 'success' });
            }

            fetchUsers();
            handleDialogClose();
        } catch (err) {
            console.error('[handleSaveUser] Error:', err);
            setSnackbar({ open: true, message: 'Error al guardar usuario', severity: 'error' });
        }
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

    const filteredUsers = users.filter((u) =>
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpenBulkDialog = () => {
        setBulkFile(null);
        setBulkResults(null);
        setOpenBulkDialog(true);
    };

    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setBulkFile(file);
    };

    const handleUploadBulk = async () => {
        if (!bulkFile) return;
        setBulkLoading(true);
        setBulkResults(null);

        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const resp = await api.post('/users/bulk-upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setBulkResults(resp.data);
            fetchUsers();
        } catch (error) {
            console.error('[handleUploadBulk] Error:', error);
            setSnackbar({ open: true, message: 'Ocurrió un error al procesar la carga masiva', severity: 'error' });
        }
        setBulkLoading(false);
    };

    const getFormattedDateTime = () => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    const downloadFilename = `plantilla_usuarios_${getFormattedDateTime()}.xlsx`;

    // Función auxiliar para cerrar el sidebar en móviles al seleccionar una opción
    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            // Aquí se podría agregar lógica para cerrar algún menú, en este caso se deja vacío.
        }
    };

    return (
        <RolesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Usuarios y Roles
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    mb: 2,
                    gap: 2
                }}
            >
                <TextField
                    label="Buscar usuarios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    sx={{ width: '100%', maxWidth: '300px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<FileUpload />}
                        onClick={handleOpenBulkDialog}
                    >
                        Carga Masiva
                    </Button>
                    <Button variant="contained" color="primary" startIcon={<Add />} onClick={handleAddUser}>
                        Añadir Usuario
                    </Button>
                </div>
            </Box>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {filteredUsers
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((user) => (
                                    <MobileCard key={user.id} elevation={3}>
                                        <Grid container spacing={1}>
                                            <Grid item xs={12}>
                                                <MobileField>
                                                    <MobileLabel>Nombre</MobileLabel>
                                                    <MobileValue>{user.name}</MobileValue>
                                                </MobileField>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <MobileField>
                                                    <MobileLabel>Correo</MobileLabel>
                                                    <MobileValue>{user.email}</MobileValue>
                                                </MobileField>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <MobileField>
                                                    <MobileLabel>Rol</MobileLabel>
                                                    <MobileValue>{user.Role ? user.Role.name : '—'}</MobileValue>
                                                </MobileField>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <MobileField>
                                                    <MobileLabel>Colegio</MobileLabel>
                                                    <MobileValue>{user.School ? user.School.name : '—'}</MobileValue>
                                                </MobileField>
                                            </Grid>
                                            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
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
                                            </Grid>
                                        </Grid>
                                    </MobileCard>
                                ))}
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
                        </>
                    ) : (
                        <Paper sx={{ width: '100%', overflowX: 'auto' }}>
                            <TableContainer
                                sx={{
                                    maxHeight: { xs: 400, sm: 'none' },
                                    overflowX: 'auto'
                                }}
                            >
                                <Table stickyHeader>
                                    <ResponsiveTableHead>
                                        <TableRow>
                                            <TableCell>Nombre</TableCell>
                                            <TableCell>Correo</TableCell>
                                            <TableCell>Rol</TableCell>
                                            <TableCell>Colegio</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </ResponsiveTableHead>
                                    <TableBody>
                                        {filteredUsers
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((user) => (
                                                <TableRow key={user.id}>
                                                    <ResponsiveTableCell data-label="Nombre">{user.name}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Correo">{user.email}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Rol">
                                                        {user.Role ? user.Role.name : '—'}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Colegio">
                                                        {user.School ? user.School.name : '—'}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Acciones" align="center">
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
                                                    </ResponsiveTableCell>
                                                </TableRow>
                                            ))}
                                        {filteredUsers.length === 0 && (
                                            <TableRow>
                                                <ResponsiveTableCell colSpan={5} align="center">
                                                    No se encontraron usuarios.
                                                </ResponsiveTableCell>
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
                </>
            )}

            {/* Diálogo para editar/agregar usuario */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>{selectedUser?.id ? 'Editar Usuario' : 'Añadir Usuario'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedUser?.id
                            ? 'Actualiza la información del usuario.'
                            : 'Completa la información para crear un nuevo usuario.'}
                    </DialogContentText>

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
                        {selectedUser?.id && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="password"
                                    label="Nueva Contraseña (opcional)"
                                    type="password"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.password || ''}
                                    onChange={handleUserChange}
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

                        <Grid item xs={12} md={6}>
                            <FormControl variant="outlined" fullWidth>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    name="school"
                                    value={selectedUser?.school || ''}
                                    onChange={async (e) => {
                                        const newSchoolId = e.target.value;
                                        setSelectedUser(prev => ({ ...prev, school: newSchoolId }));

                                        if (Number(selectedUser?.roleId) === 5) {
                                            if (newSchoolId) {
                                                await fetchSchedulesForSchool(newSchoolId);
                                            } else {
                                                setAvailablePilotSchedules([]);
                                                setSelectedPilotSchedules([]);
                                            }
                                        }
                                        if (Number(selectedUser?.roleId) === 3) {
                                            if (newSchoolId) {
                                                await fetchSchoolGrades(newSchoolId);
                                            } else {
                                                setSchoolGrades([]);
                                            }
                                        }
                                    }}
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

                        {Number(selectedUser?.roleId) === 3 && (
                            <Grid item xs={12} md={6}>
                                <FormControl variant="outlined" fullWidth>
                                    <InputLabel>Bus Asignado</InputLabel>
                                    <Select
                                        name="busId"
                                        value={selectedUser.busId || ''}
                                        onChange={handleBusChange}
                                        label="Bus Asignado"
                                    >
                                        <MenuItem value="">
                                            <em>Ninguno</em>
                                        </MenuItem>
                                        {buses.map((bus) => (
                                            <MenuItem key={bus.id} value={bus.id}>
                                                {bus.plate}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}

                        {Number(selectedUser?.roleId) === 4 && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    name="phoneNumber"
                                    label="Teléfono de la Monitora"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={selectedUser?.phoneNumber || ''}
                                    onChange={handleUserChange}
                                />
                            </Grid>
                        )}
                    </Grid>

                    {/* Rol Padre */}
                    {Number(selectedUser?.roleId) === 3 && (
                        <>
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Seleccionar Contrato para enviar al Padre
                            </Typography>
                            <FormControl fullWidth margin="dense">
                                <InputLabel>Contrato</InputLabel>
                                <Select
                                    value={selectedContractUuid}
                                    onChange={(e) => setSelectedContractUuid(e.target.value)}
                                    label="Contrato"
                                >
                                    <MenuItem value="">
                                        <em>Ninguno</em>
                                    </MenuItem>
                                    {contracts.map((c) => (
                                        <MenuItem key={c.uuid} value={c.uuid}>
                                            {c.title}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Datos de la Familia (Padre)
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherName"
                                        label="Nombre de la Madre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherName}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherCellphone"
                                        label="Celular de la Madre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherCellphone}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="motherEmail"
                                        label="Correo de la Madre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.motherEmail}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherName"
                                        label="Nombre del Padre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherName}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherCellphone"
                                        label="Celular del Padre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherCellphone}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        name="fatherEmail"
                                        label="Correo del Padre"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.fatherEmail}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="razonSocial"
                                        label="Razón Social"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.razonSocial}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="nit"
                                        label="NIT"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.nit}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="mainAddress"
                                        label="Dirección Principal"
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
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.alternativeAddress}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="specialFee"
                                        label="Descuento Especial (monto fijo)"
                                        type="number"
                                        fullWidth
                                        variant="outlined"
                                        value={familyDetail.specialFee}
                                        onChange={handleFamilyDetailChange}
                                    />
                                </Grid>
                            </Grid>

                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Alumnos
                            </Typography>
                            <Grid container spacing={2}>
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
                                        label="Nombre Completo del Alumno"
                                        fullWidth
                                        variant="outlined"
                                        value={newStudent.fullName}
                                        onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Grado</InputLabel>
                                        <Select
                                            value={newStudent.grade}
                                            label="Grado"
                                            onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                                        >
                                            <MenuItem value="">
                                                <em>Seleccione un grado</em>
                                            </MenuItem>
                                            {schoolGrades.map((grade, idx) => (
                                                <MenuItem key={idx} value={grade.name}>
                                                    {grade.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={2} display="flex" alignItems="center">
                                    <Button variant="outlined" onClick={handleAddStudent} sx={{ mt: 1 }}>
                                        Agregar
                                    </Button>
                                </Grid>
                            </Grid>

                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Horarios de Parada
                            </Typography>
                            <Grid container spacing={2}>
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
                                        onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        name="note"
                                        label="Nota / Parada"
                                        fullWidth
                                        variant="outlined"
                                        value={newSlot.note}
                                        onChange={(e) => setNewSlot({ ...newSlot, note: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2} display="flex" alignItems="center">
                                    <Button variant="outlined" onClick={handleAddSlot} sx={{ mt: 1 }}>
                                        Agregar
                                    </Button>
                                </Grid>
                            </Grid>
                        </>
                    )}

                    {/* Rol Piloto */}
                    {Number(selectedUser?.roleId) === 5 && (
                        <>
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Horarios Disponibles del Colegio
                            </Typography>
                            {availablePilotSchedules.length === 0 ? (
                                <Typography variant="body2" color="textSecondary">
                                    No hay horarios disponibles o no se han cargado.
                                </Typography>
                            ) : (
                                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                                    {availablePilotSchedules.map((slot, idx) => {
                                        const checked = !!selectedPilotSchedules.find(
                                            s => s.day === slot.day && s.time === slot.time
                                        );
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                                                <Checkbox
                                                    checked={checked}
                                                    onChange={() => {
                                                        handleTogglePilotSchedule(slot.day, slot.time);
                                                    }}
                                                    color="primary"
                                                />
                                                <span>{`${slot.day} - ${slot.time}`}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Rol Supervisor */}
                    {Number(selectedUser?.roleId) === 6 && (
                        <>
                            <Typography variant="h6" sx={{ mt: 3 }}>
                                Pilotos a cargo
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Selecciona uno o más pilotos que estarán a cargo de este Supervisor.
                            </Typography>
                            <SupervisorPilotsList
                                allPilots={allPilots}
                                selectedSupervisorPilots={selectedSupervisorPilots}
                                onToggle={handleToggleSupervisorPilot}
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleSaveUser} color="primary" variant="contained">
                        {selectedUser?.id ? 'Guardar Cambios' : 'Crear Usuario'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Usuarios</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Sube el archivo con las columnas correctas. Usa la plantilla oficial.
                    </DialogContentText>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="outlined"
                            sx={{ mr: 2 }}
                            color="success"
                            component={Link}
                            href="/plantillas/plantilla_usuarios.xlsx"
                            download={downloadFilename}
                        >
                            Descargar Plantilla
                        </Button>
                        <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                            Seleccionar Archivo
                            <input
                                type="file"
                                hidden
                                onChange={handleFileChange}
                                accept=".xlsx, .xls, .csv"
                            />
                        </Button>
                        {bulkFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                {bulkFile.name}
                            </Typography>
                        )}
                    </Box>
                    {bulkLoading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                            <CircularProgress size={24} />
                            <Typography variant="body2" sx={{ ml: 2 }}>
                                Procesando archivo...
                            </Typography>
                        </Box>
                    )}
                    {bulkResults && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info">
                                <Typography>
                                    <strong>Usuarios creados/actualizados:</strong> {bulkResults.successCount}
                                </Typography>
                                <Typography>
                                    <strong>Errores:</strong> {bulkResults.errorsCount}
                                </Typography>
                                {bulkResults.errorsList && bulkResults.errorsList.length > 0 && (
                                    <ul>
                                        {bulkResults.errorsList.map((err, idx) => (
                                            <li key={idx}>
                                                Fila {err.row}: {err.errorMessage}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseBulkDialog}>Cerrar</Button>
                    <Button
                        onClick={handleUploadBulk}
                        variant="contained"
                        color="primary"
                        disabled={!bulkFile || bulkLoading}
                    >
                        Subir
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
