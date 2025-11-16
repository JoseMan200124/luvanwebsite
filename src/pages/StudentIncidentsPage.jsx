// src/pages/StudentIncidentsPage.jsx

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
import { Refresh as RefreshIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { getAllStudentIncidents, getStudentIncidentById, INCIDENT_TYPES } from '../services/studentIncidentService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const StudentIncidentsPage = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedIncidentType, setSelectedIncidentType] = useState('');
    const [selectedScheduleType, setSelectedScheduleType] = useState('');
    const [startDate, setStartDate] = useState(moment().subtract(30, 'days'));
    const [endDate, setEndDate] = useState(moment());

    // Modal de detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        byType: {},
        bySchedule: {},
    });

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
        }
    }, [selectedSchool]);

    useEffect(() => {
        fetchIncidents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedPlate, selectedRoute, selectedIncidentType, selectedScheduleType, startDate, endDate]);

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
            const response = await api.get(`/buses/school/${schoolId}`);
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
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedIncidentType) filters.incidentType = selectedIncidentType;
            if (selectedScheduleType) filters.scheduleType = selectedScheduleType;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const data = await getAllStudentIncidents(filters);
            
            const incidentList = data.incidents || data.data || [];
            setIncidents(incidentList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            if (incidentList.length > 0) {
                const byType = {};
                const bySchedule = {};

                incidentList.forEach(incident => {
                    const type = incident.incidentType;
                    const schedule = incident.scheduleType;

                    byType[type] = (byType[type] || 0) + 1;
                    bySchedule[schedule] = (bySchedule[schedule] || 0) + 1;
                });

                setStatistics({
                    total: incidentList.length,
                    byType,
                    bySchedule,
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
        try {
            console.log('Cargando detalles del incidente:', incidentId);
            const data = await getStudentIncidentById(incidentId);
            console.log('Datos del incidente:', data);
            setSelectedIncident(data);
            setDetailsOpen(true);
        } catch (error) {
            console.error('Error al cargar detalles del incidente:', error);
            alert('Error al cargar los detalles del incidente');
        }
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedIncident(null);
    };

    const getScheduleLabel = (schedule) => {
        const labels = {
            'AM': 'Mañana',
            'MD': 'Mediodía',
            'PM': 'Tarde',
            'EX': 'Extracurricular',
        };
        return labels[schedule] || schedule;
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Reportes de Conducta de Alumnos
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza los incidentes reportados por las monitoras
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={4}>
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
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Tipo Más Común
                                </Typography>
                                <Typography variant="h6">
                                    {Object.keys(statistics.byType).length > 0
                                        ? INCIDENT_TYPES[Object.keys(statistics.byType).reduce((a, b) => 
                                            statistics.byType[a] > statistics.byType[b] ? a : b
                                        )]
                                        : 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Horario Más Incidentes
                                </Typography>
                                <Typography variant="h6">
                                    {Object.keys(statistics.bySchedule).length > 0
                                        ? getScheduleLabel(Object.keys(statistics.bySchedule).reduce((a, b) => 
                                            statistics.bySchedule[a] > statistics.bySchedule[b] ? a : b
                                        ))
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
                                <InputLabel>Placa</InputLabel>
                                <Select
                                    value={selectedPlate}
                                    onChange={(e) => setSelectedPlate(e.target.value)}
                                    label="Placa"
                                    disabled={!selectedSchool}
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
                                    disabled={!selectedSchool}
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
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Tipo de Incidente</InputLabel>
                                <Select
                                    value={selectedIncidentType}
                                    onChange={(e) => setSelectedIncidentType(e.target.value)}
                                    label="Tipo de Incidente"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {Object.entries(INCIDENT_TYPES).map(([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Horario</InputLabel>
                                <Select
                                    value={selectedScheduleType}
                                    onChange={(e) => setSelectedScheduleType(e.target.value)}
                                    label="Horario"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="AM">Mañana</MenuItem>
                                    <MenuItem value="MD">Mediodía</MenuItem>
                                    <MenuItem value="PM">Tarde</MenuItem>
                                    <MenuItem value="EX">Extracurricular</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Fecha Fin"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
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
                                            <TableCell>Fecha</TableCell>
                                            <TableCell>Estudiante</TableCell>
                                            <TableCell>Tipo de Incidente</TableCell>
                                            <TableCell>Horario</TableCell>
                                            <TableCell>Monitora</TableCell>
                                            <TableCell>Placa</TableCell>
                                            <TableCell>Ruta</TableCell>
                                            <TableCell>Colegio</TableCell>
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
                                                    {incident.student?.fullName || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={incident.incidentType === 'otro' && incident.customIncidentType 
                                                            ? `Otro: ${incident.customIncidentType}`
                                                            : INCIDENT_TYPES[incident.incidentType]}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={getScheduleLabel(incident.scheduleType)} 
                                                        size="small"
                                                        color={
                                                            incident.scheduleType === 'AM' ? 'primary' :
                                                            incident.scheduleType === 'MD' ? 'secondary' :
                                                            incident.scheduleType === 'PM' ? 'warning' : 'default'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {incident.monitora?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.bus?.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {incident.school?.name || 'N/A'}
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
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {incidents.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
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
                        {selectedIncident && (
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
                                        Estudiante
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.student?.fullName || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Tipo de Incidente
                                    </Typography>
                                    <Chip 
                                        label={selectedIncident.incidentType === 'otro' && selectedIncident.customIncidentType 
                                            ? `Otro: ${selectedIncident.customIncidentType}`
                                            : INCIDENT_TYPES[selectedIncident.incidentType]}
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Horario
                                    </Typography>
                                    <Chip 
                                        label={getScheduleLabel(selectedIncident.scheduleType)}
                                        color={
                                            selectedIncident.scheduleType === 'AM' ? 'primary' :
                                            selectedIncident.scheduleType === 'MD' ? 'secondary' :
                                            selectedIncident.scheduleType === 'PM' ? 'warning' : 'default'
                                        }
                                        sx={{ mt: 1 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Monitora
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.monitora?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Placa
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.bus?.plate || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Ruta
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.routeNumber || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Colegio
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedIncident.school?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Descripción del Incidente
                                    </Typography>
                                    <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                                        <Typography variant="body1">
                                            {selectedIncident.description}
                                        </Typography>
                                    </Paper>
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

export default StudentIncidentsPage;
