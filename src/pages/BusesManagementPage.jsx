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
    Link,
    Box,
    FormControlLabel,
    Switch,
    useTheme,
    useMediaQuery,
    TableSortLabel,
    Checkbox
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

// ======== Estilos para vista desktop (tabla) ========
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

// ======== Estilos para vista móvil (tarjetas) ========
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

/* =================== Código para ordenamiento =================== */
function descendingComparator(a, b, orderBy) {
    const aValue = getFieldValue(a, orderBy);
    const bValue = getFieldValue(b, orderBy);

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
        return bValue.localeCompare(aValue);
    }
    if (bValue < aValue) return -1;
    if (bValue > aValue) return 1;
    return 0;
}

function getComparator(order, orderBy) {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

function getFieldValue(bus, field) {
    switch (field) {
        case 'plate':
            return bus.plate;
        case 'capacity':
            return bus.capacity;
        case 'routeNumber':
            return bus.routeNumber;
        case 'occupation':
            return bus.occupation;
        case 'description':
            return bus.description;
        case 'pilot':
            return bus.pilot ? bus.pilot.email : '';
        case 'monitora':
            return bus.monitora ? bus.monitora.email : '';
        default:
            return '';
    }
}
/* =================== Fin código para ordenamiento =================== */

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

    // Pilotos y Monitores
    const [availablePilots, setAvailablePilots] = useState([]);
    const [availableMonitors, setAvailableMonitors] = useState([]);

    // Horarios disponibles (según el colegio del piloto)
    const [availableSchedules, setAvailableSchedules] = useState([]);

    // Carga masiva
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Ordenamiento
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('');

    // =================== Efectos y funciones ===================
    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

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

    const fetchSchedulesByPilot = async (pilotId) => {
        try {
            const pilot = availablePilots.find((p) => p.id === pilotId);
            if (!pilot || !pilot.school) {
                setAvailableSchedules([]);
                return;
            }
            const schoolId = parseInt(pilot.school, 10);
            if (!schoolId) {
                setAvailableSchedules([]);
                return;
            }

            const resp = await api.get(`/schools/${schoolId}/schedules`, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            if (resp.data && Array.isArray(resp.data.schedules)) {
                setAvailableSchedules(resp.data.schedules);
            } else {
                setAvailableSchedules([]);
            }
        } catch (error) {
            console.error('Error fetching schedules:', error);
            setAvailableSchedules([]);
        }
    };

    // =================== CRUD Buses ===================
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            pilotId: '',
            monitoraId: '',
            routeNumber: '',
            files: [],
            inWorkshop: false,
            schedule: [] // <-- Array de varios horarios
        });
        setAvailableSchedules([]);
        setOpenDialog(true);
    };

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
            inWorkshop: bus.inWorkshop || false,
            // schedule ahora será un array, si es null lo convertimos en []
            schedule: Array.isArray(bus.schedule) ? bus.schedule : (bus.schedule ? [bus.schedule] : [])
        });
        if (bus.pilotId) {
            fetchSchedulesByPilot(bus.pilotId);
        } else {
            setAvailableSchedules([]);
        }
        setOpenDialog(true);
    };

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

    const handleDialogClose = () => {
        setOpenDialog(false);
        setSelectedBus(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedBus((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Al cambiar piloto, recargamos horarios
     */
    const handlePilotChange = async (e) => {
        const pilotId = e.target.value ? parseInt(e.target.value, 10) : '';
        setSelectedBus((prev) => ({
            ...prev,
            pilotId,
            schedule: [] // Resetear la selección de horarios
        }));
        if (pilotId) {
            await fetchSchedulesByPilot(pilotId);
        } else {
            setAvailableSchedules([]);
        }
    };

    /**
     * NUEVA forma de manejar la MULTI-SELECCIÓN de horarios:
     * Guardamos la estructura completa { day, times, name } en selectedBus.schedule.
     */
    const handleScheduleChange = (e) => {
        // e.target.value será un array de strings, cada string es la representación JSON de un horario
        const newSchedules = e.target.value.map((val) => JSON.parse(val));
        setSelectedBus((prev) => ({ ...prev, schedule: newSchedules }));
    };

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

        setSelectedBus((prev) => ({
            ...prev,
            files
        }));
    };

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

            // schedule es un array, lo guardamos en JSON
            if (selectedBus.schedule && Array.isArray(selectedBus.schedule)) {
                formData.append('schedule', JSON.stringify(selectedBus.schedule));
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

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // =================== Búsqueda y filtros ===================
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const filteredBuses = buses.filter((bus) => {
        const inPlate = bus.plate.toLowerCase().includes(searchQuery.toLowerCase());
        const inDesc =
            bus.description && bus.description.toLowerCase().includes(searchQuery.toLowerCase());
        const inRouteNumber =
            bus.routeNumber && bus.routeNumber.toLowerCase().includes(searchQuery.toLowerCase());
        return inPlate || inDesc || inRouteNumber;
    });

    // =================== Paginación ===================
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

    // Aplicar ordenamiento
    const sortedBuses = stableSort(filteredBuses, getComparator(order, orderBy));

    // =================== RENDER ===================
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
                            {sortedBuses
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
                                count={sortedBuses.length}
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
                                            <TableCell sortDirection={orderBy === 'plate' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'plate'}
                                                    direction={orderBy === 'plate' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('plate')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Placa
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'capacity' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'capacity'}
                                                    direction={orderBy === 'capacity' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('capacity')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Capacidad
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'routeNumber' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'routeNumber'}
                                                    direction={orderBy === 'routeNumber' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('routeNumber')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Número de Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'occupation' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'occupation'}
                                                    direction={orderBy === 'occupation' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('occupation')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Ocupación
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'description' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'description'}
                                                    direction={orderBy === 'description' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('description')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Descripción
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'pilot' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'pilot'}
                                                    direction={orderBy === 'pilot' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('pilot')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Piloto (Email)
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'monitora' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'monitora'}
                                                    direction={orderBy === 'monitora' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('monitora')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                                                    Monitora (Email)
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell sx={{ maxWidth: 200 }}>Archivos</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sortedBuses
                                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                            .map((bus) => (
                                                <TableRow key={bus.id}>
                                                    <ResponsiveTableCell data-label="Placa">
                                                        {bus.plate}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Capacidad">
                                                        {bus.capacity}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Número de Ruta">
                                                        {bus.routeNumber || 'N/A'}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Ocupación">
                                                        {bus.occupation || 0}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Descripción">
                                                        {bus.description}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Piloto (Email)">
                                                        {bus.pilot ? bus.pilot.email : ''}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Monitora (Email)">
                                                        {bus.monitora ? bus.monitora.email : ''}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Estado">
                                                        {bus.inWorkshop ? (
                                                            <Typography sx={{ color: 'red', fontWeight: 'bold' }}>
                                                                EN TALLER
                                                            </Typography>
                                                        ) : (
                                                            'Disponible'
                                                        )}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell
                                                        data-label="Archivos"
                                                        sx={{ maxWidth: 200, verticalAlign: 'top' }}
                                                    >
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
                                                                <Typography
                                                                    variant="body2"
                                                                    color="textSecondary"
                                                                    sx={{ fontStyle: 'italic' }}
                                                                >
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
                                        {sortedBuses.length === 0 && (
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
                                count={sortedBuses.length}
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
                            onChange={handlePilotChange}
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

                    {/* MULTI-SELECCIÓN de horarios con day, times, name */}
                    <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
                        <InputLabel>Horarios (puede seleccionar varios)</InputLabel>
                        <Select
                            multiple
                            name="schedule"
                            value={
                                selectedBus?.schedule
                                    ? selectedBus.schedule.map((sch) => JSON.stringify(sch))
                                    : []
                            }
                            onChange={handleScheduleChange}
                            renderValue={(selected) =>
                                selected
                                    .map((val) => {
                                        const sch = JSON.parse(val);
                                        return `${sch.name} - ${sch.day} - ${sch.times.join(', ')}`;
                                    })
                                    .join(', ')
                            }
                        >
                            {availableSchedules.map((sch, idx) => {
                                const valueKey = JSON.stringify(sch);
                                const label = `${sch.name} - ${sch.day} - ${(sch.times || []).join(', ')}`;
                                const isChecked = selectedBus?.schedule
                                    ? selectedBus.schedule.some(
                                        (s) =>
                                            s.name === sch.name &&
                                            s.day === sch.day &&
                                            JSON.stringify(s.times) === JSON.stringify(sch.times)
                                    )
                                    : false;

                                return (
                                    <MenuItem key={idx} value={valueKey}>
                                        <Checkbox checked={isChecked} />
                                        <ListItemText primary={label} />
                                    </MenuItem>
                                );
                            })}
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
                                    // Archivos que ya existen en el servidor
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
                                    // Archivos recién seleccionados (File objeto en memoria)
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
