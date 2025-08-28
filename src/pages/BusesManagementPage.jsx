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
    TableSortLabel
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
        case 'routeNumber':
            return bus.routeNumber;
        case 'occupation':
            return bus.occupation;
        case 'school':
            return bus.school ? bus.school.name : '';
        case 'description':
            return bus.description;
        case 'pilot':
            return bus.pilot ? bus.pilot.name : '';
        case 'monitora':
            return bus.monitora ? bus.monitora.name : '';
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
    const [availableSchools, setAvailableSchools] = useState([]);
    const [originalPilots, setOriginalPilots] = useState([]);
    const [originalMonitors, setOriginalMonitors] = useState([]);

    // Bus schedule deprecated. No schedules managed per bus anymore.
    const [availableRouteNumbers, setAvailableRouteNumbers] = useState([]);

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

    const fetchPilots = async (schoolId = null) => {
        try {
            // Do not fetch all pilots when no school is selected. Requirement: only load after colegio chosen.
            if (!schoolId) {
                setOriginalPilots([]);
                setAvailablePilots([]);
                return;
            }

            const url = `/users/pilots?schoolId=${schoolId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            let pilots = Array.isArray(response.data.users) ? response.data.users : [];

            // For each pilot, obtain schedules for their school (usually same schoolId)
            const pilotsWithSchedules = await Promise.all(
                pilots.map(async (pilot) => {
                    if (!pilot.school) return { ...pilot, schedules: [] };
                    try {
                        const sid = parseInt(pilot.school, 10);
                        const resp = await api.get(`/schools/${sid}/schedules`, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        });
                        return { ...pilot, schedules: Array.isArray(resp.data.schedules) ? resp.data.schedules : [] };
                    } catch (err) {
                        return { ...pilot, schedules: [] };
                    }
                })
            );

            setOriginalPilots(pilotsWithSchedules);
            setAvailablePilots(pilotsWithSchedules);
        } catch (err) {
            console.error('Error fetching pilots:', err);
            setOriginalPilots([]);
            setAvailablePilots([]);
        }
    };

    const fetchMonitors = async (schoolId = null) => {
        try {
            // Only fetch monitors when a school is selected
            if (!schoolId) {
                setOriginalMonitors([]);
                setAvailableMonitors([]);
                return;
            }

            const url = `/users/monitors?schoolId=${schoolId}`;
            const response = await api.get(url, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const monitors = Array.isArray(response.data.users) ? response.data.users : [];
            setOriginalMonitors(monitors);
            setAvailableMonitors(monitors);
        } catch (err) {
            console.error('Error fetching monitors:', err);
            setOriginalMonitors([]);
            setAvailableMonitors([]);
        }
    };

    // When selected school's changed, fetch school schedules and filter pilots/monitors
    useEffect(() => {
        const schoolId = selectedBus?.schoolId;
        if (!selectedBus) return;

        const applySchoolFilter = async () => {
            // No per-bus schedules to fetch

            // Fetch school's route numbers
            if (schoolId) {
                try {
                    const rresp = await api.get(`/schools/${schoolId}`, { headers: { Authorization: `Bearer ${auth.token}` } });
                    const schoolData = rresp.data.school || rresp.data;
                    let routeNumbers = [];
                    if (Array.isArray(schoolData.routeNumbers)) routeNumbers = schoolData.routeNumbers;
                    else if (typeof schoolData.routeNumbers === 'string' && schoolData.routeNumbers.trim()) {
                        try { routeNumbers = JSON.parse(schoolData.routeNumbers); } catch { routeNumbers = []; }
                    }
                    setAvailableRouteNumbers(Array.isArray(routeNumbers) ? routeNumbers : []);
                } catch (err) {
                    console.error('Error fetching school route numbers:', err);
                    setAvailableRouteNumbers([]);
                }
            } else {
                setAvailableRouteNumbers([]);
            }

            // Ask server for pilots and monitors filtered by school to avoid client-side heavy filtering
            await Promise.all([fetchPilots(schoolId), fetchMonitors(schoolId)]);
            if (selectedBus.pilotId && !originalPilots.some(p => p.id === selectedBus.pilotId) && !availablePilots.some(p => p.id === selectedBus.pilotId)) {
                setSelectedBus(prev => ({ ...prev, pilotId: '', schedule: [] }));
            }
            if (selectedBus.monitoraId && !originalMonitors.some(m => m.id === selectedBus.monitoraId) && !availableMonitors.some(m => m.id === selectedBus.monitoraId)) {
                setSelectedBus(prev => ({ ...prev, monitoraId: '' }));
            }
        };

        applySchoolFilter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBus?.schoolId]);

    const fetchSchools = async () => {
        try {
            const resp = await api.get('/schools', { headers: { Authorization: `Bearer ${auth.token}` } });
            setAvailableSchools(Array.isArray(resp.data.schools) ? resp.data.schools : []);
        } catch (err) {
            console.error('Error fetching schools:', err);
        }
    };

    useEffect(() => {
        // Only fetch buses and schools at mount. Do NOT fetch pilots/monitors globally.
        fetchBuses();
        fetchSchools();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.token]);

    // Schedules are now tied to the Bus (school) and are fetched when the bus's school is selected

    // =================== CRUD Buses ===================
    const handleAddBus = () => {
        setSelectedBus({
            plate: '',
            capacity: '',
            description: '',
            pilotId: '',
            monitoraId: '',
            schoolId: null,
            routeNumber: '',
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
            pilotId: bus.pilotId || '',
            monitoraId: bus.monitoraId || '',
            schoolId: bus.school ? bus.school.id : null,
            routeNumber: bus.routeNumber || '',
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
            pilotId
        }));
    };

    // schedules removed

    // schedule removed

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

            // Append pilot/monitora explicitly so the server can clear them when user selects 'Ninguno'
            formData.append('pilotId', selectedBus.pilotId === '' || selectedBus.pilotId == null ? '' : selectedBus.pilotId);
            formData.append('monitoraId', selectedBus.monitoraId === '' || selectedBus.monitoraId == null ? '' : selectedBus.monitoraId);
            if (selectedBus.schoolId) {
                formData.append('schoolId', selectedBus.schoolId);
            }

            // no schedule

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

    // file delete endpoint left intentionally out of UI for now (server API exists). Use bus file deletion via server routes if needed.

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

    // Función para descargar la plantilla personalizada de buses
    const handleDownloadTemplate = () => {
        // 1. Prepara los datos de Pilotos y Monitoras (ID y Nombre en columnas separadas)
        const pilotos = availablePilots.map(p => [p.id, p.name]);
        const monitoras = availableMonitors.map(m => [m.id, m.name]);

        // 2. Prepara los horarios por piloto (cada horario en una columna distinta)
        let maxHorarios = 0;
        const pilotosConHorarios = availablePilots.map(p => {
            const horarios = Array.isArray(p.schedules)
                ? p.schedules.map(
                    sch => `${sch.name} - ${(sch.times || []).join(', ')}`
                )
                : [];
            if (horarios.length > maxHorarios) maxHorarios = horarios.length;
            return {
                id: p.id,
                name: p.name,
                horarios
            };
        });

        const horariosHeaders = [];
        for (let i = 1; i <= maxHorarios; i++) {
            horariosHeaders.push(`Horario ${i}`);
        }

        // 3. Define las columnas y una fila de ejemplo vacía
        const headers = [
            "Placa",
            "Capacidad",
            "Descripción",
            "Piloto (ID)",
            "Monitora (ID)",
            "Número de Ruta",
            "Horarios (Nombre - Día - Horas)"
        ];
        const exampleRow = [
            "PlacaEjemplo",
            40,
            "Descripción de Ejemplo. Esta fila es solo un ejemplo.",
            pilotos[0]?.[0] || "",
            monitoras[0]?.[0] || "",
            "R-01",
            pilotosConHorarios[0]?.horarios[0] || ""
        ];

        const data = [headers, exampleRow];

        // 4. Crea la hoja de cálculo principal
        const ws = XLSX.utils.aoa_to_sheet(data);

        // 5. Agrega una hoja con las listas de referencia (ID, Nombre, Horarios) en columnas separadas y con columnas en blanco entre bloques
        // Encuentra el máximo de filas para alinear verticalmente
        const maxRows = Math.max(
            pilotosConHorarios.length,
            monitoras.length
        );

        const wsListasData = [
            [
                "Pilotos (ID)", "Pilotos (Nombre)", ...horariosHeaders, "", // columna en blanco
                "Monitoras (ID)", "Monitoras (Nombre)"
            ]
        ];

        for (let i = 0; i < maxRows; i++) {
            wsListasData.push([
                pilotosConHorarios[i]?.id ?? "", pilotosConHorarios[i]?.name ?? "",
                ...(pilotosConHorarios[i]?.horarios ?? []),
                ...Array(maxHorarios - (pilotosConHorarios[i]?.horarios?.length || 0)).fill(""),
                "", // columna en blanco
                monitoras[i]?.[0] ?? "", monitoras[i]?.[1] ?? ""
            ]);
        }

        const wsLists = XLSX.utils.aoa_to_sheet(wsListasData);

        // Ajusta el ancho de cada columna de la hoja Listas
        const cols = [
            { wch: Math.max("Pilotos (ID)".length + 2, 15) },
            { wch: Math.max("Pilotos (Nombre)".length + 2, 20) },
            ...horariosHeaders.map(h => ({ wch: Math.max(h.length + 2, 20) })),
            { wch: 2 }, // columna en blanco
            { wch: Math.max("Monitoras (ID)".length + 2, 15) },
            { wch: Math.max("Monitoras (Nombre)".length + 2, 20) }
        ];
        wsLists['!cols'] = cols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Buses");
        XLSX.utils.book_append_sheet(wb, wsLists, "Listas");

        // 6. Descarga el archivo
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
                                            <MobileLabel>Colegio</MobileLabel>
                                            <MobileValue>{bus.school ? bus.school.name : 'N/A'}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Descripción</MobileLabel>
                                            <MobileValue>{bus.description}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Piloto</MobileLabel>
                                            <MobileValue>{bus.pilot ? bus.pilot.name : ''}</MobileValue>
                                        </MobileField>
                                        <MobileField>
                                            <MobileLabel>Monitora</MobileLabel>
                                            <MobileValue>{bus.monitora ? bus.monitora.name : ''}</MobileValue>
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
                        <TableCell sortDirection={orderBy === 'school' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'school'}
                                                    direction={orderBy === 'school' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('school')}
                                                    hideSortIcon={false}
                                                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                                                >
                            Colegio
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
                                                    Piloto
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
                                                    Monitora
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
                                                    <ResponsiveTableCell data-label="Colegio">
                                                        {bus.school ? bus.school.name : 'N/A'}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Descripción">
                                                        {bus.description}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Piloto">
                                                        {bus.pilot ? bus.pilot.name : ''}
                                                    </ResponsiveTableCell>
                                                    <ResponsiveTableCell data-label="Monitora">
                                                        {bus.monitora ? bus.monitora.name : ''}
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
                    {/* Selección de Colegio */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Colegio</InputLabel>
                        <Select
                            name="schoolId"
                            value={selectedBus ? selectedBus.schoolId || '' : ''}
                            onChange={(e) => setSelectedBus(prev => ({ ...prev, schoolId: e.target.value ? parseInt(e.target.value, 10) : null }))}
                        >
                            <MenuItem value="">
                                <em>Global / Ninguno</em>
                            </MenuItem>
                            {availableSchools.map((s) => (
                                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {/* Selección de Número de Ruta basada en los números del colegio seleccionado */}
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Número de Ruta</InputLabel>
                        <Select
                            name="routeNumber"
                            value={selectedBus ? selectedBus.routeNumber || '' : ''}
                            onChange={(e) => setSelectedBus(prev => ({ ...prev, routeNumber: e.target.value }))}
                        >
                            <MenuItem value="">
                                <em>Sin asignar</em>
                            </MenuItem>
                            {availableRouteNumbers && availableRouteNumbers.length > 0 ? (
                                // Filter out route numbers already taken by other buses in the same school
                                availableRouteNumbers
                                    .filter((rn) => {
                                        // if route not used by any bus in same school, keep it
                                        const usedByOther = buses.some(b => b.school && b.school.id === selectedBus?.schoolId && b.routeNumber === rn && b.id !== selectedBus?.id);
                                        return !usedByOther || rn === selectedBus?.routeNumber;
                                    })
                                    .map((rn, idx) => (
                                        <MenuItem key={idx} value={rn}>{rn}</MenuItem>
                                    ))
                            ) : (
                                <MenuItem disabled value="">
                                    No hay números de ruta definidos para este colegio
                                </MenuItem>
                            )}
                        </Select>
                    </FormControl>
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
                                    // Use empty string when 'Ninguna' is selected so we can explicitly clear on the server
                                    monitoraId: e.target.value ? parseInt(e.target.value, 10) : ''
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

                    {/* Horarios por bus eliminados; se manejan por colegio/ruta */}

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
                        Sube un archivo Excel/CSV con las columnas necesarias. Usa la plantilla oficial.<br />
                        <br />
                        Las listas de Pilotos, Monitoras y Horarios están en la hoja "Listas" de la plantilla.<br />
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
