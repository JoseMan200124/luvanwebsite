// src/pages/BusesManagementPage.js

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
    InputLabel,
    FormControl,
    Select,
    MenuItem,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Link,
} from '@mui/material';
import { Edit, Delete, Add, InsertDriveFile, Image as ImageIcon } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';

const BusesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

const BusesManagementPage = () => {
    const { auth } = useContext(AuthContext);
    const [buses, setBuses] = useState([]);
    const [selectedBus, setSelectedBus] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [availablePilots, setAvailablePilots] = useState([]);

    // Función para obtener todos los buses
    const fetchBuses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/buses', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setBuses(Array.isArray(response.data.buses) ? response.data.buses : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener los buses', severity: 'error' });
            setLoading(false);
        }
    };

    // Función para obtener pilotos disponibles
    const fetchPilots = async () => {
        try {
            const response = await api.get('/users?role=Piloto', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            setAvailablePilots(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            // Manejar error o dejar pilotos vacíos
        }
    };

    useEffect(() => {
        fetchBuses();
        fetchPilots();
    }, [auth.token]);

    // Función para manejar la edición de un bus
    const handleEditClick = (bus) => {
        setSelectedBus(bus);
        setOpenDialog(true);
    };

    // Función para manejar la eliminación de un bus
    const handleDeleteClick = async (busId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este bus?')) {
            try {
                await api.delete(`/buses/${busId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus eliminado exitosamente', severity: 'success' });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting bus:', err);
                setSnackbar({ open: true, message: 'Error al eliminar el bus', severity: 'error' });
            }
        }
    };

    // Función para cerrar el diálogo
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedBus(null);
    };

    // Función para manejar cambios en los inputs del formulario
    const handleInputChange = (e) => {
        setSelectedBus({
            ...selectedBus,
            [e.target.name]: e.target.value,
        });
    };

    // Función para manejar cambios en los archivos
    const handleFileChange = (e) => {
        setSelectedBus({
            ...selectedBus,
            files: e.target.files,
        });
    };

    // Función para guardar (crear o actualizar) un bus
    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('plate', selectedBus.plate);
            formData.append('capacity', selectedBus.capacity);
            formData.append('description', selectedBus.description);
            if (selectedBus.pilotId) {
                formData.append('pilotId', selectedBus.pilotId);
            }
            if (selectedBus.files && selectedBus.files.length > 0) {
                Array.from(selectedBus.files).forEach(file => {
                    formData.append('files', file);
                });
            }

            if (selectedBus.id) {
                // Actualizar bus
                await api.put(`/buses/${selectedBus.id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus actualizado exitosamente', severity: 'success' });
            } else {
                // Crear bus
                await api.post('/buses', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Bus creado exitosamente', severity: 'success' });
            }

            fetchBuses();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving bus:', err);
            setSnackbar({ open: true, message: 'Error al guardar el bus', severity: 'error' });
        }
    };

    // Función para abrir el diálogo de creación de bus
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            pilotId: '',
            files: [],
        });
        setOpenDialog(true);
    };

    // Función para cerrar el Snackbar
    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // Función para manejar cambios en la búsqueda
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Función para manejar el cambio de página en la tabla
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    // Función para manejar el cambio en el número de filas por página
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Función para eliminar un archivo específico de un bus
    const handleDeleteFile = async (busId, fileId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este archivo?')) {
            try {
                await api.delete(`/buses/${busId}/files/${fileId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({ open: true, message: 'Archivo eliminado exitosamente', severity: 'success' });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting file:', err);
                setSnackbar({ open: true, message: 'Error al eliminar el archivo', severity: 'error' });
            }
        }
    };

    // Filtrar buses según la búsqueda
    const filteredBuses = buses.filter((bus) => {
        return (
            bus.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (bus.description && bus.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    });

    return (
        <BusesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Buses
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <TextField
                    label="Buscar buses"
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
                                    <TableCell>Capacidad</TableCell>
                                    <TableCell>Descripción</TableCell>
                                    <TableCell>Piloto</TableCell>
                                    <TableCell>Archivos</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredBuses.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((bus) => (
                                    <TableRow key={bus.id}>
                                        <TableCell>{bus.plate}</TableCell>
                                        <TableCell>{bus.capacity}</TableCell>
                                        <TableCell>{bus.description}</TableCell>
                                        <TableCell>{bus.pilotName}</TableCell>
                                        <TableCell>
                                            <List>
                                                {bus.files.map(file => (
                                                    <ListItem key={file.id}>
                                                        {file.fileType === 'application/pdf' ? <InsertDriveFile /> : <ImageIcon />}
                                                        <ListItemText>
                                                            <Link href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                {file.fileName.split('/').pop()}
                                                            </Link>
                                                        </ListItemText>
                                                        <ListItemSecondaryAction>
                                                            <Tooltip title="Eliminar Archivo">
                                                                <IconButton edge="end" onClick={() => handleDeleteFile(bus.id, file.id)}>
                                                                    <Delete />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </ListItemSecondaryAction>
                                                    </ListItem>
                                                ))}
                                                {bus.files.length === 0 && (
                                                    <Typography variant="body2" color="textSecondary">
                                                        No hay archivos.
                                                    </Typography>
                                                )}
                                            </List>
                                        </TableCell>
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
                                ))}
                                {filteredBuses.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
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
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedBus && selectedBus.id ? 'Editar Bus' : 'Añadir Bus'}</DialogTitle>
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
                        value={selectedBus ? selectedBus.capacity : ''}
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
                    <FormControl fullWidth margin="dense">
                        <InputLabel id="pilot-select-label">Piloto</InputLabel>
                        <Select
                            labelId="pilot-select-label"
                            name="pilotId"
                            value={selectedBus ? selectedBus.pilotId || '' : ''}
                            onChange={handleInputChange}
                            label="Piloto"
                        >
                            <MenuItem value="">
                                <em>Ninguno</em>
                            </MenuItem>
                            {availablePilots.map(pilot => (
                                <MenuItem key={pilot.id} value={pilot.id}>
                                    {pilot.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <input
                        accept="application/pdf,image/jpeg,image/png"
                        style={{ display: 'none' }}
                        id="file-input"
                        multiple
                        type="file"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-input">
                        <Button variant="outlined" color="primary" component="span" style={{ marginTop: '16px' }}>
                            Subir Archivos
                        </Button>
                    </label>
                    {selectedBus && selectedBus.files && selectedBus.files.length > 0 && (
                        <List>
                            {Array.from(selectedBus.files).map((file, index) => (
                                <ListItem key={index}>
                                    {file.type === 'application/pdf' ? <InsertDriveFile /> : <ImageIcon />}
                                    <ListItemText primary={file.name} />
                                </ListItem>
                            ))}
                        </List>
                    )}
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
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </BusesContainer>
    );
};

export default BusesManagementPage;
