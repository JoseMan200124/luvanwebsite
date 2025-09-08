// src/pages/SchoolDashboardPage.jsx

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Grid,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { 
    School as SchoolIcon, 
    CalendarToday,
    DirectionsBus,
    Group,
    ArrowBack,
    TrendingUp,
    People
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import RouteStudentsModal from '../components/modals/RouteStudentsModal';
import { generateRouteOccupancyPDF } from '../utils/pdfExport';

const PageContainer = styled.div`
    ${tw`bg-gray-50 min-h-screen w-full`}
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;

    @media (max-width: 640px) {
        padding: 1rem;
    }
`;

const HeaderCard = styled(Card)`
    ${tw`mb-6 shadow-lg`}
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
`;

const SummaryCard = styled(Card)`
    ${tw`h-full`}
    box-shadow: none;
    &:hover {
        box-shadow: none;
    }
`;

const SchoolDashboardPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { schoolYear, schoolId } = useParams();

    const [schoolData, setSchoolData] = useState(null);
    const [routeOccupancy, setRouteOccupancy] = useState([]);
    const [userSummary, setUserSummary] = useState({
        completa: 0,
        mediaAM: 0,
        mediaPM: 0,
        total: 0
    });
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estado para el modal de estudiantes por ruta
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState({ routeNumber: '', scheduleCode: '' });
    
    // Estado para el filtro de día (default Lunes)
    const [selectedDay, setSelectedDay] = useState('monday');
    const weekdays = ['monday','tuesday','wednesday','thursday','friday'];

    // Obtener datos del estado de navegación si están disponibles
    const stateSchool = location.state?.school;
    const stateSchoolYear = location.state?.schoolYear;

    const fetchSchoolData = useCallback(async () => {
        if (!schoolId) return;
        
        try {
            const response = await api.get(`/schools/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            setSchoolData(response.data.school);
        } catch (err) {
            console.error('Error fetching school data:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener datos del colegio', 
                severity: 'error' 
            });
        }
    }, [auth.token, schoolId]);

    const fetchRouteOccupancy = useCallback(async () => {
        if (!schoolId) return;
        
        try {
            const response = await api.get(`/routes/occupancy/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    schoolYear: schoolYear,
                    day: selectedDay
                }
            });
            setRouteOccupancy(response.data.routes || []);
        } catch (err) {
            console.error('Error fetching route occupancy:', err);
            // Datos de ejemplo con el nuevo formato
            setRouteOccupancy([
                { routeNumber: '1', AM: 25, PM: 18, MD: 12, EX: 8 },
                { routeNumber: '2', AM: 20, PM: 22, MD: 15, EX: 5 },
                { routeNumber: '3', AM: 18, PM: 25, MD: 10, EX: 12 },
                { routeNumber: '4', AM: 22, PM: 20, MD: 8, EX: 6 }
            ]);
        }
    }, [auth.token, schoolId, schoolYear, selectedDay]);

    const fetchUserSummary = useCallback(async () => {
        if (!schoolId) return;
        
        try {
            const response = await api.get(`/parents/summary/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    schoolYear: schoolYear
                }
            });
            
            const summary = response.data.summary || {};
            setUserSummary({
                completa: summary.completa || 0,
                mediaAM: summary.mediaAM || 0,
                mediaPM: summary.mediaPM || 0,
                total: (summary.completa || 0) + (summary.mediaAM || 0) + (summary.mediaPM || 0)
            });
        } catch (err) {
            console.error('Error fetching user summary:', err);
            // Por ahora usamos datos de ejemplo
            setUserSummary({
                completa: 45,
                mediaAM: 23,
                mediaPM: 18,
                total: 86
            });
        }
    }, [auth.token, schoolId, schoolYear]);

    useEffect(() => {
        if (auth.token && schoolId) {
            setLoading(true);
            Promise.all([
                fetchSchoolData(),
                fetchRouteOccupancy(),
                fetchUserSummary()
            ]).finally(() => {
                setLoading(false);
            });
        }
    }, [auth.token, schoolId, fetchSchoolData, fetchRouteOccupancy, fetchUserSummary]);

    const handleBackToSelection = () => {
        navigate('/admin/escuelas');
    };

    const handleViewUsers = () => {
        navigate(`/admin/escuelas/${schoolYear}/${schoolId}/usuarios`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: schoolData || stateSchool
            }
        });
    };

    const handleViewBuses = () => {
        navigate(`/admin/escuelas/${schoolYear}/${schoolId}/buses-gestion`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: schoolData || stateSchool
            }
        });
    };

    const handleRouteScheduleClick = (routeNumber, scheduleCode) => {
        setSelectedRoute({ routeNumber, scheduleCode });
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedRoute({ routeNumber: '', scheduleCode: '' });
    };

    const getDayLabel = (day) => {
        const dayLabels = {
            'monday': 'Lunes',
            'tuesday': 'Martes', 
            'wednesday': 'Miércoles',
            'thursday': 'Jueves',
            'friday': 'Viernes',
            'saturday': 'Sábado',
            'sunday': 'Domingo'
        };
        return dayLabels[day] || day;
    };

    const currentSchool = schoolData || stateSchool;
    const currentSchoolYear = schoolYear || stateSchoolYear;

    const dayLabels = {
        'monday': 'Lunes',
        'tuesday': 'Martes',
        'wednesday': 'Miércoles',
        'thursday': 'Jueves',
        'friday': 'Viernes'
    };

    const exportAllDaysPDF = async () => {
        if (!schoolId) return;
        try {
            const dayMap = {};
            // fetch occupancy for each weekday
            await Promise.all(weekdays.map(async (d) => {
                const resp = await api.get(`/routes/occupancy/${schoolId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                    params: { schoolYear: schoolYear, day: d }
                });
                dayMap[d] = resp.data.routes || [];
            }));

            generateRouteOccupancyPDF(dayMap, {
                schoolName: currentSchool?.name || '',
                schoolYear: currentSchoolYear || '',
                generatedAt: new Date(),
                dayLabels
            });
        } catch (err) {
            console.error('Error fetching occupancy for all days:', err);
            setSnackbar({ open: true, message: 'Error al generar PDF de todos los días', severity: 'error' });
        }
    };

    // Totals for route occupancy columns
    const totals = routeOccupancy.reduce((acc, r) => ({
        AM: acc.AM + (Number(r.AM) || 0),
        MD: acc.MD + (Number(r.MD) || 0),
        PM: acc.PM + (Number(r.PM) || 0),
        EX: acc.EX + (Number(r.EX) || 0)
    }), { AM: 0, MD: 0, PM: 0, EX: 0 });

    if (loading && !currentSchool) {
        return (
            <PageContainer>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <CircularProgress size={60} />
                </Box>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* Header */}
            <HeaderCard>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBackToSelection}
                            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                        >
                            Volver
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SchoolIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                {currentSchool?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Ciclo Escolar ${currentSchoolYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                    {currentSchool?.city}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </HeaderCard>

            <Grid container spacing={3}>
                {/* Sección A: Resumen de ocupación por ruta */}
                <Grid item xs={12} lg={8}>
                    <SummaryCard>
                        <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DirectionsBus color="primary" />
                                Resumen de Ocupación por Ruta y Horario
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            
                            {/* Filtro por día */}
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel>Filtrar por día</InputLabel>
                                    <Select
                                        value={selectedDay}
                                        label="Filtrar por día"
                                        onChange={(e) => setSelectedDay(e.target.value)}
                                    >
                                        <MenuItem value="monday">Lunes</MenuItem>
                                        <MenuItem value="tuesday">Martes</MenuItem>
                                        <MenuItem value="wednesday">Miércoles</MenuItem>
                                        <MenuItem value="thursday">Jueves</MenuItem>
                                        <MenuItem value="friday">Viernes</MenuItem>
                                    </Select>
                                </FormControl>
                                <Typography variant="body2" color="textSecondary">
                                    {`Mostrando solo ${getDayLabel(selectedDay)}`}
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="small"
                                    color="primary"
                                    onClick={exportAllDaysPDF}
                                >
                                    Exportar PDF (Todos los días)
                                </Button>
                                {selectedDay !== 'monday' && (
                                    <Chip 
                                        label={`Filtro: ${getDayLabel(selectedDay)}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        onDelete={() => setSelectedDay('monday')}
                                    />
                                )}
                            </Box>
                            
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : routeOccupancy.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <DirectionsBus sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                                    <Typography variant="body1" color="textSecondary">
                                        No hay rutas configuradas para este colegio
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} sx={{ maxHeight: 600, boxShadow: 'none', elevation: 0 }}>
                                    <Table stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Número de Ruta
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Horario AM
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Horario MD
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Horario PM
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Horario EX
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Total
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {routeOccupancy.map((route, index) => {
                                                const rowTotal = (Number(route.AM) || 0) + (Number(route.MD) || 0) + (Number(route.PM) || 0) + (Number(route.EX) || 0);
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                Ruta {route.routeNumber}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Button
                                                                variant="contained"
                                                                color="primary"
                                                                size="small"
                                                                disableElevation
                                                                disableRipple
                                                                sx={{ 
                                                                    minWidth: '60px',
                                                                    boxShadow: 'none',
                                                                    backgroundColor: route.AM > 0 ? 'primary.main' : 'grey.300',
                                                                    color: route.AM > 0 ? 'white' : 'grey.600',
                                                                    '&:hover': {
                                                                        backgroundColor: route.AM > 0 ? 'primary.dark' : 'grey.400',
                                                                        boxShadow: 'none'
                                                                    }
                                                                }}
                                                                onClick={() => handleRouteScheduleClick(route.routeNumber, 'AM')}
                                                            >
                                                                {route.AM}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Button
                                                                variant="contained"
                                                                color="warning"
                                                                size="small"
                                                                disableElevation
                                                                disableRipple
                                                                sx={{ 
                                                                    minWidth: '60px',
                                                                    boxShadow: 'none',
                                                                    backgroundColor: route.MD > 0 ? 'warning.main' : 'grey.300',
                                                                    color: route.MD > 0 ? 'white' : 'grey.600',
                                                                    '&:hover': {
                                                                        backgroundColor: route.MD > 0 ? 'warning.dark' : 'grey.400',
                                                                        boxShadow: 'none'
                                                                    }
                                                                }}
                                                                onClick={() => handleRouteScheduleClick(route.routeNumber, 'MD')}
                                                            >
                                                                {route.MD}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Button
                                                                variant="contained"
                                                                color="success"
                                                                size="small"
                                                                disableElevation
                                                                disableRipple
                                                                sx={{ 
                                                                    minWidth: '60px',
                                                                    boxShadow: 'none',
                                                                    backgroundColor: route.PM > 0 ? 'success.main' : 'grey.300',
                                                                    color: route.PM > 0 ? 'white' : 'grey.600',
                                                                    '&:hover': {
                                                                        backgroundColor: route.PM > 0 ? 'success.dark' : 'grey.400',
                                                                        boxShadow: 'none'
                                                                    }
                                                                }}
                                                                onClick={() => handleRouteScheduleClick(route.routeNumber, 'PM')}
                                                            >
                                                                {route.PM}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Button
                                                                variant="contained"
                                                                color="info"
                                                                size="small"
                                                                disableElevation
                                                                disableRipple
                                                                sx={{ 
                                                                    minWidth: '60px',
                                                                    boxShadow: 'none',
                                                                    backgroundColor: route.EX > 0 ? 'info.main' : 'grey.300',
                                                                    color: route.EX > 0 ? 'white' : 'grey.600',
                                                                    '&:hover': {
                                                                        backgroundColor: route.EX > 0 ? 'info.dark' : 'grey.400',
                                                                        boxShadow: 'none'
                                                                    }
                                                                }}
                                                                onClick={() => handleRouteScheduleClick(route.routeNumber, 'EX')}
                                                            >
                                                                {route.EX}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                {rowTotal}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {/* Total row */}
                                            <TableRow>
                                                <TableCell>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        Total
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {totals.AM}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {totals.MD}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {totals.PM}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {totals.EX}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </SummaryCard>
                </Grid>

                {/* Sección B: Resumen de usuarios y acciones */}
                <Grid item xs={12} lg={4}>
                    <Grid container spacing={3}>
                        {/* Sub-sección 1: Resumen de usuarios activos */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp color="primary" />
                                        Usuarios Activos
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    
                                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                                        <Typography variant="h3" color="primary" fontWeight="bold">
                                            {userSummary.total}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Total de usuarios
                                        </Typography>
                                    </Box>

                                    <List dense>
                                        <ListItem>
                                            <ListItemIcon>
                                                <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: 'success.main' 
                                                }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Completa" 
                                                secondary={`${userSummary.completa} usuarios`}
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon>
                                                <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: 'warning.main' 
                                                }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Media AM" 
                                                secondary={`${userSummary.mediaAM} usuarios`}
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon>
                                                <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: 'info.main' 
                                                }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Media PM" 
                                                secondary={`${userSummary.mediaPM} usuarios`}
                                            />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </SummaryCard>
                        </Grid>

                        {/* Sub-sección 2: Botón de usuarios */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <People sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Gestión de Usuarios
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                        Ver y gestionar todos los usuarios registrados en este colegio
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        startIcon={<Group />}
                                        onClick={handleViewUsers}
                                        fullWidth
                                        sx={{ borderRadius: 2 }}
                                    >
                                        Ver Usuarios
                                    </Button>
                                </CardContent>
                            </SummaryCard>
                        </Grid>
                        {/* Sub-sección 3: Botón de buses */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <DirectionsBus sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Gestión de Buses
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                        Ver y gestionar los buses asignados a este colegio
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        startIcon={<DirectionsBus />}
                                        onClick={handleViewBuses}
                                        fullWidth
                                        sx={{ borderRadius: 2 }}
                                    >
                                        Ver Buses
                                    </Button>
                                </CardContent>
                            </SummaryCard>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            {/* Modal para mostrar estudiantes por ruta y horario */}
            <RouteStudentsModal
                open={modalOpen}
                onClose={handleCloseModal}
                routeNumber={selectedRoute.routeNumber}
                scheduleCode={selectedRoute.scheduleCode}
                schoolId={schoolId}
                schoolYear={schoolYear || stateSchoolYear}
                selectedDay={selectedDay}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </PageContainer>
    );
};

export default SchoolDashboardPage;
