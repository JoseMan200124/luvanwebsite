// src/pages/SchoolDashboardPage.jsx

import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
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
    MenuItem,
    IconButton
} from '@mui/material';
import { 
    School as SchoolIcon, 
    CalendarToday,
    DirectionsBus,
    Group,
    ArrowBack,
    TrendingUp,
    People,
    Description as ContractIcon,
    Payment as PaymentIcon,
    Policy as ProtocolIcon,
    ChevronLeft,
    ChevronRight
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import RouteStudentsModal from '../components/modals/RouteStudentsModal';
import { generateRouteOccupancyPDF } from '../utils/pdfExport';
import PermissionGuard from '../components/PermissionGuard';

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

// Estados de servicio disponibles en el carrusel de contadores
const CAROUSEL_STATUSES = [
    { key: 'ACTIVE',    label: 'Servicio Activo',      textColor: 'primary.main' },
    { key: 'SUSPENDED', label: 'Servicio Suspendido',   textColor: 'error.main' },
    { key: 'PAUSED',    label: 'Servicio Pausado',      textColor: 'warning.main' },
    { key: 'INACTIVE',  label: 'Servicio Inactivo',     textColor: 'text.secondary' }
];

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
    const [studentSummary, setStudentSummary] = useState({
        completa: 0,
        mediaAM: 0,
        mediaPM: 0,
        inactive: 0,
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

    // Estado para el carrusel de estado del servicio en los contadores
    const [statusSlideIndex, setStatusSlideIndex] = useState(0);
    // Ref para leer siempre el slide actual dentro de callbacks sin añadir dependencias extra
    const statusSlideIndexRef = useRef(0);
    useEffect(() => { statusSlideIndexRef.current = statusSlideIndex; }, [statusSlideIndex]);

    // Estado para el bloque de "utilizan / no utilizan el servicio"
    const [serviceUsageSummary, setServiceUsageSummary] = useState({
        familiesUsing: 0,
        familiesNotUsing: 0,
        studentsUsing: 0,
        studentsNotUsing: 0
    });

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

    const fetchUserSummary = useCallback(async (serviceStatus = 'ACTIVE') => {
        if (!schoolId) return;
        
        try {
            const response = await api.get(`/parents/summary/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: { schoolYear: schoolYear, serviceStatus }
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
            setUserSummary({ completa: 0, mediaAM: 0, mediaPM: 0, total: 0 });
        }
    }, [auth.token, schoolId, schoolYear]);

    const fetchStudentSummary = useCallback(async (serviceStatus = 'ACTIVE') => {
        if (!schoolId) return;
        
        try {
            const response = await api.get(`/students/summary/${schoolId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: { schoolYear: schoolYear, serviceStatus }
            });
            
            const summary = response.data.summary || {};
            const completa = summary.completa || 0;
            const mediaAM = summary.mediaAM || 0;
            const mediaPM = summary.mediaPM || 0;
            const inactive = summary.inactive || 0;
            // The backend returns `summary.total` as the sum of route-type counters.
            // Prefer that value; fall back to the sum of route-types (exclude inactive)
            const total = typeof summary.total === 'number' ? summary.total : (completa + mediaAM + mediaPM);
            setStudentSummary({
                completa,
                mediaAM,
                mediaPM,
                inactive,
                total
            });
        } catch (err) {
            console.error('Error fetching student summary:', err);
            setStudentSummary({ completa: 0, mediaAM: 0, mediaPM: 0, inactive: 0, total: 0 });
        }
    }, [auth.token, schoolId, schoolYear]);

    // Obtiene contadores globales: cuántas familias/estudiantes usan vs no usan el servicio
    const fetchServiceUsageSummary = useCallback(async () => {
        if (!schoolId) return;
        const USING     = ['ACTIVE', 'SUSPENDED'];
        const NOT_USING = ['PAUSED', 'INACTIVE'];
        const allStatuses = [...USING, ...NOT_USING];

        try {
            const [famResults, stuResults] = await Promise.all([
                Promise.all(allStatuses.map(s =>
                    api.get(`/parents/summary/${schoolId}`, {
                        headers: { Authorization: `Bearer ${auth.token}` },
                        params: { schoolYear, serviceStatus: s }
                    }).then(r => ({ status: s, total: (r.data.summary?.completa || 0) + (r.data.summary?.mediaAM || 0) + (r.data.summary?.mediaPM || 0), inactive: r.data.summary?.inactive || 0 }))
                    .catch(() => ({ status: s, total: 0, inactive: 0 }))
                )),
                Promise.all(allStatuses.map(s =>
                    api.get(`/students/summary/${schoolId}`, {
                        headers: { Authorization: `Bearer ${auth.token}` },
                        params: { schoolYear, serviceStatus: s }
                    }).then(r => ({ status: s, total: (r.data.summary?.completa || 0) + (r.data.summary?.mediaAM || 0) + (r.data.summary?.mediaPM || 0), inactive: r.data.summary?.inactive || 0 }))
                    .catch(() => ({ status: s, total: 0, inactive: 0 }))
                ))
            ]);

            // The API's per-status `total` already counts students/families for that status
            // (route-type counters include those users), so use `total` directly to avoid double-counting.
            const famMap = Object.fromEntries(famResults.map(r => [r.status, r.total]));
            const stuMap = Object.fromEntries(stuResults.map(r => [r.status, r.total]));

            setServiceUsageSummary({
                familiesUsing:    USING.reduce((acc, s) => acc + (famMap[s] || 0), 0),
                familiesNotUsing: NOT_USING.reduce((acc, s) => acc + (famMap[s] || 0), 0),
                studentsUsing:    USING.reduce((acc, s) => acc + (stuMap[s] || 0), 0),
                studentsNotUsing: NOT_USING.reduce((acc, s) => acc + (stuMap[s] || 0), 0)
            });
        } catch (err) {
            console.error('Error fetching service usage summary:', err);
        }
    }, [auth.token, schoolId, schoolYear]);

    useEffect(() => {
        if (auth.token && schoolId) {
            setLoading(true);
            Promise.all([
                fetchSchoolData(),
                fetchRouteOccupancy(),
                fetchUserSummary(CAROUSEL_STATUSES[statusSlideIndexRef.current].key),
                fetchStudentSummary(CAROUSEL_STATUSES[statusSlideIndexRef.current].key),
                fetchServiceUsageSummary()
            ]).finally(() => {
                setLoading(false);
            });
        }
    }, [auth.token, schoolId, fetchSchoolData, fetchRouteOccupancy, fetchUserSummary, fetchStudentSummary, fetchServiceUsageSummary]);

    useRegisterPageRefresh(async () => {
        setLoading(true);
        const currentStatus = CAROUSEL_STATUSES[statusSlideIndexRef.current].key;
        try {
            await Promise.all([fetchSchoolData(), fetchRouteOccupancy(), fetchUserSummary(currentStatus), fetchStudentSummary(currentStatus), fetchServiceUsageSummary()]);
        } finally {
            setLoading(false);
        }
    }, [fetchSchoolData, fetchRouteOccupancy, fetchUserSummary, fetchStudentSummary, fetchServiceUsageSummary]);

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

    const handleViewPayments = () => {
        navigate(`/admin/escuelas/${schoolYear}/${schoolId}/pagos`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: schoolData || stateSchool
            }
        });
    };

    const handleViewContracts = () => {
        navigate(`/admin/escuelas/${schoolYear}/${schoolId}/contratos`, {
            state: {
                schoolYear: schoolYear || stateSchoolYear,
                school: schoolData || stateSchool
            }
        });
    };

    const handleViewProtocols = () => {
        navigate(`/admin/escuelas/${schoolYear}/${schoolId}/protocolos`, {
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

    // Carrusel: navegar entre estados de servicio y refrescar ambos contadores
    const handleSlideChange = (delta) => {
        const newIndex = (statusSlideIndex + delta + CAROUSEL_STATUSES.length) % CAROUSEL_STATUSES.length;
        setStatusSlideIndex(newIndex);
        const newStatus = CAROUSEL_STATUSES[newIndex].key;
        fetchUserSummary(newStatus);
        fetchStudentSummary(newStatus);
    };

    const activeCarouselStatus = CAROUSEL_STATUSES[statusSlideIndex];

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
                        {/* Sub-sección 1: Uso del Servicio */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                        Uso del Servicio
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <Grid container spacing={2}>
                                        {/* Utilizan el servicio */}
                                        <Grid item xs={6}>
                                            <Box sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                bgcolor: 'success.50',
                                                border: '1px solid',
                                                borderColor: 'success.200',
                                                textAlign: 'center'
                                            }}>
                                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    Utilizan el servicio
                                                </Typography>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 0.5 }}>
                                                    <Box>
                                                        <Typography variant="h5" color="success.main" fontWeight="bold">
                                                            {serviceUsageSummary.familiesUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Familias
                                                        </Typography>
                                                    </Box>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Box>
                                                        <Typography variant="h5" color="success.main" fontWeight="bold">
                                                            {serviceUsageSummary.studentsUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Estudiantes
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.75 }}>
                                                    Activo + Suspendido
                                                </Typography>
                                            </Box>
                                        </Grid>

                                        {/* No utilizan el servicio */}
                                        <Grid item xs={6}>
                                            <Box sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                bgcolor: 'grey.50',
                                                border: '1px solid',
                                                borderColor: 'grey.300',
                                                textAlign: 'center'
                                            }}>
                                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    No utilizan el servicio
                                                </Typography>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 0.5 }}>
                                                    <Box>
                                                        <Typography variant="h5" color="text.secondary" fontWeight="bold">
                                                            {serviceUsageSummary.familiesNotUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Familias
                                                        </Typography>
                                                    </Box>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Box>
                                                        <Typography variant="h5" color="text.secondary" fontWeight="bold">
                                                            {serviceUsageSummary.studentsNotUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Estudiantes
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.75 }}>
                                                    Pausado + Inactivo
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </SummaryCard>
                        </Grid>

                        {/* Sub-sección 2: Resumen de familias y estudiantes registrados */}
                        <Grid item xs={12}>
                            <Grid container spacing={2}>
                                {/* Familias - carrusel por estado del servicio */}
                                <Grid item xs={12} md={6}>
                                    <SummaryCard>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <People color="primary" />
                                                Familias
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />

                                            {/* Carrusel: flechas + contador grande */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                                <IconButton size="small" onClick={() => handleSlideChange(-1)} aria-label="Estado anterior">
                                                    <ChevronLeft />
                                                </IconButton>
                                                <Box sx={{ textAlign: 'center', minWidth: 130 }}>
                                                    <Typography variant="h3" sx={{ color: activeCarouselStatus.textColor }} fontWeight="bold">
                                                        {userSummary.total}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" noWrap>
                                                        {activeCarouselStatus.label}
                                                    </Typography>
                                                </Box>
                                                <IconButton size="small" onClick={() => handleSlideChange(1)} aria-label="Estado siguiente">
                                                    <ChevronRight />
                                                </IconButton>
                                            </Box>

                                            {/* Indicadores de posición */}
                                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mb: 1.5 }}>
                                                {CAROUSEL_STATUSES.map((s, i) => (
                                                    <Box
                                                        key={s.key}
                                                        onClick={() => { setStatusSlideIndex(i); fetchUserSummary(s.key); fetchStudentSummary(s.key); }}
                                                        sx={{
                                                            width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                                                            backgroundColor: i === statusSlideIndex ? 'primary.main' : 'grey.300',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    />
                                                ))}
                                            </Box>

                                            <List dense>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'success.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Completa" secondary={`${userSummary.completa}`} />
                                                </ListItem>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'warning.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Media AM" secondary={`${userSummary.mediaAM}`} />
                                                </ListItem>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'info.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Media PM" secondary={`${userSummary.mediaPM}`} />
                                                </ListItem>
                                            </List>
                                        </CardContent>
                                    </SummaryCard>
                                </Grid>

                                {/* Estudiantes - carrusel por estado del servicio (sincronizado con Familias) */}
                                <Grid item xs={12} md={6}>
                                    <SummaryCard>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Group color="primary" />
                                                Estudiantes
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />

                                            {/* Carrusel: mismo estado que Familias */}
                                            <Box sx={{ textAlign: 'center', mb: 0.5 }}>
                                                <Typography variant="h3" sx={{ color: activeCarouselStatus.textColor }} fontWeight="bold">
                                                    {studentSummary.total}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {activeCarouselStatus.label}
                                                </Typography>
                                            </Box>

                                            {/* Indicadores de posición */}
                                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mb: 1.5 }}>
                                                {CAROUSEL_STATUSES.map((s, i) => (
                                                    <Box
                                                        key={s.key}
                                                        onClick={() => { setStatusSlideIndex(i); fetchUserSummary(s.key); fetchStudentSummary(s.key); }}
                                                        sx={{
                                                            width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                                                            backgroundColor: i === statusSlideIndex ? 'primary.main' : 'grey.300',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    />
                                                ))}
                                            </Box>

                                            <List dense>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'success.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Completa" secondary={`${studentSummary.completa}`} />
                                                </ListItem>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'warning.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Media AM" secondary={`${studentSummary.mediaAM}`} />
                                                </ListItem>
                                                <ListItem disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'info.main' }} />
                                                    </ListItemIcon>
                                                    <ListItemText primary="Media PM" secondary={`${studentSummary.mediaPM}`} />
                                                </ListItem>
                                            </List>
                                        </CardContent>
                                    </SummaryCard>
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Compact: mostrar 2 tarjetas visibles y el resto en un contenedor scrollable */}
                        <Grid item xs={12}>
                            <Box sx={{ maxHeight: 480, overflowY: 'auto', pr: 1 }}>
                                <Grid container spacing={2}>
                                    {/* Sub-sección 3: Botón de usuarios */}
                                    <PermissionGuard permission="colegios-familias">
                                        <Grid item xs={12}>
                                            <SummaryCard>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <People sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                    <Typography variant="h6" gutterBottom>
                                                        Gestión de Familias
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                        Ver y gestionar todas las familias registradas en este colegio
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
                                                        Ver Familias
                                                    </Button>
                                                </CardContent>
                                            </SummaryCard>
                                        </Grid>
                                    </PermissionGuard>

                                    {/* Sub-sección 3: Botón de pagos */}
                                    <PermissionGuard permission="colegios-pagos">
                                        <Grid item xs={12}>
                                            <SummaryCard>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <PaymentIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                    <Typography variant="h6" gutterBottom>
                                                        Gestión de Pagos
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                        Accede al panel de pagos y cobros específico de este colegio
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="large"
                                                        startIcon={<PaymentIcon />}
                                                        onClick={handleViewPayments}
                                                        fullWidth
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Ver Pagos
                                                    </Button>
                                                </CardContent>
                                            </SummaryCard>
                                        </Grid>
                                    </PermissionGuard>

                                    {/* Sub-sección 4: Botón de buses */}
                                    <PermissionGuard permission="colegios-gestion-buses">
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
                                    </PermissionGuard>

                                    {/* Sub-sección 5: Botón de contratos */}
                                    <PermissionGuard permission="colegios-contratos">
                                        <Grid item xs={12}>
                                            <SummaryCard>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <ContractIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                    <Typography variant="h6" gutterBottom>
                                                        Gestión de Contratos
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                        Ver y gestionar los contratos específicos de este colegio
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="large"
                                                        startIcon={<ContractIcon />}
                                                        onClick={handleViewContracts}
                                                        fullWidth
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Ver Contratos
                                                    </Button>
                                                </CardContent>
                                            </SummaryCard>
                                        </Grid>
                                    </PermissionGuard>

                                    {/* Sub-sección 6: Botón de protocolos */}
                                    <PermissionGuard permission="colegios-protocolos-reglamentos">
                                        <Grid item xs={12}>
                                            <SummaryCard>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <ProtocolIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                    <Typography variant="h6" gutterBottom>
                                                        Protocolos y Reglamentos
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                        Ver y gestionar protocolos y reglamentos de este colegio
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="large"
                                                        startIcon={<ProtocolIcon />}
                                                        onClick={handleViewProtocols}
                                                        fullWidth
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        Ver Protocolos
                                                    </Button>
                                                </CardContent>
                                            </SummaryCard>
                                        </Grid>
                                    </PermissionGuard>
                                </Grid>
                            </Box>
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
