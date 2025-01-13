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

    // Pilotos disponibles
    const [availablePilots, setAvailablePilots] = useState([]);
    // Monitores disponibles
    const [availableMonitors, setAvailableMonitors] = useState([]);

    /**
     * Cargar lista de Buses
     */
    const fetchBuses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/buses', {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            const data = response.data;
            setBuses(Array.isArray(data.buses) ? data.buses : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({ open: true, message: 'Error al obtener los buses', severity: 'error' });
            setLoading(false);
        }
    };

    /**
     * Cargar lista de pilotos (role=Piloto)
     */
    const fetchPilots = async () => {
        try {
            // Endpoint para obtener los pilotos
            const response = await api.get('/users/pilots', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setAvailablePilots(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (err) {
            console.error('Error fetching pilots:', err);
        }
    };

    /**
     * Cargar lista de monitores (role=Monitora)
     */
    const fetchMonitors = async () => {
        try {
            // Endpoint para obtener monitores
            const response = await api.get('/users/monitors', {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            setAvailableMonitors(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (err) {
            console.error('Error fetching monitors:', err);
        }
    };

    useEffect(() => {
        fetchBuses();
        fetchPilots();
        fetchMonitors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.token]);

    /**
     * Abrir diálogo para crear un nuevo bus
     */
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            pilotId: '',
            monitoraId: '',
            files: [],
        });
        setOpenDialog(true);
    };

    /**
     * Seleccionar un bus para editarlo
     */
    const handleEditClick = (bus) => {
        setSelectedBus({
            id: bus.id,
            plate: bus.plate,
            capacity: bus.capacity || '',
            description: bus.description || '',
            pilotId: bus.pilotId || '',
            monitoraId: bus.monitoraId || '',
            files: bus.files || [],
        });
        setOpenDialog(true);
    };

    /**
     * Eliminar un bus
     */
    const handleDeleteClick = async (busId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este bus?')) {
            try {
                await api.delete(`/buses/${busId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({
                    open: true,
                    message: 'Bus eliminado exitosamente',
                    severity: 'success',
                });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting bus:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar el bus',
                    severity: 'error',
                });
            }
        }
    };

    /**
     * Cerrar diálogo
     */
    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedBus(null);
    };

    /**
     * Manejar cambios en el formulario (inputs)
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedBus((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    /**
     * Manejar archivos subidos en <input type="file" />
     */
    const handleFileChange = (e) => {
        setSelectedBus((prev) => ({
            ...prev,
            files: e.target.files,
        }));
    };

    /**
     * Guardar el bus (crear o actualizar)
     */
    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('plate', selectedBus.plate);
            formData.append('capacity', selectedBus.capacity);
            formData.append('description', selectedBus.description);

            if (selectedBus.pilotId) {
                formData.append('pilotId', selectedBus.pilotId);
            }
            if (selectedBus.monitoraId) {
                formData.append('monitoraId', selectedBus.monitoraId);
            }

            if (selectedBus.files && selectedBus.files.length > 0) {
                // Subir sólo los archivos nuevos (File objects)
                Array.from(selectedBus.files).forEach((file) => {
                    if (!file.id) {
                        formData.append('files', file);
                    }
                });
            }

            if (selectedBus.id) {
                // Update
                await api.put(`/buses/${selectedBus.id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({
                    open: true,
                    message: 'Bus actualizado exitosamente',
                    severity: 'success',
                });
            } else {
                // Create
                await api.post('/buses', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({
                    open: true,
                    message: 'Bus creado exitosamente',
                    severity: 'success',
                });
            }

            fetchBuses();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving bus:', err);
            setSnackbar({
                open: true,
                message: 'Error al guardar el bus',
                severity: 'error',
            });
        }
    };

    /**
     * Eliminar un archivo específico de un bus
     */
    const handleDeleteFile = async (busId, fileId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este archivo?')) {
            try {
                await api.delete(`/buses/${busId}/files/${fileId}`, {
                    headers: {
                        Authorization: `Bearer ${auth.token}`,
                    },
                });
                setSnackbar({
                    open: true,
                    message: 'Archivo eliminado exitosamente',
                    severity: 'success',
                });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting file:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar el archivo',
                    severity: 'error',
                });
            }
        }
    };

    /**
     * Cerrar Snackbar
     */
    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    /**
     * Manejar cambios en la búsqueda
     */
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    /**
     * Filtrar buses según la búsqueda
     */
    const filteredBuses = buses.filter((bus) => {
        const inPlate = bus.plate.toLowerCase().includes(searchQuery.toLowerCase());
        const inDesc = bus.description && bus.description.toLowerCase().includes(searchQuery.toLowerCase());
        return inPlate || inDesc;
    });

    /**
     * Manejar cambio de página en la tabla
     */
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    /**
     * Manejar cambio de rowsPerPage
     */
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

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
                                    <TableCell>Monitora</TableCell>
                                    <TableCell>Archivos</TableCell>
                                    <TableCell align="center">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredBuses
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((bus) => (
                                        <TableRow key={bus.id}>
                                            <TableCell>{bus.plate}</TableCell>
                                            <TableCell>{bus.capacity}</TableCell>
                                            <TableCell>{bus.description}</TableCell>
                                            {/* MOSTRAR NOMBRE DEL PILOTO si existe */}
                                            <TableCell>
                                                {bus.pilot ? bus.pilot.name : ''}
                                            </TableCell>
                                            {/* MOSTRAR NOMBRE DE LA MONITORA si existe */}
                                            <TableCell>
                                                {bus.monitora ? bus.monitora.name : ''}
                                            </TableCell>
                                            <TableCell>
                                                <List>
                                                    {bus.files.map(file => (
                                                        <ListItem key={file.id}>
                                                            {file.fileType === 'application/pdf'
                                                                ? <InsertDriveFile />
                                                                : <ImageIcon />
                                                            }
                                                            <ListItemText>
                                                                <Link
                                                                    href={file.fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    {file.fileName.split('/').pop()}
                                                                </Link>
                                                            </ListItemText>
                                                            <ListItemSecondaryAction>
                                                                <Tooltip title="Eliminar Archivo">
                                                                    <IconButton
                                                                        edge="end"
                                                                        onClick={() => handleDeleteFile(bus.id, file.id)}
                                                                    >
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
                                        <TableCell colSpan={7} align="center">
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

            {/* Diálogo de Crear/Editar Bus */}
            <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
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

                    {/* SELECT PILOTO */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel id="pilot-select-label">Piloto</InputLabel>
                        <Select
                            labelId="pilot-select-label"
                            name="pilotId"
                            value={selectedBus ? (selectedBus.pilotId || '') : ''}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    pilotId: e.target.value ? parseInt(e.target.value, 10) : null,
                                }))
                            }
                            label="Piloto"
                        >
                            <MenuItem value="">
                                <em>Ninguno</em>
                            </MenuItem>
                            {availablePilots.map((pilot) => (
                                <MenuItem key={pilot.id} value={pilot.id}>
                                    {pilot.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* SELECT MONITORA */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel id="monitora-select-label">Monitora</InputLabel>
                        <Select
                            labelId="monitora-select-label"
                            name="monitoraId"
                            value={selectedBus ? (selectedBus.monitoraId || '') : ''}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    monitoraId: e.target.value ? parseInt(e.target.value, 10) : null,
                                }))
                            }
                            label="Monitora"
                        >
                            <MenuItem value="">
                                <em>Ninguna</em>
                            </MenuItem>
                            {availableMonitors.map((monitor) => (
                                <MenuItem key={monitor.id} value={monitor.id}>
                                    {monitor.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* INPUT DE ARCHIVOS */}
                    <input
                        accept="application/pdf,image/jpeg,image/png"
                        style={{ display: 'none' }}
                        id="file-input"
                        multiple
                        type="file"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-input">
                        <Button
                            variant="outlined"
                            color="primary"
                            component="span"
                            style={{ marginTop: '16px' }}
                        >
                            Subir Archivos
                        </Button>
                    </label>

                    {/* LISTA DE ARCHIVOS (si existen) */}
                    {selectedBus && selectedBus.files && selectedBus.files.length > 0 && (
                        <List sx={{ mt: 2 }}>
                            {[...selectedBus.files].map((file, index) => {
                                if (file.id) {
                                    // archivo existente
                                    return (
                                        <ListItem key={file.id}>
                                            {file.fileType === 'application/pdf'
                                                ? <InsertDriveFile />
                                                : <ImageIcon />
                                            }
                                            <ListItemText>
                                                <Link
                                                    href={file.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {file.fileName.split('/').pop()}
                                                </Link>
                                            </ListItemText>
                                        </ListItem>
                                    );
                                } else {
                                    // archivo recién adjuntado
                                    return (
                                        <ListItem key={index}>
                                            {file.type === 'application/pdf'
                                                ? <InsertDriveFile />
                                                : <ImageIcon />
                                            }
                                            <ListItemText primary={file.name} />
                                        </ListItem>
                                    );
                                }
                            })}
                        </List>
                    )}
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
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </BusesContainer>
    );
};

export default BusesManagementPage;
