// src/pages/RoutesManagementPage.jsx

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
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import { Edit, Delete, Add, Map } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import MapComponent from '../components/MapComponent';

const RoutesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const RoutesManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [routes, setRoutes] = useState([]);
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openMapDialog, setOpenMapDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // ==============================
    // 1. Carga de datos iniciales
    // ==============================
    const fetchRoutes = async () => {
        setLoading(true);
        try {
            const response = await api.get('/routes', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setRoutes(Array.isArray(response.data.routes) ? response.data.routes : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching routes:', err);
            setSnackbar({ open: true, message: 'Error al obtener las rutas', severity: 'error' });
            setLoading(false);
        }
    };

    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setSchools(Array.isArray(response.data.schools) ? response.data.schools : []);
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSnackbar({ open: true, message: 'Error al obtener los colegios', severity: 'error' });
        }
    };

    const fetchBuses = async () => {
        try {
            const response = await api.get('/buses', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setBuses(Array.isArray(response.data.buses) ? response.data.buses : []);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener los buses', severity: 'error' });
        }
    };

    useEffect(() => {
        if (auth.token) {
            fetchRoutes();
            fetchSchools();
            fetchBuses();
        }
    }, [auth.token]);

    // =================================================
    // 2. Funciones para el CRUD de Rutas (crear/editar)
    // =================================================
    const handleEditClick = (route) => {
        // Asegúrate de formatear la data si no existe la propiedad schedule
        const clonedRoute = { ...route };
        if (!Array.isArray(clonedRoute.schedule)) {
            clonedRoute.schedule = [];
        }
        setSelectedRoute(clonedRoute);
        setOpenDialog(true);
    };

    const handleAddRoute = () => {
        // Estructura inicial de la ruta
        setSelectedRoute({
            name: '',
            schoolId: '',
            busId: '',
            // 'schedule' será un array de "horarios", cada elemento con direction, departureTime y un array "stops"
            schedule: [
                {
                    direction: '',
                    departureTime: '',
                    stops: [
                        { address: '', time: '' }
                    ]
                }
            ]
        });
        setOpenDialog(true);
    };

    const handleDeleteClick = async (routeId) => {
        if (window.confirm('¿Estás seguro de eliminar esta ruta?')) {
            try {
                await api.delete(`/routes/${routeId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Ruta eliminada exitosamente', severity: 'success' });
                fetchRoutes();
            } catch (err) {
                console.error('Error deleting route:', err);
                setSnackbar({ open: true, message: 'Error al eliminar la ruta', severity: 'error' });
            }
        }
    };

    // =========================
    // 3. Manejo de formularios
    // =========================
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedRoute(null);
    };

    // Maneja cambios en los campos simples (name, schoolId, busId, etc.)
    const handleInputChange = (e) => {
        setSelectedRoute((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    // ============ Schedules (schedule) a nivel Horario ============
    const handleAddSchedule = () => {
        setSelectedRoute((prev) => ({
            ...prev,
            schedule: [
                ...prev.schedule,
                {
                    direction: '',
                    departureTime: '',
                    stops: [
                        { address: '', time: '' }
                    ]
                }
            ]
        }));
    };

    const handleRemoveSchedule = (index) => {
        setSelectedRoute((prev) => {
            const newSchedules = [...prev.schedule];
            newSchedules.splice(index, 1);
            return {
                ...prev,
                schedule: newSchedules // Correcto: Eliminado JSON.stringify
            };
        });
    };

    const handleScheduleChange = (e, index) => {
        const { name, value } = e.target;
        setSelectedRoute((prev) => {
            const newSchedules = [...prev.schedule];
            newSchedules[index] = {
                ...newSchedules[index],
                [name]: value
            };
            return {
                ...prev,
                schedule: newSchedules // Correcto: Eliminado JSON.stringify
            };
        });
    };

    // ========== Stops (paradas) dentro de cada horario =========
    const handleAddStop = (scheduleIndex) => {
        setSelectedRoute((prev) => {
            const newSchedules = [...prev.schedule];
            newSchedules[scheduleIndex].stops.push({ address: '', time: '' });
            return {
                ...prev,
                schedule: newSchedules // Correcto: Eliminado JSON.stringify
            };
        });
    };

    const handleRemoveStop = (scheduleIndex, stopIndex) => {
        setSelectedRoute((prev) => {
            const newSchedules = [...prev.schedule];
            newSchedules[scheduleIndex].stops.splice(stopIndex, 1);
            return {
                ...prev,
                schedule: newSchedules // Correcto: Eliminado JSON.stringify
            };
        });
    };

    const handleStopChange = (e, scheduleIndex, stopIndex) => {
        const { name, value } = e.target;
        setSelectedRoute((prev) => {
            const newSchedules = [...prev.schedule];
            const newStops = [...newSchedules[scheduleIndex].stops];
            newStops[stopIndex] = {
                ...newStops[stopIndex],
                [name]: value
            };
            newSchedules[scheduleIndex].stops = newStops;
            return {
                ...prev,
                schedule: newSchedules // Correcto: Eliminado JSON.stringify
            };
        });
    };

    // ===================================
    // 4. Guardar (crear/actualizar) ruta
    // ===================================
    const handleSave = async () => {
        try {
            // Validaciones previas
            if (!selectedRoute.name || !selectedRoute.schoolId || !selectedRoute.busId || !selectedRoute.schedule) {
                setSnackbar({ open: true, message: 'Por favor completa todos los campos requeridos.', severity: 'error' });
                return;
            }

            // Validar que 'schedule' es un array de objetos con las propiedades necesarias
            for (let sch of selectedRoute.schedule) {
                if (!sch.direction || !sch.departureTime) {
                    setSnackbar({ open: true, message: 'Cada horario debe tener una dirección y una hora de salida.', severity: 'error' });
                    return;
                }
                if (!Array.isArray(sch.stops)) {
                    setSnackbar({ open: true, message: 'Las paradas deben ser un array.', severity: 'error' });
                    return;
                }
                for (let stop of sch.stops) {
                    if (!stop.address || !stop.time) {
                        setSnackbar({ open: true, message: 'Cada parada debe tener una dirección y una hora.', severity: 'error' });
                        return;
                    }
                }
            }

            // Unir todas las paradas definidas en schedule para enviarlas en 'stops'
            const allStops = selectedRoute.schedule.reduce((acc, sch) => {
                if (Array.isArray(sch.stops)) {
                    return [...acc, ...sch.stops];
                }
                return acc;
            }, []);

            // Construir el objeto que enviaremos al backend
            const routeData = {
                ...selectedRoute,
                stops: allStops || [], // Correcto: Eliminado JSON.stringify
            };

            if (selectedRoute.id) {
                // Actualizar ruta existente
                await api.put(`/routes/${selectedRoute.id}`, routeData, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Ruta actualizada con éxito', severity: 'success' });
            } else {
                // Crear nueva ruta
                await api.post('/routes', routeData, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Ruta creada exitosamente', severity: 'success' });
            }
            fetchRoutes();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving route:', err);
            setSnackbar({ open: true, message: 'Error al guardar la ruta', severity: 'error' });
        }
    };

    // =========================
    // 5. Búsqueda y paginación
    // =========================
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

    const filteredRoutes = Array.isArray(routes)
        ? routes.filter((route) => {
            const schoolName = route.schoolName || '';
            return (
                route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                schoolName.toLowerCase().includes(searchQuery.toLowerCase())
            );
        })
        : [];

    // =====================
    // 6. Ver el mapa (demo)
    // =====================
    const handleViewMap = (route) => {
        setSelectedRoute(route);
        setOpenMapDialog(true);
    };

    const handleMapDialogClose = () => {
        setOpenMapDialog(false);
        setSelectedRoute(null);
    };

    // =====================
    // Render principal
    // =====================
    return (
        <RoutesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Rutas
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar rutas"
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
                    onClick={handleAddRoute}
                >
                    Añadir Ruta
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
                                    <TableCell>Nombre de Ruta</TableCell>
                                    <TableCell>Colegio</TableCell>
                                    <TableCell>Bus</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredRoutes
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((route) => (
                                        <TableRow key={route.id}>
                                            <TableCell>{route.name}</TableCell>
                                            <TableCell>{route.schoolName}</TableCell>
                                            <TableCell>{route.busPlate}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Ver en Mapa">
                                                    <IconButton onClick={() => handleViewMap(route)}>
                                                        <Map />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleEditClick(route)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton onClick={() => handleDeleteClick(route.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                {filteredRoutes.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">
                                            No se encontraron rutas.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredRoutes.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}

            {/* Diálogo para Añadir/Editar Ruta */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedRoute && selectedRoute.id ? 'Editar Ruta' : 'Añadir Ruta'}
                </DialogTitle>
                <DialogContent>
                    {/* Datos principales: Nombre, Colegio, Bus */}
                    <TextField
                        autoFocus
                        margin="dense"
                        name="name"
                        label="Nombre de Ruta"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedRoute ? selectedRoute.name : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <FormControl variant="outlined" fullWidth margin="dense" required>
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            name="schoolId"
                            value={selectedRoute ? selectedRoute.schoolId : ''}
                            onChange={handleInputChange}
                            label="Colegio"
                        >
                            <MenuItem value="">
                                <em>Seleccione un colegio</em>
                            </MenuItem>
                            {Array.isArray(schools) &&
                                schools.map((school) => (
                                    <MenuItem key={school.id} value={school.id}>
                                        {school.name}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                    <FormControl variant="outlined" fullWidth margin="dense" required>
                        <InputLabel>Bus</InputLabel>
                        <Select
                            name="busId"
                            value={selectedRoute ? selectedRoute.busId : ''}
                            onChange={handleInputChange}
                            label="Bus"
                        >
                            <MenuItem value="">
                                <em>Seleccione un bus</em>
                            </MenuItem>
                            {Array.isArray(buses) &&
                                buses.map((bus) => (
                                    <MenuItem key={bus.id} value={bus.id}>
                                        {bus.plate}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>

                    {/* Sección dinámica de horarios (schedule a nivel "schedule") */}
                    <Typography variant="h6" style={{ marginTop: '1rem' }}>
                        Horarios y Paradas
                    </Typography>
                    {selectedRoute &&
                        selectedRoute.schedule &&
                        selectedRoute.schedule.map((schedule, index) => (
                            <Paper key={index} style={{ padding: '1rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="subtitle1">Horario #{index + 1}</Typography>
                                    <IconButton
                                        onClick={() => handleRemoveSchedule(index)}
                                        color="error"
                                        size="small"
                                    >
                                        <Delete />
                                    </IconButton>
                                </div>
                                <TextField
                                    margin="dense"
                                    name="direction"
                                    label="Dirección (Ida / Regreso, etc.)"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={schedule.direction}
                                    onChange={(e) => handleScheduleChange(e, index)}
                                />
                                {/* Input de tipo 'time' para 'departureTime' */}
                                <TextField
                                    margin="dense"
                                    name="departureTime"
                                    label="Hora de Salida"
                                    type="time"
                                    fullWidth
                                    variant="outlined"
                                    value={schedule.departureTime}
                                    onChange={(e) => handleScheduleChange(e, index)}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    inputProps={{
                                        step: 300, // 5 minutos
                                    }}
                                />

                                {/* Paradas de este horario */}
                                <Typography variant="subtitle2" style={{ marginTop: '1rem' }}>
                                    Paradas
                                </Typography>
                                {schedule.stops && schedule.stops.map((stop, stopIndex) => (
                                    <div
                                        key={stopIndex}
                                        style={{
                                            display: 'flex',
                                            gap: '1rem',
                                            marginBottom: '0.5rem'
                                        }}
                                    >
                                        <TextField
                                            label="Dirección"
                                            variant="outlined"
                                            name="address"
                                            value={stop.address}
                                            onChange={(e) => handleStopChange(e, index, stopIndex)}
                                            style={{ flex: 1 }}
                                        />
                                        {/* Input de tipo 'time' para 'time' */}
                                        <TextField
                                            label="Hora"
                                            variant="outlined"
                                            name="time"
                                            type="time"
                                            value={stop.time}
                                            onChange={(e) => handleStopChange(e, index, stopIndex)}
                                            style={{ width: '150px' }}
                                            InputLabelProps={{
                                                shrink: true,
                                            }}
                                            inputProps={{
                                                step: 300, // 5 minutos
                                            }}
                                        />
                                        <IconButton
                                            onClick={() => handleRemoveStop(index, stopIndex)}
                                            color="error"
                                        >
                                            <Delete />
                                        </IconButton>
                                    </div>
                                ))}
                                <Button
                                    variant="contained"
                                    onClick={() => handleAddStop(index)}
                                    startIcon={<Add />}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    Agregar Parada
                                </Button>
                            </Paper>
                        ))}
                    {/* Botón para agregar un nuevo horario */}
                    <Button
                        variant="contained"
                        onClick={handleAddSchedule}
                        startIcon={<Add />}
                    >
                        Agregar Horario
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} color="primary" variant="contained">
                        {selectedRoute && selectedRoute.id ? 'Guardar Cambios' : 'Crear Ruta'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo para Ver el Mapa */}
            <Dialog open={openMapDialog} onClose={handleMapDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>Mapa de la Ruta: {selectedRoute?.name}</DialogTitle>
                <DialogContent>
                    {selectedRoute && <MapComponent route={selectedRoute} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleMapDialogClose} color="primary">
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar para mensajes */}
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
        </RoutesContainer>
    );
};

    export default RoutesManagementPage;
