// src/pages/BusesManagementPage.jsx

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
    Box,
    FormControlLabel,
    Switch,
    useTheme,
    useMediaQuery
} from '@mui/material';
import {
    Edit,
    Delete,
    Add,
    InsertDriveFile,
    Image as ImageIcon,
    FileUpload
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw from 'twin.macro';
import styled from 'styled-components';

// Estilo general del contenedor
const BusesContainer = tw.div`p-8 bg-gray-100 min-h-screen`;

/**
 * Función para formatear fecha/hora (para el nombre del archivo de plantilla, etc.)
 */
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

// ========================
// Estilos para vista desktop (tabla)
// ========================
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

// ========================
// Estilos para vista móvil (tarjetas)
// ========================
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

// ───────────────────────────────
// Componente Principal
// ───────────────────────────────
const BusesManagementPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const { auth } = useContext(AuthContext);

    const [buses, setBuses] = useState([]);
    const [selectedBus, setSelectedBus] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // Pilotos y Monitores disponibles
    const [availablePilots, setAvailablePilots] = useState([]);
    const [availableMonitors, setAvailableMonitors] = useState([]);

    // Carga masiva
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    /**
     * Cargar lista de Buses
     */
    const fetchBuses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/buses', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const data = response.data;
            setBuses(Array.isArray(data.buses) ? data.buses : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching buses:', err);
            setSnackbar({
                open: true,
                message: 'Error al obtener los buses',
                severity: 'error'
            });
            setLoading(false);
        }
    };

    /**
     * Cargar lista de pilotos y monitores
     */
    const fetchPilots = async () => {
        try {
            const response = await api.get('/users/pilots', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setAvailablePilots(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (err) {
            console.error('Error fetching pilots:', err);
        }
    };

    const fetchMonitors = async () => {
        try {
            const response = await api.get('/users/monitors', {
                headers: { Authorization: `Bearer ${auth.token}` }
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
            routeNumber: '',
            files: [],
            inWorkshop: false
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
            routeNumber: bus.routeNumber || '',
            files: bus.files || [],
            inWorkshop: bus.inWorkshop || false
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
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({
                    open: true,
                    message: 'Bus eliminado exitosamente',
                    severity: 'success'
                });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting bus:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar el bus',
                    severity: 'error'
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
     * Manejar cambios en el formulario
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedBus((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Manejar archivos subidos (para crear/editar un bus)
     */
    const handleFileChange = (e) => {
        const files = e.target.files;
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > maxSize) {
                    setSnackbar({
                        open: true,
                        message: `El archivo ${file.name} supera los 5 MB, por favor selecciona uno más pequeño.`,
                        severity: 'error'
                    });
                    e.target.value = null;
                    return;
                }
            }
        }

        // Si todos los archivos son válidos, los guardamos en el estado
        setSelectedBus((prev) => ({
            ...prev,
            files
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
            formData.append('routeNumber', selectedBus.routeNumber);
            formData.append('inWorkshop', selectedBus.inWorkshop);

            if (selectedBus.pilotId) {
                formData.append('pilotId', selectedBus.pilotId);
            }
            if (selectedBus.monitoraId) {
                formData.append('monitoraId', selectedBus.monitoraId);
            }

            if (selectedBus.files && selectedBus.files.length > 0) {
                Array.from(selectedBus.files).forEach((file) => {
                    if (!file.id) {
                        formData.append('files', file);
                    }
                });
            }

            if (selectedBus.id) {
                await api.put(`/buses/${selectedBus.id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`
                    }
                });
                setSnackbar({
                    open: true,
                    message: 'Bus actualizado exitosamente',
                    severity: 'success'
                });
            } else {
                await api.post('/buses', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${auth.token}`
                    }
                });
                setSnackbar({
                    open: true,
                    message: 'Bus creado exitosamente',
                    severity: 'success'
                });
            }

            fetchBuses();
            handleDialogClose();
        } catch (err) {
            console.error('Error saving bus:', err);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al guardar el bus',
                severity: 'error'
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
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({
                    open: true,
                    message: 'Archivo eliminado exitosamente',
                    severity: 'success'
                });
                fetchBuses();
            } catch (err) {
                console.error('Error deleting file:', err);
                setSnackbar({
                    open: true,
                    message: 'Error al eliminar el archivo',
                    severity: 'error'
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
     * Manejar búsqueda
     */
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    /**
     * Filtrar buses
     */
    const filteredBuses = buses.filter((bus) => {
        const inPlate = bus.plate.toLowerCase().includes(searchQuery.toLowerCase());
        const inDesc =
            bus.description && bus.description.toLowerCase().includes(searchQuery.toLowerCase());
        const inRouteNumber =
            bus.routeNumber && bus.routeNumber.toLowerCase().includes(searchQuery.toLowerCase());
        return inPlate || inDesc || inRouteNumber;
    });

    /**
     * Paginación
     */
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // ============== CARGA MASIVA ==============
    const handleOpenBulkDialog = () => {
        setBulkFile(null);
        setBulkResults(null);
        setOpenBulkDialog(true);
    };
    const handleCloseBulkDialog = () => {
        setOpenBulkDialog(false);
    };

    /**
     * Validar el tamaño del archivo de carga masiva
     */
    const handleBulkFileChange = (e) => {
        const file = e.target.files[0];
        const maxSize = 5 * 1024 * 1024; // 5 MB

        if (file && file.size > maxSize) {
            setSnackbar({
                open: true,
                message: `El archivo ${file.name} supera los 5 MB, por favor selecciona uno más pequeño.`,
                severity: 'error'
            });
            e.target.value = null;
            return;
        }

        setBulkFile(file);
    };

    const handleUploadBulk = async () => {
        if (!bulkFile) return;
        setBulkLoading(true);
        setBulkResults(null);

        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const resp = await api.post('/buses/bulk-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${auth.token}`
                }
            });
            setBulkResults(resp.data);
            fetchBuses();
        } catch (error) {
            console.error('Error al subir buses masivamente:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al procesar la carga masiva',
                severity: 'error'
            });
        }
        setBulkLoading(false);
    };

    const downloadFilename = `buses_template_${getFormattedDateTime()}.xlsx`;

    return (
        <BusesContainer>
            <Typography variant="h4" gutterBottom>
                Gestión de Buses
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                    gap: '8px'
                }}
            >
                <TextField
                    label="Buscar buses"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: '300px' }}
                />
                <div>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<FileUpload />}
                        sx={{ mr: 2 }}
                        onClick={handleOpenBulkDialog}
                    >
                        Carga Masiva
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={handleAddBus}
                    >
                        Añadir Bus
                    </Button>
                </div>
            </Box>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress />
                </div>
            ) : (
                <>
                    {isMobile ? (
                        <>
                            {filteredBuses
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((bus) => (
                                    <MobileCard key={bus.id} elevation={3}>
                                        <MobileField>
                                            <MobileLabel>Placa</MobileLabel>
                                            <MobileValue>{bus.plate}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Capacidad</MobileLabel>
                                            <MobileValue>{bus.capacity}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Número de Ruta</MobileLabel>
                                            <MobileValue>{bus.routeNumber || 'N/A'}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Ocupación</MobileLabel>
                                            <MobileValue>{bus.occupation || 0}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Descripción</MobileLabel>
                                            <MobileValue>{bus.description}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Piloto (Email)</MobileLabel>
                                            <MobileValue>{bus.pilot ? bus.pilot.email : ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Monitora (Email)</MobileLabel>
                                            <MobileValue>{bus.monitora ? bus.monitora.email : ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Estado</MobileLabel>
                                            <MobileValue>
                                                {bus.inWorkshop ? (
                                                    <Typography sx={{ color: 'red', fontWeight: 'bold' }}>
                                                        EN TALLER
                                                    </Typography>
                                                ) : (
                                                    'Disponible'
                                                )}
                                            </MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Archivos</MobileLabel>
                                            <MobileValue>
                                                {bus.files && bus.files.length > 0 ? (
                                                    <List disablePadding>
                                                        {bus.files.map((file) => {
                                                            const fileLabel = file.fileName.split('/').pop();
                                                            return (
                                                                <ListItem key={file.id} disableGutters sx={{ p: 0 }}>
                                                                    {file.fileType === 'application/pdf' ? (
                                                                        <InsertDriveFile sx={{ mr: 1 }} />
                                                                    ) : (
                                                                        <ImageIcon sx={{ mr: 1 }} />
                                                                    )}
                                                                    <Link
                                                                        href={file.fileUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        underline="hover"
                                                                        variant="body2"
                                                                    >
                                                                        {fileLabel}
                                                                    </Link>
                                                                </ListItem>
                                                            );
                                                        })}
                                                    </List>
                                                ) : (
                                                    'No hay archivos.'
                                                )}
                                            </MobileValue>
                                        </MobileField>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                gap: 1,
                                                marginTop: 1
                                            }}
                                        >
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
                                        </Box>
                                    </MobileCard>
                                ))}
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
                        </>
                    ) : (
                        <Paper>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Placa</TableCell>
                                            <TableCell>Capacidad</TableCell>
                                            <TableCell>Número de Ruta</TableCell>
                                            <TableCell>Ocupación</TableCell>
                                            <TableCell>Descripción</TableCell>
                                            <TableCell>Piloto (Email)</TableCell>
                                            <TableCell>Monitora (Email)</TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell sx={{ maxWidth: 200 }}>Archivos</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredBuses
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((bus) => (
                                                <TableRow key={bus.id}>
                                                    <ResponsiveTableCell data-label="Placa">{bus.plate}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Capacidad">{bus.capacity}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Número de Ruta">{bus.routeNumber || 'N/A'}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Ocupación">{bus.occupation || 0}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Descripción">{bus.description}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Piloto (Email)">{bus.pilot ? bus.pilot.email : ''}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Monitora (Email)">{bus.monitora ? bus.monitora.email : ''}</ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Estado">
                                                        {bus.inWorkshop ? (
                                                            <Typography sx={{ color: 'red', fontWeight: 'bold' }}>
                                                                EN TALLER
                                                            </Typography>
                                                        ) : (
                                                            'Disponible'
                                                        )}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Archivos" sx={{ maxWidth: 200, verticalAlign: 'top' }}>
                                                        <List disablePadding>
                                                            {bus.files.map((file) => {
                                                                const fileLabel = file.fileName.split('/').pop();
                                                                return (
                                                                    <ListItem key={file.id} disableGutters sx={{ p: 0 }}>
                                                                        {file.fileType === 'application/pdf' ? (
                                                                            <InsertDriveFile sx={{ mr: 1 }} />
                                                                        ) : (
                                                                            <ImageIcon sx={{ mr: 1 }} />
                                                                        )}
                                                                        <Tooltip title={fileLabel}>
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Link
                                                                                        href={file.fileUrl}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                    >
                                                                                        {fileLabel}
                                                                                    </Link>
                                                                                }
                                                                                primaryTypographyProps={{
                                                                                    noWrap: true,
                                                                                    sx: {
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                        maxWidth: '140px'
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </Tooltip>
                                                                    </ListItem>
                                                                );
                                                            })}
                                                            {bus.files.length === 0 && (
                                                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                                                    No hay archivos.
                                                                </Typography>
                                                            )}
                                                        </List>
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Acciones" align="center">
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
                                                    </ResponsiveTableCell>
                                                </TableRow>
                                            ))}
                                        {filteredBuses.length === 0 && (
                                            <TableRow>
                                                <ResponsiveTableCell colSpan={10} align="center">
                                                    No se encontraron buses.
                                                </ResponsiveTableCell>
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
                </>
            )}

            {/* Diálogo para crear/editar un bus */}
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
                        name="routeNumber"
                        label="Número de Ruta"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedBus ? selectedBus.routeNumber : ''}
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
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Piloto</InputLabel>
                        <Select
                            name="pilotId"
                            value={selectedBus ? selectedBus.pilotId || '' : ''}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    pilotId: e.target.value ? parseInt(e.target.value, 10) : null
                                }))
                            }
                        >
                            <MenuItem value="">
                                <em>Ninguno</em>
                            </MenuItem>
                            {availablePilots.map((pilot) => (
                                <MenuItem key={pilot.id} value={pilot.id}>
                                    {pilot.email}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Selección de Monitora */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Monitora</InputLabel>
                        <Select
                            name="monitoraId"
                            value={selectedBus ? selectedBus.monitoraId || '' : ''}
                            onChange={(e) =>
                                setSelectedBus((prev) => ({
                                    ...prev,
                                    monitoraId: e.target.value ? parseInt(e.target.value, 10) : null
                                }))
                            }
                        >
                            <MenuItem value="">
                                <em>Ninguna</em>
                            </MenuItem>
                            {availableMonitors.map((monitor) => (
                                <MenuItem key={monitor.id} value={monitor.id}>
                                    {monitor.email}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Switch para inWorkshop */}
                    <FormControlLabel
                        control={
                            <Switch
                                checked={selectedBus ? selectedBus.inWorkshop : false}
                                onChange={(e) =>
                                    setSelectedBus((prev) => ({
                                        ...prev,
                                        inWorkshop: e.target.checked
                                    }))
                                }
                                color="primary"
                            />
                        }
                        label="¿En taller?"
                        sx={{ mt: 1 }}
                    />

                    <input
                        accept="application/pdf,image/jpeg,image/png"
                        style={{ display: 'none' }}
                        id="file-input"
                        multiple
                        type="file"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-input">
                        <Button variant="outlined" color="primary" component="span" sx={{ mt: 2 }}>
                            Subir Archivos
                        </Button>
                    </label>

                    {selectedBus && selectedBus.files && selectedBus.files.length > 0 && (
                        <List sx={{ mt: 2 }}>
                            {[...selectedBus.files].map((file, index) => {
                                if (file.id) {
                                    return (
                                        <ListItem key={file.id} disableGutters>
                                            {file.fileType === 'application/pdf' ? (
                                                <InsertDriveFile />
                                            ) : (
                                                <ImageIcon />
                                            )}
                                            <ListItemText>
                                                <Link href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    {file.fileName.split('/').pop()}
                                                </Link>
                                            </ListItemText>
                                        </ListItem>
                                    );
                                } else {
                                    return (
                                        <ListItem key={index} disableGutters>
                                            {file.type === 'application/pdf' ? (
                                                <InsertDriveFile />
                                            ) : (
                                                <ImageIcon />
                                            )}
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

            {/* Diálogo para carga masiva */}
            <Dialog open={openBulkDialog} onClose={handleCloseBulkDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Carga Masiva de Buses</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Sube un archivo Excel/CSV con las columnas necesarias. Usa la plantilla oficial
                        (Columnas sugeridas: "Placa", "Capacidad", "Descripción", <strong>"Piloto"</strong>,{' '}
                        <strong>"Monitora"</strong>, "Número de Ruta"). El límite de archivo es 5 MB.
                    </Typography>

                    <Button
                        variant="outlined"
                        color="success"
                        href="/plantillas/plantilla_buses.xlsx"
                        download={downloadFilename}
                        sx={{ mr: 2 }}
                    >
                        Descargar Plantilla
                    </Button>

                    <Button variant="outlined" component="label" startIcon={<FileUpload />}>
                        Seleccionar Archivo
                        <input
                            type="file"
                            hidden
                            onChange={handleBulkFileChange}
                            accept=".xlsx, .xls, .csv"
                        />
                    </Button>
                    {bulkFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {bulkFile.name}
                        </Typography>
                    )}

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
                                    <strong>Buses creados/actualizados:</strong> {bulkResults.successCount}
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
