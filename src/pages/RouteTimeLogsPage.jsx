// src/pages/RouteTimeLogsPage.jsx

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
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import moment from 'moment-timezone';
import tw from 'twin.macro';
import { getRouteTimeLogs } from '../services/routeTimeLogService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const RouteTimeLogsPage = () => {
    const [timeLogs, setTimeLogs] = useState([]);
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
    const [selectedSchedule, setSelectedSchedule] = useState('');
    const [selectedDay, setSelectedDay] = useState('');
    const [startDate, setStartDate] = useState(moment().subtract(7, 'days'));
    const [endDate, setEndDate] = useState(moment());

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        averageDuration: 0,
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
        fetchTimeLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedPlate, selectedRoute, selectedSchedule, selectedDay, startDate, endDate]);

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

    const fetchTimeLogs = async () => {
        setLoading(true);
        try {
            const filters = {
                page: page + 1,
                limit: rowsPerPage,
            };

            if (selectedSchool) filters.schoolId = selectedSchool;
            if (selectedPlate) filters.plate = selectedPlate;
            if (selectedRoute) filters.routeNumber = selectedRoute;
            if (selectedSchedule) filters.schedule = selectedSchedule;
            if (selectedDay) filters.day = selectedDay;
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const data = await getRouteTimeLogs(filters);
            
            const logsList = data.timeLogs || data.data || [];
            setTimeLogs(logsList);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            if (logsList.length > 0) {
                const totalDuration = logsList.reduce((sum, log) => sum + (log.tripDuration || 0), 0);
                const avgDuration = totalDuration / logsList.length;

                setStatistics({
                    total: logsList.length,
                    averageDuration: avgDuration.toFixed(2),
                });
            } else {
                setStatistics({
                    total: 0,
                    averageDuration: 0,
                });
            }
        } catch (error) {
            console.error('Error al cargar registros de tiempo:', error);
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
        fetchTimeLogs();
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

    const getDayLabel = (day) => {
        const labels = {
            'monday': 'Lunes',
            'tuesday': 'Martes',
            'wednesday': 'Miércoles',
            'thursday': 'Jueves',
            'friday': 'Viernes',
            'saturday': 'Sábado',
            'sunday': 'Domingo',
        };
        return labels[day] || day;
    };

    const formatTime = (dateTime) => {
        return dateTime ? moment(dateTime).format('HH:mm') : 'N/A';
    };

    const formatDuration = (minutes) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Horarios de Monitoras en Ruta
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza los registros de tiempos de rutas
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Registros
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.total}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Duración Promedio
                                </Typography>
                                <Box display="flex" alignItems="baseline" gap={2}>
                                    <Box>
                                        <Typography variant="h3" component="span">
                                            {Math.floor(parseFloat(statistics.averageDuration) / 60) || 0}
                                        </Typography>
                                        <Typography variant="h6" component="span" color="textSecondary">
                                            {' h '}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="h3" component="span">
                                            {Math.round(parseFloat(statistics.averageDuration) % 60) || 0}
                                        </Typography>
                                        <Typography variant="h6" component="span" color="textSecondary">
                                            {' min'}
                                        </Typography>
                                    </Box>
                                </Box>
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
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Horario</InputLabel>
                                <Select
                                    value={selectedSchedule}
                                    onChange={(e) => setSelectedSchedule(e.target.value)}
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
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Día</InputLabel>
                                <Select
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(e.target.value)}
                                    label="Día"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="monday">Lunes</MenuItem>
                                    <MenuItem value="tuesday">Martes</MenuItem>
                                    <MenuItem value="wednesday">Miércoles</MenuItem>
                                    <MenuItem value="thursday">Jueves</MenuItem>
                                    <MenuItem value="friday">Viernes</MenuItem>
                                    <MenuItem value="saturday">Sábado</MenuItem>
                                    <MenuItem value="sunday">Domingo</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <DatePicker
                                label="Fecha Inicio"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
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
                                            <TableCell>Día</TableCell>
                                            <TableCell>Horario</TableCell>
                                            <TableCell>Monitora</TableCell>
                                            <TableCell>Placa</TableCell>
                                            <TableCell>Ruta</TableCell>
                                            <TableCell>Primera Parada</TableCell>
                                            <TableCell>Última Parada</TableCell>
                                            <TableCell>Salida Colegio</TableCell>
                                            <TableCell>Llegada Colegio</TableCell>
                                            <TableCell align="center">Duración Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {timeLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    {moment(log.fecha).format('DD/MM/YYYY')}
                                                </TableCell>
                                                <TableCell>{getDayLabel(log.day)}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={getScheduleLabel(log.schedule)} 
                                                        size="small"
                                                        color={
                                                            log.schedule === 'AM' ? 'primary' :
                                                            log.schedule === 'MD' ? 'secondary' :
                                                            log.schedule === 'PM' ? 'warning' : 'default'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {log.monitora?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {log.bus?.plate || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {log.routeNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell>{formatTime(log.firstStopTime)}</TableCell>
                                                <TableCell>{formatTime(log.lastStopTime)}</TableCell>
                                                <TableCell>{formatTime(log.schoolDepartureTime)}</TableCell>
                                                <TableCell>{formatTime(log.schoolArrivalTime)}</TableCell>
                                                <TableCell align="center">
                                                    <Chip 
                                                        label={formatDuration(log.tripDuration)}
                                                        size="small"
                                                        color={
                                                            !log.tripDuration ? 'default' :
                                                            log.tripDuration <= 45 ? 'success' :
                                                            log.tripDuration <= 60 ? 'warning' : 'error'
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {timeLogs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={11} align="center">
                                                    No se encontraron registros de tiempos de rutas
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
            </Container>
        </LocalizationProvider>
    );
};

export default RouteTimeLogsPage;
