// src/pages/AttendanceManagementPage.jsx

import React, { useEffect, useState } from 'react';
import {
    Typography,
    TextField,
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
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { 
    Refresh as RefreshIcon, 
    Visibility as VisibilityIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import moment from 'moment-timezone';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import tw from 'twin.macro';
import { getAttendances, getAttendanceDetails } from '../services/attendanceService';
import api from '../utils/axiosConfig';

moment.tz.setDefault('America/Guatemala');

const Container = tw.div`p-8 bg-gray-100 min-h-screen`;

const AttendanceManagementPage = () => {
    const [attendances, setAttendances] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Modal de detalles
    const [openModal, setOpenModal] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [attendanceDetails, setAttendanceDetails] = useState(null);

    // Filtros
    const [schools, setSchools] = useState([]);
    const [buses, setBuses] = useState([]);
    const [schoolRoutes, setSchoolRoutes] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [selectedPlate, setSelectedPlate] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedSchedule, setSelectedSchedule] = useState('');
    const [startDate, setStartDate] = useState(moment().subtract(7, 'days'));
    const [endDate, setEndDate] = useState(moment());

    // Estadísticas
    const [statistics, setStatistics] = useState({
        total: 0,
        averageAttendance: 0,
        totalStudents: 0,
        totalPresent: 0,
    });

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchBusesBySchool(selectedSchool);
            fetchRouteNumbersBySchool(selectedSchool);
        } else {
            setSchoolRoutes([]);
        }
    }, [selectedSchool]);

    useEffect(() => {
        fetchAttendances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, selectedSchool, selectedPlate, selectedRoute, selectedSchedule, startDate, endDate]);

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

    const fetchAttendances = async () => {
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
            if (startDate) filters.startDate = startDate.format('YYYY-MM-DD');
            if (endDate) filters.endDate = endDate.format('YYYY-MM-DD');

            const data = await getAttendances(filters);
            
            setAttendances(data.attendances || data.data || []);
            setTotalCount(data.total || 0);

            // Calcular estadísticas
            const attendanceList = data.attendances || data.data || [];
            if (attendanceList.length > 0) {
                const totalStudents = attendanceList.reduce((sum, att) => sum + (att.totalAlumnos || 0), 0);
                const totalPresent = attendanceList.reduce((sum, att) => sum + (att.alumnosPresentes || 0), 0);
                const avgAttendance = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(2) : 0;

                setStatistics({
                    total: attendanceList.length,
                    averageAttendance: avgAttendance,
                    totalStudents,
                    totalPresent,
                });
            }
        } catch (error) {
            console.error('Error al cargar asistencias:', error);
        } finally {
            setLoading(false);
        }
    };

    // Register page-level refresh handler for global refresh control
    useRegisterPageRefresh(async () => {
        await fetchAttendances();
    }, [fetchAttendances]);

    const handleViewDetails = async (attendance) => {
        setSelectedAttendance(attendance);
        setOpenModal(true);
        setLoadingDetails(true);
        
        try {
            const details = await getAttendanceDetails(attendance.id);
            setAttendanceDetails(details);
        } catch (error) {
            console.error('Error al cargar detalles de asistencia:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseModal = () => {
        setOpenModal(false);
        setSelectedAttendance(null);
        setAttendanceDetails(null);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRefresh = () => {
        fetchAttendances();
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

    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <Container>
                <Box mb={3}>
                    <Typography variant="h4" gutterBottom>
                        Gestión de Asistencias
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Visualiza y analiza los registros de asistencia de las monitoras
                    </Typography>
                </Box>

                {/* Estadísticas */}
                <Grid container spacing={3} mb={3}>
                    <Grid item xs={12} sm={6} md={3}>
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
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Promedio Asistencia
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.averageAttendance}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Alumnos
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.totalStudents}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Alumnos Presentes
                                </Typography>
                                <Typography variant="h4">
                                    {statistics.totalPresent}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filtros */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
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
                        {/* Botón/icono de refresco local eliminado; se usa el boton global*/}
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
                                            <TableCell>Colegio</TableCell>
                                            <TableCell align="center">Total Alumnos</TableCell>
                                            <TableCell align="center">Presentes</TableCell>
                                            <TableCell align="center">% Asistencia</TableCell>
                                            <TableCell align="center">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {attendances.map((attendance) => {
                                            const percentage = attendance.totalAlumnos > 0
                                                ? ((attendance.alumnosPresentes / attendance.totalAlumnos) * 100).toFixed(1)
                                                : 0;
                                            
                                            return (
                                                <TableRow key={attendance.id}>
                                                    <TableCell>
                                                        {moment(attendance.fecha).format('DD/MM/YYYY')}
                                                    </TableCell>
                                                    <TableCell>{getDayLabel(attendance.day)}</TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={getScheduleLabel(attendance.schedule)} 
                                                            size="small"
                                                            color={
                                                                attendance.schedule === 'AM' ? 'primary' :
                                                                attendance.schedule === 'MD' ? 'secondary' :
                                                                attendance.schedule === 'PM' ? 'warning' : 'default'
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {attendance.monitora?.name || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {attendance.bus?.plate || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {attendance.routeNumber || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {attendance.school?.name || 'N/A'}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {attendance.totalAlumnos}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {attendance.alumnosPresentes}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip 
                                                            label={`${percentage}%`}
                                                            size="small"
                                                            color={
                                                                percentage >= 90 ? 'success' :
                                                                percentage >= 70 ? 'warning' : 'error'
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title="Ver lista de alumnos">
                                                            <IconButton 
                                                                size="small"
                                                                color="primary"
                                                                onClick={() => handleViewDetails(attendance)}
                                                            >
                                                                <VisibilityIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {attendances.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
                                                    No se encontraron registros de asistencia
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

                {/* Modal de Detalles de Asistencia */}
                <Dialog 
                    open={openModal} 
                    onClose={handleCloseModal}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        <Typography variant="h6">
                            Lista de Alumnos - Asistencia
                        </Typography>
                        {selectedAttendance && (
                            <Typography variant="body2" color="textSecondary">
                                {moment(selectedAttendance.fecha).format('DD/MM/YYYY')} - {getScheduleLabel(selectedAttendance.schedule)} - {getDayLabel(selectedAttendance.day)}
                            </Typography>
                        )}
                    </DialogTitle>
                    <DialogContent dividers>
                        {loadingDetails ? (
                            <Box display="flex" justifyContent="center" p={3}>
                                <CircularProgress />
                            </Box>
                        ) : attendanceDetails ? (
                            <Box>
                                {/* Resumen */}
                                <Box mb={3}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Typography variant="h6" color="success.main">
                                                        {attendanceDetails.students?.present?.length || 0}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        Alumnos Presentes
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Typography variant="h6" color="error.main">
                                                        {attendanceDetails.students?.absent?.length || 0}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        Alumnos Ausentes
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </Box>

                                {/* Lista de Presentes */}
                                {attendanceDetails.students?.present && attendanceDetails.students.present.length > 0 && (
                                    <Box mb={3}>
                                        <Typography variant="subtitle1" gutterBottom color="success.main" fontWeight="bold">
                                            ✓ Presentes ({attendanceDetails.students.present.length})
                                        </Typography>
                                        <List dense>
                                            {attendanceDetails.students.present.map((student) => (
                                                <ListItem key={student.id}>
                                                    <ListItemIcon>
                                                        <CheckCircleIcon color="success" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={student.fullName} />
                                                </ListItem>
                                            ))}
                                        </List>
                                        <Divider />
                                    </Box>
                                )}

                                {/* Lista de Ausentes */}
                                {attendanceDetails.students?.absent && attendanceDetails.students.absent.length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle1" gutterBottom color="error.main" fontWeight="bold">
                                            ✗ Ausentes ({attendanceDetails.students.absent.length})
                                        </Typography>
                                        <List dense>
                                            {attendanceDetails.students.absent.map((student) => (
                                                <ListItem key={student.id}>
                                                    <ListItemIcon>
                                                        <CancelIcon color="error" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={student.fullName} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                )}

                                {(!attendanceDetails.students?.present?.length && !attendanceDetails.students?.absent?.length) && (
                                    <Typography align="center" color="textSecondary">
                                        No hay información de estudiantes para este registro
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            <Typography align="center" color="textSecondary">
                                No se pudieron cargar los detalles
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseModal} color="primary">
                            Cerrar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </LocalizationProvider>
    );
};

export default AttendanceManagementPage;
