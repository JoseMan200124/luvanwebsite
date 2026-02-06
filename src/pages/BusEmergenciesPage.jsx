// src/pages/BusEmergenciesPage.jsx

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
    LocationOn as LocationOnIcon,
    LocationOff as LocationOffIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { getAllBusEmergencies, getBusEmergencyById, deleteBusEmergency } from '../services/busEmergencyService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const BusEmergenciesPage = () => {
    const [emergencies, setEmergencies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [corporations, setCorporations] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedCorporation, setSelectedCorporation] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Ordenamiento
    const [orderBy, setOrderBy] = useState('fecha');
    const [order, setOrder] = useState('desc');

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedEmergency, setSelectedEmergency] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal de eliminación
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        withLocation: 0,
        bySchool: {},
    });

    useEffect(() => {
        fetchSchools();
        fetchCorporations();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
            fetchRouteNumbersBySchool(selectedSchool);
        } else if (selectedCorporation) {
            fetchBusesByCorporation(selectedCorporation);
            fetchRouteNumbersByCorporation(selectedCorporation);
        } else {
            setBuses([]);
            setSchoolRoutes([]);
        }
    }, [selectedSchool, selectedCorporation]);

    useEffect(() => {
        fetchEmergencies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedCorporation, selectedPlate, selectedRoute, startDate, endDate, orderBy, order]);

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

    const fetchRouteNumbersBySchool = async (schoolId) => {
        try {
            const response = await api.get(`/routes/school/${schoolId}/numbers`);
            const numbers = Array.isArray(response.data?.routeNumbers) ? response.data.routeNumbers : (response.data?.routeNumbers || []);
            setSchoolRoutes(numbers);
        } catch (error) {
            console.error('Error al cargar números de ruta:', error);
            setSchoolRoutes([]);
        }
    };

    const fetchRouteNumbersByCorporation = async (corporationId) => {
        try {
            const response = await api.get(`/routes/corporation/${corporationId}/numbers`);
            const numbers = Array.isArray(response.data?.routeNumbers) ? response.data.routeNumbers : (response.data?.routeNumbers || []);
            setSchoolRoutes(numbers);
        } catch (error) {
            console.error('Error al cargar números de ruta:', error);
            setSchoolRoutes([]);
        }
    };

    const fetchEmergencies = async () => {
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
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');
            filters.orderBy = orderBy;
            filters.order = order;

            const data = await getAllBusEmergencies(filters);
            
            const emergencyList = data.emergencies || data.data || [];
            setEmergencies(emergencyList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            if (emergencyList.length > 0) {
                const bySchool = {};
                let withLocation = 0;

                emergencyList.forEach(emergency => {
                    const colegio = emergency.colegio || 'Sin Colegio';
                    bySchool[colegio] = (bySchool[colegio] || 0) + 1;

                    if (emergency.latitud && emergency.longitud) withLocation++;
                });

                setStatistics({
                    total: emergencyList.length,
                    withLocation,
                    bySchool,
                });
            } else {
                setStatistics({
                    total: 0,
                    withLocation: 0,
                    bySchool: {},
                });
            }
        } catch (error) {
            console.error('Error al cargar emergencias:', error);
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
        fetchEmergencies();
    };

    const handleViewDetails = async (emergencyId) => {
        setLoadingDetails(true);
        setDetailsOpen(true);
        try {
            const data = await getBusEmergencyById(emergencyId);
            setSelectedEmergency(data);
        } catch (error) {
            console.error('Error al cargar detalles de la emergencia:', error);
            alert('Error al cargar los detalles de la emergencia');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedEmergency(null);
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
            await deleteBusEmergency(deleteId);
            setDeleteOpen(false);
            setDeleteId(null);
            fetchEmergencies();
        } catch (error) {
            console.error('Error al eliminar emergencia:', error);
            alert('Error al eliminar la emergencia');
        }
    };

    const openGoogleMaps = (lat, lng) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        <WarningIcon color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Emergencias de Buses
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza las emergencias reportadas por pilotos y monitoras
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Emergencias
                                </Typography>
                                <Typography variant="h4" color="error">
                                    {statistics.total}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Con Ubicación GPS
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.withLocation}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Colegio con Más Emergencias
                                </Typography>
                                <Typography variant="h6">
                                    {Object.keys(statistics.bySchool).length > 0
                                        ? Object.keys(statistics.bySchool).reduce((a, b) => 
                                            statistics.bySchool[a] > statistics.bySchool[b] ? a : b
                                        )
                                        : 'N/A'}
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
                                    {(schoolRoutes && schoolRoutes.length > 0 ? [...schoolRoutes] : []).sort((a, b) => {
                                        const na = Number(a);
                                        const nb = Number(b);
                                        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
                                        return String(a).localeCompare(String(b));
                                    }).map((route) => (
                                        <MenuItem key={route} value={route}>
                                            {route}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
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
                                                    active={orderBy === 'mensaje'}
                                                    direction={orderBy === 'mensaje' ? order : 'asc'}
                                                    onClick={() => handleSort('mensaje')}
                                                >
                                                    Mensaje
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
                                            <TableCell align="center">Ubicación</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {emergencies.map((emergency) => (
                                            <TableRow key={emergency.id}>
                                                <TableCell>
                                                    {moment(emergency.fecha).format('DD/MM/YYYY HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={emergency.mensaje || 'Sin mensaje'}>
                                                        <span>
                                                            {emergency.mensaje 
                                                                ? (emergency.mensaje.length > 50 
                                                                    ? `${emergency.mensaje.substring(0, 50)}...` 
                                                                    : emergency.mensaje)
                                                                : 'Emergencia generada'}
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    {emergency.placaBus || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {emergency.numeroRuta || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {emergency.colegio || emergency.corporacion || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {emergency.reporter?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {emergency.latitud && emergency.longitud ? (
                                                        <Tooltip title="Ver en Google Maps">
                                                            <IconButton
                                                                size="small"
                                                                color="success"
                                                                onClick={() => openGoogleMaps(emergency.latitud, emergency.longitud)}
                                                            >
                                                                <LocationOnIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Chip 
                                                            icon={<LocationOffIcon />}
                                                            label="Sin GPS" 
                                                            size="small" 
                                                            color="default"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Ver detalles">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewDetails(emergency.id)}
                                                            color="primary"
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenDelete(emergency.id)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {emergencies.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    No se encontraron emergencias
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
                    <DialogTitle>
                        <WarningIcon color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Detalles de la Emergencia
                    </DialogTitle>
                    <DialogContent dividers>
                        {loadingDetails ? (
                            <Box display="flex" justifyContent="center" p={3}>
                                <CircularProgress />
                            </Box>
                        ) : selectedEmergency ? (
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Fecha y Hora
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {moment(selectedEmergency.fecha).format('DD/MM/YYYY HH:mm:ss')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Creado por
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedEmergency.piloto?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa del Bus
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedEmergency.placaBus || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Número de Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedEmergency.numeroRuta || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Colegio
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedEmergency.colegio || 'N/A'}
                                    </Typography>
                                </Grid>
                                {selectedEmergency.corporacion && (
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" color="textSecondary">
                                            Corporación
                                        </Typography>
                                        <Typography variant="body1" gutterBottom>
                                            {selectedEmergency.corporacion}
                                        </Typography>
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Ubicación GPS
                                    </Typography>
                                    {selectedEmergency.latitud && selectedEmergency.longitud ? (
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" gutterBottom>
                                                Latitud: {selectedEmergency.latitud}, Longitud: {selectedEmergency.longitud}
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                startIcon={<LocationOnIcon />}
                                                onClick={() => openGoogleMaps(selectedEmergency.latitud, selectedEmergency.longitud)}
                                            >
                                                Ver en Google Maps
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Chip 
                                            icon={<LocationOffIcon />}
                                            label="Sin ubicación GPS disponible" 
                                            color="default"
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Mensaje de Emergencia
                                    </Typography>
                                    <Paper sx={{ p: 2, mt: 1, backgroundColor: '#ffebee' }}>
                                        <Typography variant="body1">
                                            {selectedEmergency.mensaje || 'Emergencia generada'}
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
                            ¿Estás seguro de que deseas eliminar esta emergencia? Esta acción no se puede deshacer.
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

export default BusEmergenciesPage;
