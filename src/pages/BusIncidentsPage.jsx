// src/pages/BusIncidentsPage.jsx

import React, { useEffect, useState } from 'react';
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
    Delete as DeleteIcon,
    Warning as WarningIcon,
    Build as BuildIcon,
    ElectricalServices as ElectricalIcon,
    CarCrash as CrashIcon,
    HelpOutline as OtherIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { getAllBusIncidents, getBusIncidentById, deleteBusIncident, FAILURE_TYPES, INCIDENT_EVENT_TYPES } from '../services/busIncidentService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const BusIncidentsPage = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedCorporation, setSelectedCorporation] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedTipoFalla, setSelectedTipoFalla] = useState('');
    const [selectedTipo, setSelectedTipo] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Ordenamiento
    const [orderBy, setOrderBy] = useState('fecha');
    const [order, setOrder] = useState('desc');

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal de eliminación
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        byTipoFalla: {},
        byTipo: {},
        withImpact: 0,
    });

    useEffect(() => {
        fetchSchools();
        fetchCorporations();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
        } else if (selectedCorporation) {
            fetchBusesByCorporation(selectedCorporation);
        } else {
            setBuses([]);
        }
    }, [selectedSchool, selectedCorporation]);

    useEffect(() => {
        fetchIncidents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedCorporation, selectedPlate, selectedRoute, selectedTipoFalla, selectedTipo, startDate, endDate, orderBy, order]);

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

    const fetchBusesBySchool = async (schoolId) => {
        try {
            const response = await api.get(`/buses/school/${schoolId}`);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchBusesByCorporation = async (corporationId) => {
        try {
            const response = await api.get(`/buses/corporation/${corporationId}`);
            const busesData = Array.isArray(response.data) ? response.data : (response.data?.buses || []);
            setBuses(busesData);
        } catch (error) {
            console.error('Error al cargar buses:', error);
            setBuses([]);
        }
    };

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
            };

            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedCorporation) filters.corporationId = selectedCorporation;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedTipoFalla) filters.tipoFalla = selectedTipoFalla;
            if (selectedTipo) filters.tipo = selectedTipo;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');
            filters.orderBy = orderBy;
            filters.order = order;

            const data = await getAllBusIncidents(filters);
            
            const incidentList = data.incidents || data.data || [];
            setIncidents(incidentList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            if (incidentList.length > 0) {
                const byTipoFalla = {};
                const byTipo = {};
                let withImpact = 0;

                incidentList.forEach(incident => {
                    const tipoFalla = incident.tipoFalla || 'sin_falla';
                    const tipo = incident.tipo || 'incidente';

                    byTipoFalla[tipoFalla] = (byTipoFalla[tipoFalla] || 0) + 1;
                    byTipo[tipo] = (byTipo[tipo] || 0) + 1;

                    if (incident.impacto) withImpact++;
                });

                setStatistics({
                    total: incidentList.length,
                    byTipoFalla,
                    byTipo,
                    withImpact,
                });
            } else {
                setStatistics({
                    total: 0,
                    byTipoFalla: {},
                    byTipo: {},
                    withImpact: 0,
                });
            }
        } catch (error) {
            console.error('Error al cargar incidentes:', error);
        } finally {
            setLoading(false);
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
        fetchIncidents();
    };

    const handleViewDetails = async (incidentId) => {
        setLoadingDetails(true);
        setDetailsOpen(true);
        try {
            const data = await getBusIncidentById(incidentId);
            setSelectedIncident(data);
        } catch (error) {
            console.error('Error al cargar detalles del incidente:', error);
            alert('Error al cargar los detalles del incidente');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
    };

    const handleSort = (column) => {
        const isAsc = orderBy === column && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(column);
    };

    const handleOpenDelete = (id) => {
        setDeleteId(id);
        setDeleteOpen(true);
    };

    const handleCancelDelete = () => {
        setDeleteOpen(false);
        setDeleteId(null);
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteBusIncident(deleteId);
            setDeleteOpen(false);
            setDeleteId(null);
            fetchIncidents();
        } catch (error) {
            console.error('Error al eliminar incidente:', error);
            alert('Error al eliminar el incidente');
        }
    };

    const getTipoFallaIcon = (tipoFalla) => {
        switch (tipoFalla) {
            case 'mecánico':
                return <BuildIcon fontSize="small" />;
            case 'eléctrico':
                return <ElectricalIcon fontSize="small" />;
            case 'choque':
                return <CrashIcon fontSize="small" />;
            case 'otro':
                return <OtherIcon fontSize="small" />;
            default:
                return <WarningIcon fontSize="small" />;
        }
    };

    const getTipoFallaColor = (tipoFalla) => {
        switch (tipoFalla) {
            case 'mecánico':
                return 'warning';
            case 'eléctrico':
                return 'info';
            case 'choque':
                return 'error';
            case 'otro':
                return 'default';
            default:
                return 'default';
        }
    };

    const getTipoColor = (tipo) => {
        return tipo === 'accidente' ? 'error' : 'warning';
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Incidentes de Buses
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza los incidentes y accidentes reportados en los buses
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Incidentes
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.total}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Falla Más Común
                                </Typography>
                                <Typography variant="h6">
                                    {Object.keys(statistics.byTipoFalla).length > 0
                                        ? FAILURE_TYPES[Object.keys(statistics.byTipoFalla).reduce((a, b) => 
                                            statistics.byTipoFalla[a] > statistics.byTipoFalla[b] ? a : b
                                        )] || 'Sin Falla'
                                        : 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Accidentes
                                </Typography>
                                <Typography variant="h4" color="error">
                                    {statistics.byTipo['accidente'] || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Con Impacto
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.withImpact}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Colegio</InputLabel>
                                <Select
                                    value={selectedSchool}
                                    onChange={(e) => {
                                        setSelectedSchool(e.target.value);
                                        setSelectedCorporation('');
                                        setSelectedPlate('');
                                        setSelectedRoute('');
                                    }}
                                    label="Colegio"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {schools.map((school) => (
                                        <MenuItem key={school.id} value={school.id}>
                                            {school.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Corporación</InputLabel>
                                <Select
                                    value={selectedCorporation}
                                    onChange={(e) => {
                                        setSelectedCorporation(e.target.value);
                                        setSelectedSchool('');
                                        setSelectedPlate('');
                                        setSelectedRoute('');
                                    }}
                                    label="Corporación"
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {corporations.map((corp) => (
                                        <MenuItem key={corp.id} value={corp.id}>
                                            {corp.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Placa</InputLabel>
                                <Select
                                    value={selectedPlate}
                                    onChange={(e) => setSelectedPlate(e.target.value)}
                                    label="Placa"
                                    disabled={!selectedSchool && !selectedCorporation}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {[...new Set(buses.map(b => b.plate))].map((plate) => (
                                        <MenuItem key={plate} value={plate}>
                                            {plate}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Ruta</InputLabel>
                                <Select
                                    value={selectedRoute}
                                    onChange={(e) => setSelectedRoute(e.target.value)}
                                    label="Ruta"
                                    disabled={!selectedSchool && !selectedCorporation}
                                >
                                    <MenuItem value="">Todas</MenuItem>
                                    {[...new Set(buses.map(b => b.routeNumber).filter(r => r))].sort((a, b) => a - b).map((route) => (
                                        <MenuItem key={route} value={route}>
                                            {route}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo de Falla</InputLabel>
                                <Select
                                    value={selectedTipoFalla}
                                    onChange={(e) => setSelectedTipoFalla(e.target.value)}
                                    label="Tipo de Falla"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(FAILURE_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={selectedTipo}
                                    onChange={(e) => setSelectedTipo(e.target.value)}
                                    label="Tipo"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(INCIDENT_EVENT_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Fecha Fin"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                            <Tooltip title="Actualizar">
                                <IconButton onClick={handleRefresh} color="primary">
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
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
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'fecha'}
                                                    direction={orderBy === 'fecha' ? order : 'asc'}
                                                    onClick={() => handleSort('fecha')}
                                                >
                                                    Fecha
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'tipo'}
                                                    direction={orderBy === 'tipo' ? order : 'asc'}
                                                    onClick={() => handleSort('tipo')}
                                                >
                                                    Tipo
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'tipoFalla'}
                                                    direction={orderBy === 'tipoFalla' ? order : 'asc'}
                                                    onClick={() => handleSort('tipoFalla')}
                                                >
                                                    Tipo de Falla
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'placaBus'}
                                                    direction={orderBy === 'placaBus' ? order : 'asc'}
                                                    onClick={() => handleSort('placaBus')}
                                                >
                                                    Placa
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'numeroRuta'}
                                                    direction={orderBy === 'numeroRuta' ? order : 'asc'}
                                                    onClick={() => handleSort('numeroRuta')}
                                                >
                                                    Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === 'colegio'}
                                                    direction={orderBy === 'colegio' ? order : 'asc'}
                                                    onClick={() => handleSort('colegio')}
                                                >
                                                    Colegio/Corp.
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Creado por</TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={orderBy === 'impacto'}
                                                    direction={orderBy === 'impacto' ? order : 'asc'}
                                                    onClick={() => handleSort('impacto')}
                                                >
                                                    Impacto
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">
                                                <TableSortLabel
                                                    active={orderBy === 'pudoContinuarRuta'}
                                                    direction={orderBy === 'pudoContinuarRuta' ? order : 'asc'}
                                                    onClick={() => handleSort('pudoContinuarRuta')}
                                                >
                                                    Continuó Ruta
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {incidents.map((incident) => (
                                            <TableRow key={incident.id}>
                                                <TableCell>
                                                    {moment(incident.fecha).format('DD/MM/YYYY HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={INCIDENT_EVENT_TYPES[incident.tipo] || incident.tipo}
                                                        size="small"
                                                        color={getTipoColor(incident.tipo)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {incident.noFallas ? (
                                                        <Chip 
                                                            label="Sin Fallas"
                                                            size="small"
                                                            color="success"
                                                            icon={<CheckCircleIcon />}
                                                        />
                                                    ) : (
                                                        <Chip 
                                                            label={incident.tipoFalla === 'otro' && incident.otroFallaDetalle 
                                                                ? `Otro: ${incident.otroFallaDetalle}`
                                                                : FAILURE_TYPES[incident.tipoFalla] || incident.tipoFalla}
                                                            size="small"
                                                            color={getTipoFallaColor(incident.tipoFalla)}
                                                            icon={getTipoFallaIcon(incident.tipoFalla)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.placaBus || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.numeroRuta || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.colegio || incident.corporacion || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.piloto?.name || incident.supervisorName || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.impacto ? (
                                                        <Chip label="Sí" size="small" color="error" />
                                                    ) : (
                                                        <Chip label="No" size="small" color="success" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {incident.pudoContinuarRuta ? (
                                                        <CheckCircleIcon color="success" fontSize="small" />
                                                    ) : (
                                                        <CancelIcon color="error" fontSize="small" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewDetails(incident.id)}
                                                            color="primary"
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenDelete(incident.id)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {incidents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
                                                    No se encontraron incidentes
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

                {/* Modal de Detalles */}
                <Dialog
                    open={detailsOpen}
                    onClose={handleCloseDetails}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>Detalles del Incidente</DialogTitle>
                    <DialogContent dividers>
                        {loadingDetails ? (
                            <Box display="flex" justifyContent="center" p={3}>
                                <CircularProgress />
                            </Box>
                        ) : selectedIncident ? (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha y Hora
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {moment(selectedIncident.fecha).format('DD/MM/YYYY HH:mm')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Evento
                                    </Typography>
                                    <Chip 
                                        label={INCIDENT_EVENT_TYPES[selectedIncident.tipo] || selectedIncident.tipo}
                                        color={getTipoColor(selectedIncident.tipo)}
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Falla
                                    </Typography>
                                    {selectedIncident.noFallas ? (
                                        <Chip 
                                            label="Sin Fallas Reportadas"
                                            color="success"
                                            icon={<CheckCircleIcon />}
                                            sx={{ mt: 1 }}
                                        />
                                    ) : (
                                        <Chip 
                                            label={selectedIncident.tipoFalla === 'otro' && selectedIncident.otroFallaDetalle 
                                                ? `Otro: ${selectedIncident.otroFallaDetalle}`
                                                : FAILURE_TYPES[selectedIncident.tipoFalla] || selectedIncident.tipoFalla}
                                            color={getTipoFallaColor(selectedIncident.tipoFalla)}
                                            icon={getTipoFallaIcon(selectedIncident.tipoFalla)}
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa del Bus
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.placaBus || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Número de Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.numeroRuta || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Colegio
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.colegio || 'N/A'}
                                    </Typography>
                                </Grid>
                                {selectedIncident.corporacion && (
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Corporación
                                        </Typography>
                                        <Typography variant="body1" gutterBottom>
                                            {selectedIncident.corporacion}
                                        </Typography>
                                    </Grid>
                                )}
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Creado por
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.piloto?.name || selectedIncident.supervisorName || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Hubo Impacto?
                                    </Typography>
                                    {selectedIncident.impacto ? (
                                        <Chip label="Sí" color="error" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="success" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Pudo Continuar la Ruta?
                                    </Typography>
                                    {selectedIncident.pudoContinuarRuta ? (
                                        <Chip label="Sí" color="success" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="error" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        ¿Se Utilizó Bus Suplente?
                                    </Typography>
                                    {selectedIncident.seUtilizoBusSuplente ? (
                                        <Chip label="Sí" color="warning" size="small" sx={{ mt: 1 }} />
                                    ) : (
                                        <Chip label="No" color="default" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Grid>
                                {selectedIncident.allBuses && (
                                    <Grid item xs={12}>
                                        <Chip 
                                            label="Aplica para todos los buses" 
                                            color="info" 
                                            sx={{ mt: 1 }} 
                                        />
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Descripción del Incidente
                                    </Typography>
                                    <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                        <Typography variant="body1">
                                            {selectedIncident.descripcion || 'Sin descripción'}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        ) : (
                            <Typography align="center" color="textSecondary">
                                No se pudieron cargar los detalles
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDetails} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Modal de Confirmación de Eliminación */}
                <Dialog
                    open={deleteOpen}
                    onClose={handleCancelDelete}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>Confirmar Eliminación</DialogTitle>
                    <DialogContent>
                        <Typography>
                            ¿Estás seguro de que deseas eliminar este incidente? Esta acción no se puede deshacer.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCancelDelete} color="inherit">
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirmDelete} color="error" variant="contained">
                            Eliminar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </LocalizationProvider>
    );
};

export default BusIncidentsPage;
