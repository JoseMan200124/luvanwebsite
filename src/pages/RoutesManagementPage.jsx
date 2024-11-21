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
    InputLabel,
} from '@mui/material';
import { Edit, Delete, Add, Map } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import axios from 'axios';
import styled from 'styled-components';
import tw from 'twin.macro';
// Import your map component
import MapComponent from '../components/MapComponent';

const RoutesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const RoutesManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [routes, setRoutes] = useState([]);
    const [schools, setSchools] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openMapDialog, setOpenMapDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const fetchRoutes = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/routes', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            console.log('Respuesta de la API (Rutas):', response.data); // Para depuración
            // Asegura que 'routes' sea siempre un array
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
            const response = await axios.get('/api/schools', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            console.log('Respuesta de la API (Colegios):', response.data); // Para depuración
            setSchools(Array.isArray(response.data.schools) ? response.data.schools : []);
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSnackbar({ open: true, message: 'Error al obtener los colegios', severity: 'error' });
        }
    };

    useEffect(() => {
        if (auth.token) { // Asegúrate de que auth.token esté definido
            fetchRoutes();
            fetchSchools();
        }
    }, [auth.token]);

    const handleEditClick = (route) => {
        setSelectedRoute(route);
        setOpenDialog(true);
    };

    const handleDeleteClick = async (routeId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar esta ruta?')) {
            try {
                await axios.delete(`/api/routes/${routeId}`, {
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

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedRoute(null);
    };

    const handleInputChange = (e) => {
        setSelectedRoute({
            ...selectedRoute,
            [e.target.name]: e.target.value,
        });
    };

    const handleSave = async () => {
        try {
            if (selectedRoute.id) {
                // Update existing route
                await axios.put(`/api/routes/${selectedRoute.id}`, selectedRoute, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Ruta actualizada exitosamente', severity: 'success' });
            } else {
                // Create new route
                await axios.post('/api/routes', selectedRoute, {
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

    const handleAddRoute = () => {
        setSelectedRoute({
            name: '',
            schoolId: '',
            driverName: '',
            busPlate: '',
            schedule: '',
            stops: [],
        });
        setOpenDialog(true);
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleViewMap = (route) => {
        setSelectedRoute(route);
        setOpenMapDialog(true);
    };

    const handleMapDialogClose = () => {
        setOpenMapDialog(false);
        setSelectedRoute(null);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Filtrar rutas basadas en la consulta de búsqueda
    const filteredRoutes = Array.isArray(routes) ? routes.filter((route) => {
        const schoolName = route.schoolName || '';
        return (
            route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            schoolName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }) : [];

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
                                    <TableCell>Piloto</TableCell>
                                    <TableCell>Placa del Bus</TableCell>
                                    <TableCell>Horario</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredRoutes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((route) => (
                                    <TableRow key={route.id}>
                                        <TableCell>{route.name}</TableCell>
                                        <TableCell>{route.schoolName}</TableCell>
                                        <TableCell>{route.driverName}</TableCell>
                                        <TableCell>{route.busPlate}</TableCell>
                                        <TableCell>{route.schedule}</TableCell>
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
                                        <TableCell colSpan={6} align="center">
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
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedRoute && selectedRoute.id ? 'Editar Ruta' : 'Añadir Ruta'}</DialogTitle>
                <DialogContent>
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
                            {Array.isArray(schools) && schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                    {school.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        margin="dense"
                        name="driverName"
                        label="Nombre del Piloto"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedRoute ? selectedRoute.driverName : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="busPlate"
                        label="Placa del Bus"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedRoute ? selectedRoute.busPlate : ''}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="schedule"
                        label="Horario"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedRoute ? selectedRoute.schedule : ''}
                        onChange={handleInputChange}
                    />
                    {/* Campos adicionales para paradas, etc. */}
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
                        {selectedRoute && selectedRoute.id ? 'Guardar Cambios' : 'Crear Ruta'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Diálogo para Ver el Mapa */}
            <Dialog open={openMapDialog} onClose={handleMapDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>Mapa de la Ruta: {selectedRoute?.name}</DialogTitle>
                <DialogContent>
                    {/* MapComponent debe mostrar las paradas y el recorrido de la ruta */}
                    {selectedRoute && <MapComponent route={selectedRoute} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleMapDialogClose} color="primary">
                        Cerrar
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
        </RoutesContainer>
    );

};

export default RoutesManagementPage;
