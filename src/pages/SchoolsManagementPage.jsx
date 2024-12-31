// src/pages/SchoolsManagementPage.jsx

import React, { useState, useEffect, useContext } from 'react';
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
    Tooltip,
    Paper,
    TableContainer,
    TablePagination,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Alert,
    CircularProgress,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

// Contenedor con twin.macro
const SchoolsContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const SchoolsManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // Aquí guardamos el "schoolSchedules" como un array de objetos:
    // Ej: [ { day: "Lunes", times: ["06:30", "12:00"] } ]
    const [schoolSchedules, setSchoolSchedules] = useState([]);

    // 1) Cargar lista de colegios
    const fetchSchools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            // La respuesta es { schools: [...] }
            setSchools(Array.isArray(response.data.schools) ? response.data.schools : []);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener los colegios:', err);
            setSnackbar({ open: true, message: 'Error al obtener colegios', severity: 'error' });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, [auth.token]);

    // 2) Crear un colegio (modal vacío)
    const handleAddSchool = () => {
        setSelectedSchool({
            id: null,
            name: '',
            address: '',
            city: '',
            contactPerson: '',
            contactEmail: '',
            contactPhone: ''
        });
        // Schedules vacío
        setSchoolSchedules([]);
        setOpenDialog(true);
    };

    // 3) Editar un colegio: parsear "schedules" si viene como JSON string
    const handleEditClick = (school) => {
        setSelectedSchool(school);

        // Checamos si el campo "schedules" es un string JSON
        if (typeof school.schedules === 'string' && school.schedules.trim()) {
            try {
                const parsed = JSON.parse(school.schedules);
                if (Array.isArray(parsed)) {
                    setSchoolSchedules(parsed);
                } else {
                    setSchoolSchedules([]);
                }
            } catch (err) {
                console.error('Error parseando schedules JSON:', err);
                setSchoolSchedules([]);
            }
        }
        // Si ya es un array, lo asignamos directamente
        else if (Array.isArray(school.schedules)) {
            setSchoolSchedules(school.schedules);
        } else {
            setSchoolSchedules([]);
        }

        setOpenDialog(true);
    };

    // 4) Eliminar colegio
    const handleDeleteClick = async (schoolId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este colegio?')) {
            try {
                await api.delete(`/schools/${schoolId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio eliminado exitosamente', severity: 'success' });
                fetchSchools();
            } catch (err) {
                console.error('Error al eliminar colegio:', err);
                setSnackbar({ open: true, message: 'Error al eliminar colegio', severity: 'error' });
            }
        }
    };

    // 5) Cerrar el modal
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedSchool(null);
        setSchoolSchedules([]);
    };

    // 6) Manejadores de input simple (para name, address, city, etc.)
    const handleInputChange = (e) => {
        setSelectedSchool((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // ============ Manejo de schoolSchedules (UI Dinámica) ============
    const handleAddDay = () => {
        setSchoolSchedules((prev) => [
            ...prev,
            { day: '', times: [''] }
        ]);
    };

    const handleRemoveDay = (dayIndex) => {
        setSchoolSchedules((prev) => {
            const newArr = [...prev];
            newArr.splice(dayIndex, 1);
            return newArr;
        });
    };

    const handleDayChange = (e, dayIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[dayIndex].day = value;
            return clone;
        });
    };

    // Manejo de las "times" (horas) en cada day
    const handleAddTime = (dayIndex) => {
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[dayIndex].times.push('');
            return clone;
        });
    };

    const handleRemoveTime = (dayIndex, timeIndex) => {
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[dayIndex].times.splice(timeIndex, 1);
            return clone;
        });
    };

    const handleTimeChange = (e, dayIndex, timeIndex) => {
        const { value } = e.target;
        setSchoolSchedules((prev) => {
            const clone = [...prev];
            clone[dayIndex].times[timeIndex] = value;
            return clone;
        });
    };

    // 7) Guardar (crear o actualizar)
    const handleSave = async () => {
        try {
            // Armamos el payload
            const payload = {
                name: selectedSchool.name,
                address: selectedSchool.address,
                city: selectedSchool.city,
                contactPerson: selectedSchool.contactPerson,
                contactEmail: selectedSchool.contactEmail,
                contactPhone: selectedSchool.contactPhone,
                schedules: schoolSchedules // array => se guardará como JSON en el backend
            };

            if (selectedSchool.id) {
                // Update
                await api.put(`/schools/${selectedSchool.id}`, payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio actualizado exitosamente', severity: 'success' });
            } else {
                // Create
                await api.post('/schools', payload, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                setSnackbar({ open: true, message: 'Colegio creado exitosamente', severity: 'success' });
            }

            fetchSchools();
            handleDialogClose();
        } catch (err) {
            console.error('Error al guardar el colegio:', err);
            setSnackbar({ open: true, message: 'Error al guardar el colegio', severity: 'error' });
        }
    };

    // 8) Búsqueda, paginación, etc.
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

    // Filtrar
    const filteredSchools = schools.filter((sch) =>
        sch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sch.city || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SchoolsContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Colegios
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar colegios"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '300px' }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={handleAddSchool}
                >
                    Añadir Colegio
                </Button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nombre</TableCell>
                                    <TableCell>Ciudad</TableCell>
                                    <TableCell>Dirección</TableCell>
                                    <TableCell>Contacto</TableCell>
                                    <TableCell>Teléfono</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSchools
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((school) => (
                                        <TableRow key={school.id}>
                                            <TableCell>{school.name}</TableCell>
                                            <TableCell>{school.city}</TableCell>
                                            <TableCell>{school.address}</TableCell>
                                            <TableCell>{school.contactPerson}</TableCell>
                                            <TableCell>{school.contactPhone}</TableCell>
                                            <TableCell>{school.contactEmail}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleEditClick(school)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton onClick={() => handleDeleteClick(school.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                                {filteredSchools.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            No se encontraron colegios.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredSchools.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}

            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedSchool?.id ? 'Editar Colegio' : 'Añadir Colegio'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Nombre"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.name : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="city"
                        label="Ciudad"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.city : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="address"
                        label="Dirección"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.address : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="contactPerson"
                        label="Persona de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPerson : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactPhone"
                        label="Teléfono de Contacto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactPhone : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="contactEmail"
                        label="Email de Contacto"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={selectedSchool ? selectedSchool.contactEmail : ''}
                        onChange={handleInputChange}
                    />

                    {/* Horarios con UI/UX */}
                    <Typography variant="h6" style={{ marginTop: '1rem' }}>
                        Horarios del Colegio
                    </Typography>
                    {schoolSchedules.map((sch, dayIndex) => (
                        <Paper key={dayIndex} style={{ padding: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle1">
                                    Horario #{dayIndex + 1}
                                </Typography>
                                <IconButton
                                    onClick={() => handleRemoveDay(dayIndex)}
                                    color="error"
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </div>
                            <TextField
                                margin="dense"
                                name="day"
                                label="Día"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={sch.day}
                                onChange={(e) => handleDayChange(e, dayIndex)}
                            />
                            <Typography variant="subtitle2" style={{ marginTop: '0.5rem' }}>
                                Horas
                            </Typography>
                            {sch.times.map((timeValue, timeIndex) => (
                                <div
                                    key={timeIndex}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        marginBottom: '0.5rem'
                                    }}
                                >
                                    <TextField
                                        label="Hora (HH:MM)"
                                        variant="outlined"
                                        type="time"
                                        value={timeValue}
                                        onChange={(e) => handleTimeChange(e, dayIndex, timeIndex)}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                    <IconButton
                                        onClick={() => handleRemoveTime(dayIndex, timeIndex)}
                                        color="error"
                                        size="small"
                                    >
                                        <Delete />
                                    </IconButton>
                                </div>
                            ))}
                            <Button
                                variant="outlined"
                                startIcon={<Add />}
                                onClick={() => handleAddTime(dayIndex)}
                            >
                                Agregar hora
                            </Button>
                        </Paper>
                    ))}

                    <Button
                        variant="contained"
                        style={{ marginTop: '1rem' }}
                        onClick={handleAddDay}
                        startIcon={<Add />}
                    >
                        Agregar Día
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        color="primary"
                        variant="contained"
                    >
                        {selectedSchool?.id ? 'Guardar Cambios' : 'Crear Colegio'}
                    </Button>
                </DialogActions>
            </Dialog>

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
        </SchoolsContainer>
    );
};

export default SchoolsManagementPage;
