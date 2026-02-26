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
    List,
    ListItem,
    ListItemText,
    Link,
    Box,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    useTheme,
    useMediaQuery,
    TableSortLabel
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
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
import * as XLSX from 'xlsx';

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
        case 'description':
            return bus.description;
        default:
            return '';
    }
}

// Devuelve una cadena representando la asignación del bus (colegio/corporación y número de ruta)
function getAssignmentText(bus) {
    if (!bus) return 'Sin asignar';
    const schoolName =
        bus.school?.name || bus.corporation?.name || '';
    const routeNumber = bus.routeNumber || bus.route || bus.route_num || '';
    if (!schoolName && !routeNumber) return 'Sin asignar';
    if (schoolName && routeNumber) return `${schoolName} — Ruta ${routeNumber}`;
    if (schoolName) return schoolName;
    return `Ruta ${routeNumber}`;
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
    const [clientFilter, setClientFilter] = useState(null); // {id, type}
    const [availabilityFilter, setAvailabilityFilter] = useState('all'); // all | assigned | unassigned
    const [inWorkshopFilter, setInWorkshopFilter] = useState('all'); // all | in | out
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);

    // Removed: Assignment-related state variables (pilots, monitors, schools, route numbers)
    // BusesManagementPage now only handles basic bus fleet management

    // Carga masiva
    const [openBulkDialog, setOpenBulkDialog] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Ordenamiento
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('');
    // Delete file dialog state
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteTargetIndex, setDeleteTargetIndex] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    

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
            const errorMessage = err.response?.data?.message || 'Error al obtener los buses';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch buses at mount
        fetchBuses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.token]);

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchBuses();
    }, [fetchBuses]);

    // Schedules are now tied to the Bus (school) and are fetched when the bus's school is selected

    // =================== CRUD Buses ===================
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            files: [],
            inWorkshop: false
        });
        setOpenDialog(true);
    };

    const handleEditClick = (bus) => {
        setSelectedBus({
            id: bus.id,
            plate: bus.plate,
            capacity: bus.capacity || '',
            description: bus.description || '',
            files: bus.files || [],
            inWorkshop: bus.inWorkshop || false
        });
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
                const errorMessage = err.response?.data?.message || 'Error al eliminar el bus';
                setSnackbar({
                    open: true,
                    message: errorMessage,
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
                    // reset input and stop
                    e.target.value = null;
                    return;
                }
            }
        }

        // Append newly selected files to existing ones so they don't disappear from the list
        setSelectedBus((prev) => {
            const existing = prev && prev.files ? Array.from(prev.files) : [];
            // Convert FileList to array and filter duplicates by name+size
            const newFiles = Array.from(files).filter((nf) => {
                return !existing.some((ef) => ef.name === nf.name && ef.size === nf.size);
            });
            return {
                ...prev,
                files: [...existing, ...newFiles]
            };
        });

        // reset the input so the same file can be selected again if needed
        e.target.value = null;
    };

    // Open confirm dialog to remove a file (local or server). The actual deletion runs in confirmRemoveFile.
    const handleRemoveFile = (file, index) => {
        setDeleteTarget(file);
        setDeleteTargetIndex(index);
        setOpenDeleteDialog(true);
    };

    // Perform the actual removal after confirmation
    const confirmRemoveFile = async () => {
        const file = deleteTarget;
        const index = deleteTargetIndex;
        if (!file) return;
        setDeleteLoading(true);

        // If file has an id, it's already on the server
        if (file && file.id) {
            // backend expects a busId in the route: DELETE /buses/:busId/files/:fileId
            if (!selectedBus || !selectedBus.id) {
                setSnackbar({ open: true, message: 'No se pudo determinar el bus para eliminar el archivo.', severity: 'error' });
                setDeleteLoading(false);
                setOpenDeleteDialog(false);
                setDeleteTarget(null);
                setDeleteTargetIndex(null);
                return;
            }
            try {
                await api.delete(`/buses/${selectedBus.id}/files/${file.id}`, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setSnackbar({ open: true, message: 'Archivo eliminado', severity: 'success' });
                // refresh the buses list so outer view stays in sync
                fetchBuses();
            } catch (err) {
                console.error('Error deleting file on server:', err);
                setSnackbar({ open: true, message: 'No se pudo eliminar el archivo en el servidor', severity: 'error' });
                setDeleteLoading(false);
                setOpenDeleteDialog(false);
                setDeleteTarget(null);
                setDeleteTargetIndex(null);
                return;
            }
        }

        // Remove locally (works for both existing and newly added files)
        setSelectedBus((prev) => {
            if (!prev) return prev;
            const filesArr = prev.files ? Array.from(prev.files) : [];
            if (typeof index === 'number') {
                filesArr.splice(index, 1);
            } else {
                const idx = filesArr.findIndex((f) => f === file || (f.id && file.id && file.id === f.id));
                if (idx !== -1) filesArr.splice(idx, 1);
            }
            return { ...prev, files: filesArr };
        });

        setDeleteLoading(false);
        setOpenDeleteDialog(false);
        setDeleteTarget(null);
        setDeleteTargetIndex(null);
    };

    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('plate', selectedBus.plate);
            formData.append('capacity', selectedBus.capacity);
            formData.append('description', selectedBus.description);
            formData.append('inWorkshop', selectedBus.inWorkshop);

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
            const errorMessage = err.response?.data?.message || 'Ocurrió un error al guardar el bus';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        }
    };

    // file delete endpoint left intentionally out of UI for now (server API exists). Use bus file deletion via server routes if needed.

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // =================== Búsqueda y filtros ===================
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // client filter is handled via Autocomplete onChange (sets `clientFilter` directly)

    const handleAvailabilityFilterChange = (e) => {
        setAvailabilityFilter(e.target.value);
        setPage(0);
    };

    const handleInWorkshopFilterChange = (e) => {
        setInWorkshopFilter(e.target.value);
        setPage(0);
    };

    // client options (schools + corporations) - loaded from API
    const [clientOptions, setClientOptions] = useState([]);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const [schoolsResp, corpsResp] = await Promise.all([
                    api.get('/schools', { headers: { Authorization: `Bearer ${auth.token}` } }),
                    api.get('/corporations', { headers: { Authorization: `Bearer ${auth.token}` } })
                ]);

                const schoolsList = schoolsResp.data?.schools || schoolsResp.data || [];
                const corpsList = corpsResp.data?.corporations || corpsResp.data || [];

                const combined = [];
                const pushIfValid = (item, type) => {
                    if (!item) return;
                    if (item.deleted) return;
                    const id = item.id || item._id || item.value || item.uuid || item.name;
                    const name = item.name || item.nombre || item.label || String(id);
                    combined.push({ id, name, _raw: item, type });
                };

                (Array.isArray(schoolsList) ? schoolsList : []).forEach((s) => pushIfValid(s, 'school'));
                (Array.isArray(corpsList) ? corpsList : []).forEach((c) => pushIfValid(c, 'corporation'));

                setClientOptions(combined);
            } catch (err) {
                console.error('Error loading clients for filters:', err);
            }
        };

        loadClients();
    }, [auth.token]);

    const filteredBuses = buses.filter((bus) => {
        const q = searchQuery.toLowerCase();
        const inPlate = bus.plate && bus.plate.toLowerCase().includes(q);
        const inDesc = bus.description && bus.description.toLowerCase().includes(q);
        if (!(inPlate || inDesc)) return false;

        // Client filter (match both id and type)
        if (clientFilter) {
            if (clientFilter.type === 'school') {
                const s = bus.school;
                if (!s) return false;
                const sid = s.id || s._id;
                if (String(sid) !== String(clientFilter.id)) return false;
            } else if (clientFilter.type === 'corporation') {
                const c = bus.corporation;
                if (!c) return false;
                const cid = c.id || c._id;
                if (String(cid) !== String(clientFilter.id)) return false;
            } else {
                return false;
            }
        }

        // availability: consider a bus 'assigned' if it has school/corporation or route
        const assigned = Boolean(bus.school || bus.corporation || bus.routeNumber || bus.route || bus.route_num);
        if (availabilityFilter === 'assigned' && !assigned) return false;
        if (availabilityFilter === 'unassigned' && assigned) return false;

        // inWorkshop filter
        if (inWorkshopFilter === 'in' && !bus.inWorkshop) return false;
        if (inWorkshopFilter === 'out' && bus.inWorkshop) return false;

        return true;
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
            const errorMessage = error.response?.data?.message || 'Ocurrió un error al procesar la carga masiva';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        }
        setBulkLoading(false);
    };

    // Función para descargar la plantilla personalizada de buses
    const handleDownloadTemplate = () => {
        // Simple template for basic bus information only
        const headers = [
            "Placa",
            "Capacidad", 
            "Descripción"
        ];
        const exampleRow = [
            "PlacaEjemplo",
            40,
            "Descripción de Ejemplo. Esta fila es solo un ejemplo."
        ];

        const data = [headers, exampleRow];

        // Create the spreadsheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Buses");

        // Download the file
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const fileName = `buses_template_${getFormattedDateTime()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

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
                    gap: '6px'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <TextField
                        label="Buscar buses"
                        variant="outlined"
                        size="small"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        sx={{ width: 200 }}
                    />

                    <Autocomplete
                        size="small"
                        options={clientOptions}
                        getOptionLabel={(opt) => opt.name || ''}
                        value={clientFilter ? clientOptions.find((o) => 
                            String(o.id) === String(clientFilter.id) && o.type === clientFilter.type
                        ) || null : null}
                        onChange={(e, newVal) => {
                            setClientFilter(newVal ? { id: newVal.id, type: newVal.type } : null);
                            setPage(0);
                        }}
                        isOptionEqualToValue={(option, value) => {
                            if (!value) return false;
                            return String(option.id) === String(value.id) && option.type === value.type;
                        }}
                        sx={{ minWidth: 160, width: 220 }}
                        renderInput={(params) => <TextField {...params} label="Cliente" />}
                    />

                    <FormControl size="small" sx={{ minWidth: 110 }}>
                        <InputLabel id="availability-filter-label">Disponibilidad</InputLabel>
                        <Select
                            labelId="availability-filter-label"
                            value={availabilityFilter}
                            label="Disponibilidad"
                            onChange={handleAvailabilityFilterChange}
                        >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="assigned">Asignados</MenuItem>
                            <MenuItem value="unassigned">Sin asignar</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 90 }}>
                        <InputLabel id="inworkshop-filter-label">Estado</InputLabel>
                        <Select
                            labelId="inworkshop-filter-label"
                            value={inWorkshopFilter}
                            label="Taller"
                            onChange={handleInWorkshopFilterChange}
                        >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="in">En taller</MenuItem>
                            <MenuItem value="out">Disponible</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                <div>
                    {/* Historial de rutas eliminado: botón removido */}
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
                                            <MobileLabel>Descripción</MobileLabel>
                                            <MobileValue>{bus.description}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Asignación</MobileLabel>
                                            <MobileValue>{getAssignmentText(bus)}</MobileValue>
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
                                            <TableCell>Asignación</TableCell>
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
                                                    <ResponsiveTableCell data-label="Descripción">
                                                        {bus.description}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Asignación">
                                                        {getAssignmentText(bus)}
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
                                                <ResponsiveTableCell colSpan={6} align="center">
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
                        name="description"
                        label="Descripción"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={selectedBus ? selectedBus.description : ''}
                        onChange={handleInputChange}
                    />

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
                                const isServerFile = !!file.id;
                                const label = isServerFile ? file.fileName.split('/').pop() : file.name;
                                return (
                                    <ListItem key={isServerFile ? `sf-${file.id}` : `nf-${index}`} disableGutters sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {isServerFile && file.fileType === 'application/pdf' ? (
                                                <InsertDriveFile />
                                            ) : !isServerFile && file.type === 'application/pdf' ? (
                                                <InsertDriveFile />
                                            ) : (
                                                <ImageIcon />
                                            )}
                                            {isServerFile ? (
                                                <ListItemText>
                                                    <Link href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        {label}
                                                    </Link>
                                                </ListItemText>
                                            ) : (
                                                <ListItemText primary={label} />
                                            )}
                                        </Box>
                                        <Box>
                                            <IconButton size="small" onClick={() => handleRemoveFile(file, index)} aria-label="Eliminar archivo">
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </ListItem>
                                );
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
                        Sube un archivo Excel/CSV con las columnas necesarias (Placa, Capacidad, Descripción). 
                        Usa la plantilla oficial.<br />
                        <br />
                        El límite de archivo es 5 MB.
                    </Typography>

                    <Button
                        variant="outlined"
                        color="success"
                        onClick={handleDownloadTemplate}
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

            {/* Confirmar eliminación de archivo */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Confirmar eliminación</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Estás seguro de que deseas eliminar este archivo? Esta acción no se puede deshacer.
                    </Typography>
                    {deleteTarget && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {deleteTarget.fileName ? deleteTarget.fileName.split('/').pop() : deleteTarget.name}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)} disabled={deleteLoading}>Cancelar</Button>
                    <Button onClick={confirmRemoveFile} variant="contained" color="error" disabled={deleteLoading}>
                        {deleteLoading ? 'Eliminando...' : 'Eliminar'}
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
            {/* RouteHistoryModal removed */}
        </BusesContainer>
    );
};

export default BusesManagementPage;
