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
import { Edit, Delete, Add } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

const BusesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const BusesManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [buses, setBuses] = useState([]);
    const [pilots, setPilots] = useState([]);
    const [selectedBus, setSelectedBus] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    const fetchBuses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/buses', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            console.log('Respuesta de /buses:', response.data);
            setBuses(Array.isArray(response.data.buses) ? response.data.buses : []);
            setLoading(false);
        } catch (err) {
            console.error('Error al obtener buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener los buses', severity: 'error' });
            setLoading(false);
        }
    };

    const fetchPilots = async () => {
        try {
            const response = await api.get('/users/pilots', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setPilots(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (err) {
            console.error('Error al obtener pilotos:', err);
        }
    };

    useEffect(() => {
        if (auth.token) {
            fetchBuses();
            fetchPilots();
        }
    }, [auth.token]);

    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: 0,
            description: '',
            pilotId: ''
        });
        setOpenDialog(true);
    };

    const handleEditClick = (bus) => {
        setSelectedBus({ ...bus });
        setOpenDialog(true);
    };

    const handleDeleteClick = async (busId) => {
        if (window.confirm('¿Estás seguro de eliminar este bus?')) {
            try {
                await api.delete(`/buses/${busId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus eliminado exitosamente', severity: 'success' });
                fetchBuses();
            } catch (err) {
                console.error('Error al eliminar bus:', err);
                setSnackbar({ open: true, message: 'Error al eliminar bus', severity: 'error' });
            }
        }
    };

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedBus(null);
    };

    const handleInputChange = (e) => {
        setSelectedBus({
            ...selectedBus,
            [e.target.name]: e.target.value,
        });
    };

    const handleSave = async () => {
        try {
            if (selectedBus.id) {
                // Update existing bus
                await api.put(`/buses/${selectedBus.id}`, selectedBus, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus actualizado exitosamente', severity: 'success' });
            } else {
                // Create new bus
                await api.post('/buses', selectedBus, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus creado exitosamente', severity: 'success' });
            }
            fetchBuses();
            handleDialogClose();
        } catch (err) {
            console.error('Error al guardar bus:', err);
            setSnackbar({ open: true, message: 'Error al guardar bus', severity: 'error' });
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

    const filteredBuses = buses.filter((bus) => {
        const pilotName = (bus.pilotName || '').toLowerCase();
        const plate = (bus.plate || '').toLowerCase();
        return (
            pilotName.includes(searchQuery.toLowerCase()) ||
            plate.includes(searchQuery.toLowerCase())
        );
    });

    return (
        <BusesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Buses
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar por placa o piloto"
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
                    onClick={handleAddBus}
                >
                    Añadir Bus
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
                                    <TableCell>Placa</TableCell>
                                    <TableCell>Piloto</TableCell>
                                    <TableCell>Capacidad</TableCell>
                                    <TableCell>Descripción</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredBuses
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((bus) => (
                                        <TableRow key={bus.id}>
                                            <TableCell>{bus.plate}</TableCell>
                                            <TableCell>{bus.pilotName || ''}</TableCell>
                                            <TableCell>{bus.capacity}</TableCell>
                                            <TableCell>{bus.description}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Editar">
                                                    <IconButton onClick={() => handleEditClick(bus)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton onClick={() => handleDeleteClick(bus.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                                {filteredBuses.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No se encontraron buses.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredBuses.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                        labelRowsPerPage="Filas por página"
                    />
                </Paper>
            )}

            {/* Diálogo para Crear/Editar Bus */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedBus && selectedBus.id ? 'Editar Bus' : 'Añadir Bus'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        name="plate"
                        label="Placa"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedBus ? selectedBus.plate : ''}
                        onChange={handleInputChange}
                        required
                    />
                    <TextField
                        margin="dense"
                        name="capacity"
                        label="Capacidad"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={selectedBus ? selectedBus.capacity : 0}
                        onChange={handleInputChange}
                    />
                    <TextField
                        margin="dense"
                        name="description"
                        label="Descripción"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedBus ? selectedBus.description : ''}
                        onChange={handleInputChange}
                    />
                    {/* Selección de Piloto */}
                    <FormControl variant="outlined" fullWidth margin="dense">
                        <InputLabel>Piloto Asignado</InputLabel>
                        <Select
                            name="pilotId"
                            value={selectedBus ? selectedBus.pilotId : ''}
                            onChange={handleInputChange}
                            label="Piloto Asignado"
                        >
                            <MenuItem value="">
                                <em>Seleccione un piloto</em>
                            </MenuItem>
                            {pilots.map((pilot) => (
                                <MenuItem key={pilot.id} value={pilot.id}>
                                    {pilot.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} color="primary" variant="contained">
                        {selectedBus && selectedBus.id ? 'Guardar Cambios' : 'Crear Bus'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </BusesContainer>
    );
};

export default BusesManagementPage;
