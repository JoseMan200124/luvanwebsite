// src/pages/FuelRecordsPage.jsx

import React, { useEffect, useState } from 'react';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TableSortLabel,
    CircularProgress,
    Box,
    Grid,
    Card,
    CardContent,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Autocomplete,
    TextField,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { 
    Refresh as RefreshIcon, 
    Visibility as VisibilityIcon,
    LocalGasStation as GasIcon 
} from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { 
    getFuelRecords, 
    getFuelStatistics, 
    getFuelRecordById,
    createFuelRecordWeb,
    FUELING_REASONS,
    FUEL_TYPES
} from '../services/fuelRecordService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const FuelRecordsPage = () => {
    const [fuelRecords, setFuelRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);
    // Ordenamiento
    const [orderBy, setOrderBy] = useState('recordDate');
    const [order, setOrder] = useState('desc');

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [pilots, setPilots] = useState([]);
    const [clientRouteNumbers, setClientRouteNumbers] = useState([]);
    // selectedClient format: '' | 'school-<id>' | 'corp-<id>'
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedFuelType, setSelectedFuelType] = useState('');
    const [selectedFuelingReason, setSelectedFuelingReason] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Crear registro
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        fuelingReason: '',
        fuelType: '',
        client: '', // format: 'school-<id>' or 'corp-<id>'
        busId: '',
        pilotId: '',
        routeNumber: '',
        pricePerGallon: '',
        gallonage: '',
        recordDateDate: moment(),
        recordDateTime: moment().format('hh:mm A'),
        notes: ''
    });

    // Estadísticas
    const [statistics, setStatistics] = useState({
        totalRecords: 0,
        totalGallons: 0,
        totalAmount: 0,
        averagePrice: 0,
        byReason: {},
    });

    useEffect(() => {
        fetchSchools();
        fetchCorporations();
        fetchBusesBySchool();
        fetchPilots();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchPilots = async () => {
        try {
            const response = await api.get('/users/pilots');
            const pilotsData = Array.isArray(response.data?.users) ? response.data.users : (response.data || []);
            setPilots(pilotsData);
        } catch (error) {
            console.error('Error al cargar pilotos:', error);
            setPilots([]);
        }
    };

    // No dependemos del colegio para las placas; cargamos todos los buses al montar.

    useEffect(() => {
        fetchFuelRecords();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedClient, selectedPlate, selectedRoute, selectedFuelingReason, selectedFuelType, startDate, endDate, orderBy, order]);

    const fetchSchools = async () => {
        try {
            const response = await api.get('/schools');
            const schoolsData = Array.isArray(response.data) ? response.data : (response.data?.schools || []);
            setSchools(schoolsData);
        } catch (error) {
            console.error('Error al cargar colegios:', error);
            setSchools([]);
        }
    };

    const fetchBusesBySchool = async (schoolId) => {
        try {
            // Si no se pasa schoolId, traemos todos los buses para permitir seleccionar placa independientemente.
            const url = schoolId ? `/buses/school/${schoolId}` : '/buses';
            const response = await api.get(url);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchCorporations = async () => {
        try {
            const response = await api.get('/corporations');
            const corporationsData = Array.isArray(response.data) ? response.data : (response.data?.corporations || []);
            setCorporations(corporationsData);
        } catch (error) {
            console.error('Error al cargar corporaciones:', error);
            setCorporations([]);
        }
    };

    const fetchBusesByCorporation = async (corporationId) => {
        try {
            const url = corporationId ? `/buses/corporation/${corporationId}` : '/buses';
            const response = await api.get(url);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    // Opciones de cliente (colegios + corporaciones) y placas
    const clientOptions = [
        ...schools.map(s => ({ label: `${s.name} (Colegio)`, value: `school-${s.id}`, type: 'school', id: s.id })),
        ...corporations.map(c => ({ label: `${c.name} (Corporación)`, value: `corp-${c.id}`, type: 'corp', id: c.id })),
    ];

    const plateOptions = selectedClient
        ? [...new Set(
            buses
                .filter(b => {
                    if (!selectedClient) return false;
                    const { type, id } = selectedClient;
                    if (type === 'school') return String(b.schoolId) === String(id) || String(b.school?.id) === String(id);
                    if (type === 'corp') return String(b.corporationId) === String(id) || String(b.corporation?.id) === String(id);
                    return false;
                })
                .map(b => b.plate)
                .filter(Boolean)
        )].sort()
        : [...new Set(buses.map(b => b.plate).filter(Boolean))].sort();

    useEffect(() => {
        if (selectedPlate && !plateOptions.includes(selectedPlate)) {
            setSelectedPlate('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient, buses]);

    useEffect(() => {
        if (selectedClient) {
            const { type, id } = selectedClient;
            if (type === 'school') {
                fetchBusesBySchool(id);
            } else if (type === 'corp') {
                fetchBusesByCorporation(id);
            }
        } else {
            // load all buses
            fetchBusesBySchool();
        }
        // fetch route numbers for filter area
        fetchRouteNumbersForClient(selectedClient).catch(() => setClientRouteNumbers([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient]);

    // keep routeNumbers in sync for the create modal when its client changes
    useEffect(() => {
        if (createForm.client) {
            fetchRouteNumbersForClient(createForm.client).catch(() => setClientRouteNumbers([]));
        } else {
            // if no client in create modal, clear client-specific routeNumbers
            setClientRouteNumbers([]);
            // also clear any previously selected routeNumber in the create form
            setCreateForm(prev => ({ ...prev, routeNumber: '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createForm.client]);

    // Fetch route numbers (routeNumbers field) for a given client object { type, id }
    const fetchRouteNumbersForClient = async (client) => {
        if (!client) {
            setClientRouteNumbers([]);
            return [];
        }
        try {
            const { type, id } = client;
            if (type === 'school') {
                const resp = await api.get(`/schools/${id}`);
                const rn = resp.data?.school?.routeNumbers || [];
                const arr = Array.isArray(rn) ? rn.map(x => String(x)) : [];
                setClientRouteNumbers(arr);
                return arr;
            }
            if (type === 'corp') {
                const resp = await api.get(`/corporations/${id}`);
                const rn = resp.data?.corporation?.routeNumbers || [];
                const arr = Array.isArray(rn) ? rn.map(x => String(x)) : [];
                setClientRouteNumbers(arr);
                return arr;
            }
        } catch (error) {
            console.error('Error al cargar routeNumbers del cliente:', error);
            setClientRouteNumbers([]);
            return [];
        }
        setClientRouteNumbers([]);
        return [];
    };

    const fetchFuelRecords = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
            };

            if (selectedClient) {
                const { type, id } = selectedClient;
                if (type === 'school') filters.schoolId = id;
                if (type === 'corp') filters.corporationId = id;
            }
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedFuelingReason) filters.fuelingReason = selectedFuelingReason;
            if (selectedFuelType) filters.fuelType = selectedFuelType;
            if (selectedFuelType) filters.fuelType = selectedFuelType;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            // Ordenamiento
            if (orderBy) filters.orderBy = orderBy;
            if (order) filters.order = order;

            // DEBUG: log filters being sent to backend
            // eslint-disable-next-line no-console
            console.debug('[FuelRecordsPage] fetchFuelRecords filters:', filters);

            const response = await getFuelRecords(filters);
            
            // El backend retorna: { success: true, data: [...], pagination: { total, page, limit, totalPages } }
            if (response.success && response.data) {
                setFuelRecords(response.data);
                setTotalCount(response.pagination?.total || 0);
            } else {
                setFuelRecords([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error('Error al cargar registros de combustible:', error);
            setFuelRecords([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestSort = (field) => {
        const isAsc = orderBy === field && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(field);
        setPage(0);
    };

    const fetchStatistics = async () => {
        try {
            const filters = {};

            if (selectedClient) {
                    const { type, id } = selectedClient || {};
                    if (type === 'school') filters.schoolId = id;
                    if (type === 'corp') filters.corporationId = id;
                }
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const response = await getFuelStatistics(filters);
            
            // El backend retorna: { success: true, data: { byFuelType: [...], byBus: [...], totals: {...} } }
            if (response.success && response.data) {
                const totals = response.data.totals || {};
                const byFuelType = response.data.byFuelType || [];
                
                // Organizar por razón de abastecimiento
                const byReason = {};
                byFuelType.forEach(stat => {
                    byReason[stat.fuelingReason] = {
                        count: parseInt(stat.count) || 0,
                        totalGallonage: parseFloat(stat.totalGallonage) || 0,
                        totalAmount: parseFloat(stat.totalAmount) || 0,
                        avgPricePerGallon: parseFloat(stat.avgPricePerGallon) || 0
                    };
                });

                setStatistics({
                    totalRecords: parseInt(totals.totalRecords) || 0,
                    totalGallons: parseFloat(totals.totalGallonage) || 0,
                    totalAmount: parseFloat(totals.totalAmount) || 0,
                    averagePrice: parseFloat(totals.avgPricePerGallon) || 0,
                    byReason: byReason,
                });
            } else {
                setStatistics({
                    totalRecords: 0,
                    totalGallons: 0,
                    totalAmount: 0,
                    averagePrice: 0,
                    byReason: {},
                });
            }
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            setStatistics({
                totalRecords: 0,
                totalGallons: 0,
                totalAmount: 0,
                averagePrice: 0,
                byReason: {},
            });
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRefresh = () => {
        fetchFuelRecords();
        fetchStatistics();
    };

    // Register handler so the global refresh control triggers this page's refresh
    useRegisterPageRefresh(async () => {
        await Promise.all([fetchFuelRecords(), fetchStatistics()]);
    }, [fetchFuelRecords, fetchStatistics]);

    const handleViewDetails = async (recordId) => {
        try {
            const response = await getFuelRecordById(recordId);
            // El backend retorna: { success: true, data: {...} }
            if (response.success && response.data) {
                setSelectedRecord(response.data);
                setDetailsOpen(true);
            }
        } catch (error) {
            console.error('Error al cargar detalles del registro:', error);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedRecord(null);
    };

    const getFuelingReasonColor = (reason) => {
        const colors = {
            'ruta': 'primary',
            'mecanico': 'warning',
            'excursion': 'info',
            'admin': 'secondary',
        };
        return colors[reason] || 'default';
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
        }).format(amount || 0);
    };

    // Crear registro: handlers
    const handleCloseCreate = () => {
        setCreateOpen(false);
        setCreating(false);
        setCreateForm({
            fuelingReason: '',
            fuelType: '',
            client: '',
            busId: '',
            pilotId: '',
            routeNumber: '',
            pricePerGallon: '',
            gallonage: '',
            recordDateDate: moment(),
            recordDateTime: moment(),
            notes: ''
        });
    };

    const handleCreateChange = (field, value) => {
        // If the client changes, clear previously selected routeNumber to avoid stale values
        if (field === 'client') {
            setCreateForm(prev => ({ ...prev, client: value, routeNumber: '' }));
            return;
        }
        setCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCreateSubmit = async () => {
        // Validar campos requeridos: fuelingReason, fuelType, client, busId, pricePerGallon, gallonage
        const required = ['fuelingReason', 'fuelType', 'client', 'busId', 'pricePerGallon', 'gallonage'];
        for (const key of required) {
            if (createForm[key] === '' || createForm[key] === null || createForm[key] === undefined) {
                window.alert('Por favor complete los campos requeridos.');
                return;
            }
        }

        // Combine selected date and time into a single ISO timestamp
        let recordDateIso = null;
        if (createForm.recordDateDate && createForm.recordDateTime) {
            const datePart = moment(createForm.recordDateDate);
            const timePart = moment(createForm.recordDateTime, 'hh:mm A');
            if (timePart.isValid()) {
                datePart.hour(timePart.hour());
                datePart.minute(timePart.minute());
                datePart.second(0);
                recordDateIso = datePart.toISOString();
            }
        }

        const payload = {
            fuelingReason: createForm.fuelingReason,
            fuelType: createForm.fuelType,
            busId: Number(createForm.busId),
            pilotId: createForm.pilotId ? Number(createForm.pilotId) : undefined,
            routeNumber: createForm.routeNumber || undefined,
            pricePerGallon: Number(createForm.pricePerGallon),
            gallonage: Number(createForm.gallonage),
            recordDate: recordDateIso || new Date().toISOString(),
            notes: createForm.notes || undefined,
        };

        // Map client to schoolId or corporationId
        if (createForm.client) {
            const { type, id } = createForm.client || {};
            if (type === 'school') payload.schoolId = Number(id);
            if (type === 'corp') payload.corporationId = Number(id);
        }

        try {
            setCreating(true);
            const response = await createFuelRecordWeb(payload);
            if (response && response.success) {
                handleCloseCreate();
                // Refresh list and stats
                setPage(0);
                fetchFuelRecords();
                fetchStatistics();
                window.alert('Registro creado exitosamente');
            } else {
                window.alert('No se pudo crear el registro.');
            }
        } catch (error) {
            console.error('Error al crear registro:', error);
            window.alert('Error al crear registro. Revise la consola.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Registros de Combustible
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y gestiona los registros de abastecimiento de combustible
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <GasIcon color="primary" sx={{ mr: 1 }} />
                                    <Typography color="textSecondary" variant="body2">
                                        Total Registros
                                    </Typography>
                                </Box>
                                <Typography variant="h4">
                                    {statistics.totalRecords}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Total Galones
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.totalGallons.toFixed(2)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Total Gastado
                                </Typography>
                                <Typography variant="h4">
                                    {formatCurrency(statistics.totalAmount)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom variant="body2">
                                    Precio Promedio/Galón
                                </Typography>
                                <Typography variant="h4">
                                    {formatCurrency(statistics.averagePrice)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs="auto" sm="auto" md={"auto"}>
                                <Autocomplete
                                    options={clientOptions}
                                    value={selectedClient}
                                    onChange={(e, newValue) => { setSelectedClient(newValue); setSelectedRoute(''); setSelectedPlate(''); }}
                                    getOptionLabel={(option) => option?.label || ''}
                                    renderInput={(params) => <TextField {...params} label="Cliente" variant="outlined" />}
                                    sx={{ width: 250 }}
                                    isOptionEqualToValue={(opt, val) => opt?.value === val?.value}
                                    clearOnEscape
                                />
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                                <FormControl fullWidth sx={{ width: 120 }}>
                                <InputLabel>Ruta</InputLabel>
                                <Select
                                    value={selectedRoute}
                                    onChange={(e) => {
                                        setSelectedRoute(e.target.value);
                                        setSelectedPlate('');
                                    }}
                                    label="Ruta"
                                    disabled={!selectedClient}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {((selectedClient ? clientRouteNumbers : [...new Set(buses.map(b => b.routeNumber).filter(Boolean))]).map(String)).sort((a,b) => a - b).map((route) => (
                                        <MenuItem key={route} value={route}>
                                            {route}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <Autocomplete
                                options={plateOptions}
                                value={selectedPlate || null}
                                onChange={(e, newValue) => setSelectedPlate(newValue || '')}
                                getOptionLabel={(option) => option || ''}
                                renderInput={(params) => (
                                    <TextField {...params} label="Placa" variant="outlined" />
                                )}
                                fullWidth
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <FormControl fullWidth sx={{ width: 225 }}>
                                <InputLabel>Razón de Abastecimiento</InputLabel>
                                <Select
                                    value={selectedFuelingReason}
                                    onChange={(e) => setSelectedFuelingReason(e.target.value)}
                                    label="Razón de Abastecimiento"
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {Object.entries(FUELING_REASONS).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <FormControl fullWidth sx={{ width: 180 }}>
                                <InputLabel>Tipo Combustible</InputLabel>
                                <Select
                                    value={selectedFuelType}
                                    onChange={(e) => setSelectedFuelType(e.target.value)}
                                    label="Tipo Combustible"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(FUEL_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" sm="auto" md={"auto"}>
                            <DatePicker
                                label="Fecha Fin"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                sx={{ width: 180 }}
                            />
                        </Grid>

                        <Grid item xs="auto" display="flex" justifyContent="flex-end" spacing={1}>
                            <Box>
                                <Tooltip title="Limpiar filtros">
                                    <Button onClick={() => {
                                        setSelectedClient('');
                                        setSelectedPlate('');
                                        setSelectedRoute('');
                                        setSelectedFuelingReason('');
                                        setSelectedFuelType('');
                                        setStartDate(null);
                                        setEndDate(null);
                                        setPage(0);
                                        fetchFuelRecords();
                                        fetchStatistics();
                                    }} variant="outlined" sx={{ mr: 1 }}>
                                        Limpiar
                                    </Button>
                                </Tooltip>
                                <Button onClick={() => setCreateOpen(true)} variant="contained" color="primary" sx={{ mr: 1 }}>
                                    Nuevo Registro
                                </Button>
                                {/* Local refresh removed; use global refresh button */}
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Tabla */}
                <Paper>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sortDirection={orderBy === 'recordDate' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'recordDate'}
                                                    direction={orderBy === 'recordDate' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('recordDate')}
                                                >
                                                    Fecha
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'client' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'client'}
                                                    direction={orderBy === 'client' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('client')}
                                                >
                                                    Cliente
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'routeNumber' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'routeNumber'}
                                                    direction={orderBy === 'routeNumber' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('routeNumber')}
                                                >
                                                    Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'plate' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'plate'}
                                                    direction={orderBy === 'plate' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('plate')}
                                                >
                                                    Placa
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'pilotName' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'pilotName'}
                                                    direction={orderBy === 'pilotName' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('pilotName')}
                                                >
                                                    Piloto
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'fuelingReason' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'fuelingReason'}
                                                    direction={orderBy === 'fuelingReason' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('fuelingReason')}
                                                >
                                                    Razón
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sortDirection={orderBy === 'fuelType' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'fuelType'}
                                                    direction={orderBy === 'fuelType' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('fuelType')}
                                                >
                                                    Tipo Combustible
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right" sortDirection={orderBy === 'gallonage' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'gallonage'}
                                                    direction={orderBy === 'gallonage' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('gallonage')}
                                                >
                                                    Galones
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right" sortDirection={orderBy === 'pricePerGallon' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'pricePerGallon'}
                                                    direction={orderBy === 'pricePerGallon' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('pricePerGallon')}
                                                >
                                                    Precio/Galón
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right" sortDirection={orderBy === 'totalAmount' ? order : false}>
                                                <TableSortLabel
                                                    active={orderBy === 'totalAmount'}
                                                    direction={orderBy === 'totalAmount' ? order : 'asc'}
                                                    onClick={() => handleRequestSort('totalAmount')}
                                                >
                                                    Total
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {fuelRecords.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>
                                                    {moment(record.recordDate).format('DD/MM/YYYY HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    {record.school?.name || record.corporation?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.pilot?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={FUELING_REASONS[record.fuelingReason] || record.fuelingReason}
                                                        size="small"
                                                        color={getFuelingReasonColor(record.fuelingReason)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {FUEL_TYPES[record.fuelType] || record.fuelType}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {parseFloat(record.gallonage).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatCurrency(record.pricePerGallon)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {formatCurrency(record.totalAmount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewDetails(record.id)}
                                                            color="primary"
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {fuelRecords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} align="center">
                                                    No se encontraron registros de combustible
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={handleChangePage}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                labelRowsPerPage="Registros por página:"
                                labelDisplayedRows={({ from, to, count }) =>
                                    `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                                }
                            />
                        </>
                    )}
                </Paper>

                {/* Modal de Crear Registro */}
                <Dialog
                    open={createOpen}
                    onClose={handleCloseCreate}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Crear Registro de Combustible</DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={12} sm={6}>
                                <Autocomplete
                                    options={clientOptions}
                                    value={createForm.client}
                                    onChange={(e, newValue) => handleCreateChange('client', newValue)}
                                    getOptionLabel={(option) => option?.label || ''}
                                    renderInput={(params) => <TextField {...params} label="Cliente" variant="outlined" />}
                                    fullWidth
                                    isOptionEqualToValue={(opt, val) => opt?.value === val?.value}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Autocomplete
                                    options={buses.map(b => ({ label: b.plate, id: b.id, routeNumber: b.routeNumber }))}
                                    value={createForm.busId ? (buses.find(x => x.id === createForm.busId) ? { label: buses.find(x => x.id === createForm.busId).plate, id: createForm.busId } : null) : null}
                                    onChange={(e, newValue) => {
                                        handleCreateChange('busId', newValue ? newValue.id : '');
                                    }}
                                    getOptionLabel={(option) => option?.label || ''}
                                    renderInput={(params) => <TextField {...params} label="Bus (Placa)" variant="outlined" />}
                                    fullWidth
                                    isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Autocomplete
                                    options={pilots.map(p => ({ label: p.name, id: p.id }))}
                                    value={createForm.pilotId ? (pilots.find(x => x.id === createForm.pilotId) ? { label: pilots.find(x => x.id === createForm.pilotId).name, id: createForm.pilotId } : null) : null}
                                    onChange={(e, newValue) => handleCreateChange('pilotId', newValue ? newValue.id : '')}
                                    getOptionLabel={(option) => option?.label || ''}
                                    renderInput={(params) => <TextField {...params} label="Piloto" variant="outlined" />}
                                    fullWidth
                                    isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Autocomplete
                                    options={(createForm.client ? (clientRouteNumbers.length ? clientRouteNumbers : []) : []).map(String).sort((a,b) => a - b)}
                                    value={createForm.routeNumber || null}
                                    onChange={(e, newValue) => handleCreateChange('routeNumber', newValue || '')}
                                    getOptionLabel={(option) => String(option)}
                                    renderInput={(params) => <TextField {...params} label="Número de Ruta" variant="outlined" />}
                                    fullWidth
                                    disabled={!createForm.client}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Razón de Abastecimiento</InputLabel>
                                    <Select
                                        value={createForm.fuelingReason}
                                        label="Razón de Abastecimiento"
                                        onChange={(e) => handleCreateChange('fuelingReason', e.target.value)}
                                    >
                                        <MenuItem value="">Seleccione</MenuItem>
                                        {Object.entries(FUELING_REASONS).map(([key, label]) => (
                                            <MenuItem key={key} value={key}>{label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Tipo Combustible</InputLabel>
                                    <Select
                                        value={createForm.fuelType}
                                        label="Tipo Combustible"
                                        onChange={(e) => handleCreateChange('fuelType', e.target.value)}
                                    >
                                        <MenuItem value="">Seleccione</MenuItem>
                                        {Object.entries(FUEL_TYPES).map(([key, label]) => (
                                            <MenuItem key={key} value={key}>{label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Galones"
                                    type="number"
                                    fullWidth
                                    value={createForm.gallonage}
                                    onChange={(e) => handleCreateChange('gallonage', e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Precio por Galón"
                                    type="number"
                                    fullWidth
                                    value={createForm.pricePerGallon}
                                    onChange={(e) => handleCreateChange('pricePerGallon', e.target.value)}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <DatePicker
                                    label="Fecha"
                                    value={createForm.recordDateDate}
                                    onChange={(newValue) => handleCreateChange('recordDateDate', newValue)}
                                    renderInput={(params) => <TextField fullWidth {...params} />}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Hora (HH:mm)"
                                    type="time"
                                    value={createForm.recordDateTime}
                                    onChange={(e) => handleCreateChange('recordDateTime', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Notas (opcional)"
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    value={createForm.notes}
                                    onChange={(e) => handleCreateChange('notes', e.target.value)}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseCreate} disabled={creating}>Cancelar</Button>
                        <Button onClick={handleCreateSubmit} variant="contained" color="primary" disabled={creating}>
                            {creating ? 'Creando...' : 'Crear'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Modal de Detalles */}
                <Dialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Detalles del Registro de Combustible</DialogTitle>
                    <DialogContent dividers>
                        {selectedRecord && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha y Hora
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {moment(selectedRecord.recordDate).format('DD/MM/YYYY HH:mm')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.plate || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.routeNumber || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Piloto
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.pilot?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Cliente
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.school?.name || selectedRecord.corporation?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Razón de Abastecimiento
                                    </Typography>
                                    <Chip 
                                        label={FUELING_REASONS[selectedRecord.fuelingReason] || selectedRecord.fuelingReason}
                                        color={getFuelingReasonColor(selectedRecord.fuelingReason)}
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Combustible
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {FUEL_TYPES[selectedRecord.fuelType] || selectedRecord.fuelType}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Galones
                                    </Typography>
                                    <Typography variant="h6" gutterBottom>
                                        {parseFloat(selectedRecord.gallonage).toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Precio por Galón
                                    </Typography>
                                    <Typography variant="h6" gutterBottom>
                                        {formatCurrency(selectedRecord.pricePerGallon)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Total Pagado
                                    </Typography>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        {formatCurrency(selectedRecord.totalAmount)}
                                    </Typography>
                                </Grid>
                                {selectedRecord.notes && (
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Notas
                                        </Typography>
                                        <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                            <Typography variant="body1">
                                                {selectedRecord.notes}
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Creado por
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRecord.creator?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDetails} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </LocalizationProvider>
    );
};

export default FuelRecordsPage;
