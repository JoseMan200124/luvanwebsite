// src/pages/CorporateDashboardPage.jsx

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
    Business as CorporationIcon, 
    CalendarToday,
    DirectionsBus,
    Group,
    ArrowBack,
    TrendingUp,
    People,
    Description as ContractIcon,
    Work as DepartmentIcon,
    ChevronLeft,
    ChevronRight
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import useRegisterPageRefresh from '../hooks/useRegisterPageRefresh';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import RouteColaboradoresModal from '../components/modals/RouteColaboradoresModal';
import { generateCorporateRouteOccupancyPDF } from '../utils/pdfExport';

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
    { key: 'PAUSED',    label: 'Servicio Pausado',      textColor: 'warning.main' },
    { key: 'INACTIVE',  label: 'Servicio Inactivo',     textColor: 'text.secondary' }
];

const CorporateDashboardPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { fiscalYear, corporationId } = useParams();

    const [corporationData, setCorporationData] = useState(null);
    const [routeOccupancy, setRouteOccupancy] = useState([]);
    const [colaboradorSummary, setColaboradorSummary] = useState({
        total: 0,
        active: 0,
        byDepartment: []
    });
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estado para el filtro de día (default Lunes)
    const [selectedDay, setSelectedDay] = useState('monday');
    
    // Estado para el carrusel de estado del servicio en los contadores
    const [statusSlideIndex, setStatusSlideIndex] = useState(0);
    // Ref para leer siempre el slide actual dentro de callbacks sin añadir dependencias extra
    const statusSlideIndexRef = useRef(0);
    useEffect(() => { statusSlideIndexRef.current = statusSlideIndex; }, [statusSlideIndex]);

    // Resumen de colaboradores por estado de servicio (para el carrusel)
    const [colaboradorStatusSummary, setColaboradorStatusSummary] = useState({ total: 0 });

    // Estado para el bloque de "utilizan / no utilizan el servicio"
    const [serviceUsageSummary, setServiceUsageSummary] = useState({
        colaboradoresUsing: 0,
        colaboradoresNotUsing: 0
    });

    // Estado para el modal de colaboradores por ruta
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState({
        routeNumber: null,
        scheduleIndex: null,
        scheduleName: '',
        stopType: ''
    });

    // Obtener datos del estado de navegación si están disponibles
    const stateCorporation = location.state?.corporation;
    const stateFiscalYear = location.state?.fiscalYear;

    const fetchCorporationData = useCallback(async () => {
        if (!corporationId) return;
        
        try {
            const response = await api.get(`/corporations/${corporationId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                }
            });
            const corp = response.data.corporation;
            
            // Parse JSON fields
            let parsedDepartments = [];
            if (typeof corp.departments === 'string' && corp.departments.trim()) {
                try {
                    parsedDepartments = JSON.parse(corp.departments);
                } catch {
                    parsedDepartments = [];
                }
            } else if (Array.isArray(corp.departments)) {
                parsedDepartments = corp.departments;
            }
            
            let parsedRoutes = [];
            if (typeof corp.routeNumbers === 'string' && corp.routeNumbers.trim()) {
                try {
                    parsedRoutes = JSON.parse(corp.routeNumbers);
                } catch {
                    parsedRoutes = [];
                }
            } else if (Array.isArray(corp.routeNumbers)) {
                parsedRoutes = corp.routeNumbers;
            }
            
            let parsedBusinessHours = { start: '08:00', end: '17:00' };
            if (typeof corp.businessHours === 'string' && corp.businessHours.trim()) {
                try {
                    parsedBusinessHours = JSON.parse(corp.businessHours);
                } catch {
                    // keep default
                }
            } else if (typeof corp.businessHours === 'object' && corp.businessHours !== null) {
                parsedBusinessHours = corp.businessHours;
            }
            
            setCorporationData({
                ...corp,
                departments: parsedDepartments,
                routeNumbers: parsedRoutes,
                businessHours: parsedBusinessHours
            });
        } catch (err) {
            console.error('Error fetching corporation data:', err);
            setSnackbar({ 
                open: true, 
                message: 'Error al obtener datos de la corporación', 
                severity: 'error' 
            });
        }
    }, [auth.token, corporationId]);

    const fetchRouteOccupancy = useCallback(async () => {
        if (!corporationId) return;
        
        try {
            const response = await api.get(`/routes/occupancy-corporate/${corporationId}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear,
                    day: selectedDay
                }
            });
            setRouteOccupancy(response.data.routes || []);
        } catch (err) {
            console.error('Error fetching route occupancy:', err);
            setRouteOccupancy([]);
        }
    }, [auth.token, corporationId, fiscalYear, selectedDay]);

    const fetchColaboradorSummary = useCallback(async () => {
        if (!corporationId) return;
        
        try {
            const response = await api.get(`/corporations/${corporationId}/colaboradores`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear
                }
            });
            
            const colaboradores = response.data.colaboradores || [];
            
            // Count by department
            const departmentCounts = {};
            colaboradores.forEach(emp => {
                if (emp.FamilyDetail?.department) {
                    const dept = emp.FamilyDetail.department;
                    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
                }
            });
            
            const byDepartment = Object.entries(departmentCounts).map(([name, count]) => ({
                name,
                count
            }));
            
            setColaboradorSummary({
                total: colaboradores.length,
                active: colaboradores.filter(emp => Number(emp.state) === 1).length,
                byDepartment
            });
        } catch (err) {
            console.error('Error fetching colaborador summary:', err);
            // Por ahora usamos datos de ejemplo
            setColaboradorSummary({
                total: 45,
                active: 42,
                byDepartment: []
            });
        }
    }, [auth.token, corporationId, fiscalYear]);

    const fetchColaboradorStatusSummary = useCallback(async (serviceStatus = 'ACTIVE') => {
        if (!corporationId) return;
        try {
            const response = await api.get(`/corporations/${corporationId}/colaboradores/status-summary`, {
                headers: { Authorization: `Bearer ${auth.token}` },
                params: { fiscalYear, serviceStatus }
            });
            const summary = response.data.summary || {};
            setColaboradorStatusSummary({ total: summary.total || 0 });
        } catch (err) {
            console.error('Error fetching colaborador status summary:', err);
            setColaboradorStatusSummary({ total: 0 });
        }
    }, [auth.token, corporationId, fiscalYear]);

    // Obtiene contadores globales: cuántos colaboradores usan vs no usan el servicio
    const fetchColaboradorUsageSummary = useCallback(async () => {
        if (!corporationId) return;
        const USING     = ['ACTIVE', 'SUSPENDED'];
        const NOT_USING = ['PAUSED', 'INACTIVE'];
        const allStatuses = [...USING, ...NOT_USING];
        try {
            const results = await Promise.all(
                allStatuses.map(s =>
                    api.get(`/corporations/${corporationId}/colaboradores/status-summary`, {
                        headers: { Authorization: `Bearer ${auth.token}` },
                        params: { fiscalYear, serviceStatus: s }
                    }).then(r => ({ status: s, total: r.data.summary?.total || 0 }))
                    .catch(() => ({ status: s, total: 0 }))
                )
            );
            const countMap = Object.fromEntries(results.map(r => [r.status, r.total]));
            setServiceUsageSummary({
                colaboradoresUsing:    USING.reduce((acc, s) => acc + (countMap[s] || 0), 0),
                colaboradoresNotUsing: NOT_USING.reduce((acc, s) => acc + (countMap[s] || 0), 0)
            });
        } catch (err) {
            console.error('Error fetching colaborador usage summary:', err);
        }
    }, [auth.token, corporationId, fiscalYear]);

    useEffect(() => {
        if (auth.token && corporationId) {
            setLoading(true);
            Promise.all([
                fetchCorporationData(),
                fetchRouteOccupancy(),
                fetchColaboradorSummary(),
                fetchColaboradorStatusSummary(CAROUSEL_STATUSES[statusSlideIndexRef.current].key),
                fetchColaboradorUsageSummary()
            ]).finally(() => {
                setLoading(false);
            });
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchRouteOccupancy, fetchColaboradorSummary, fetchColaboradorStatusSummary, fetchColaboradorUsageSummary]);

    useRegisterPageRefresh(async () => {
        setLoading(true);
        const currentStatus = CAROUSEL_STATUSES[statusSlideIndexRef.current].key;
        try {
            await Promise.all([
                fetchCorporationData(),
                fetchRouteOccupancy(),
                fetchColaboradorSummary(),
                fetchColaboradorStatusSummary(currentStatus),
                fetchColaboradorUsageSummary()
            ]);
        } finally {
            setLoading(false);
        }
    }, [fetchCorporationData, fetchRouteOccupancy, fetchColaboradorSummary, fetchColaboradorStatusSummary, fetchColaboradorUsageSummary]);

    const handleBackToSelection = () => {
        navigate('/admin/corporaciones');
    };

    const handleViewColaboradores = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/colaboradores`, {
            state: {
                fiscalYear: fiscalYear || stateFiscalYear,
                corporation: corporationData || stateCorporation
            }
        });
    };

    const handleViewBuses = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/buses-gestion`, {
            state: {
                fiscalYear: fiscalYear || stateFiscalYear,
                corporation: corporationData || stateCorporation
            }
        });
    };

    const handleViewProtocols = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/protocolos`, {
            state: {
                fiscalYear: fiscalYear || stateFiscalYear,
                corporation: corporationData || stateCorporation
            }
        });
    };

    // Manejador para abrir el modal de colaboradores por ruta
    const handleOpenRouteModal = (routeNumber, scheduleIndex, scheduleName, stopType) => {
        setSelectedRoute({
            routeNumber,
            scheduleIndex,
            scheduleName,
            stopType
        });
        setModalOpen(true);
    };

    const handleCloseRouteModal = () => {
        setModalOpen(false);
        setSelectedRoute({
            routeNumber: null,
            scheduleIndex: null,
            scheduleName: '',
            stopType: ''
        });
    };

    // Exportar PDF de ocupación de rutas (se usa la versión que exporta TODOS los días)

    // Exportar PDF para TODOS los días (flujo colegios)
    const handleExportPDFAll = async () => {
        if (!corporationId) {
            setSnackbar({ open: true, message: 'Corporación no seleccionada', severity: 'error' });
            return;
        }

        const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        const schedules = currentCorporation?.schedules || [];

        try {
            // Hacer peticiones paralelas por día y recoger las rutas por día
            const promises = dayKeys.map(d => api.get(`/routes/occupancy-corporate/${corporationId}`, {
                headers: { Authorization: `Bearer ${auth.token}` },
                params: { fiscalYear: currentFiscalYear || fiscalYear, day: d }
            }).then(resp => ({ day: d, data: resp.data })).catch(err => {
                console.warn(`Warning: error fetching occupancy for ${d}`, err);
                return { day: d, data: null };
            }));

            const results = await Promise.all(promises);

            const dayMap = {};
            results.forEach(r => {
                if (r.data && (r.data.routes || Array.isArray(r.data))) {
                    // Algunos endpoints devuelven { routes: [...] }, otros devuelven directamente array
                    dayMap[r.day] = r.data.routes || r.data;
                } else {
                    dayMap[r.day] = [];
                }
            });

            // Generar PDF con el dayMap
            generateCorporateRouteOccupancyPDF(dayMap, {
                corporationName: currentCorporation?.name || '',
                fiscalYear: currentFiscalYear || '',
                generatedAt: new Date(),
                schedules,
                dayLabels: {
                    monday: 'Lunes',
                    tuesday: 'Martes',
                    wednesday: 'Miércoles',
                    thursday: 'Jueves',
                    friday: 'Viernes',
                    saturday: 'Sábado',
                    sunday: 'Domingo'
                }
            });

            setSnackbar({ open: true, message: 'PDF generado exitosamente', severity: 'success' });
        } catch (err) {
            console.error('Error exporting PDF (all days):', err);
            setSnackbar({ open: true, message: 'Error al generar PDF', severity: 'error' });
        }
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

    // Carrusel: navegar entre estados de servicio y refrescar el contador
    const handleSlideChange = (delta) => {
        const newIndex = (statusSlideIndex + delta + CAROUSEL_STATUSES.length) % CAROUSEL_STATUSES.length;
        setStatusSlideIndex(newIndex);
        fetchColaboradorStatusSummary(CAROUSEL_STATUSES[newIndex].key);
    };

    const activeCarouselStatus = CAROUSEL_STATUSES[statusSlideIndex];

    const currentCorporation = corporationData || stateCorporation;
    const currentFiscalYear = fiscalYear || stateFiscalYear;

    if (loading && !currentCorporation) {
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
                        <CorporationIcon sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h4" component="h1" gutterBottom>
                                {currentCorporation?.name || 'Cargando...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Chip 
                                    icon={<CalendarToday />}
                                    label={`Año Fiscal ${currentFiscalYear}`}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                {currentCorporation?.industry && (
                                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                                        {currentCorporation.industry}
                                    </Typography>
                                )}
                                <Chip 
                                    label={currentCorporation?.isActive ? 'Activa' : 'Inactiva'}
                                    color={currentCorporation?.isActive ? 'success' : 'default'}
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <DirectionsBus color="primary" />
                                    Resumen de Ocupación por Ruta
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="medium"
                                    onClick={async () => { await handleExportPDFAll(); }}
                                    disabled={false}
                                    sx={{ textTransform: 'uppercase' }}
                                >
                                    EXPORTAR PDF (TODOS LOS DÍAS)
                                </Button>
                            </Box>
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
                                        <MenuItem value="saturday">Sábado</MenuItem>
                                        <MenuItem value="sunday">Domingo</MenuItem>
                                    </Select>
                                </FormControl>
                                <Typography variant="body2" color="textSecondary">
                                    {`Mostrando solo ${getDayLabel(selectedDay)}`}
                                </Typography>
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
                                        No hay rutas configuradas para esta corporación
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} sx={{ maxHeight: 600, boxShadow: 'none', elevation: 0 }}>
                                    <Table stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell rowSpan={2}>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Ruta
                                                    </Typography>
                                                </TableCell>
                                                {(corporationData?.schedules || []).map((schedule, idx) => (
                                                    <TableCell key={idx} align="center" colSpan={2}>
                                                        <Typography variant="subtitle2" fontWeight="bold">
                                                            {schedule.name}
                                                        </Typography>
                                                    </TableCell>
                                                ))}
                                                <TableCell rowSpan={2} align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        Total
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                {(corporationData?.schedules || []).map((schedule, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <TableCell align="center">
                                                            <Typography variant="caption" fontWeight="bold">
                                                                Entrada
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Typography variant="caption" fontWeight="bold">
                                                                Salida
                                                            </Typography>
                                                        </TableCell>
                                                    </React.Fragment>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {routeOccupancy.map((route) => {
                                                // Calculate row total
                                                let rowTotal = 0;
                                                Object.values(route.schedules || {}).forEach(sched => {
                                                    rowTotal += (sched.entrada || 0) + (sched.salida || 0);
                                                });
                                                
                                                return (
                                                    <TableRow key={route.routeNumber} hover>
                                                        <TableCell>
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                Ruta {route.routeNumber}
                                                            </Typography>
                                                        </TableCell>
                                                        {(corporationData?.schedules || []).map((schedule, idx) => {
                                                            const schedData = route.schedules?.[idx] || { entrada: 0, salida: 0 };
                                                            return (
                                                                <React.Fragment key={idx}>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            label={schedData.entrada || 0}
                                                                            size="small"
                                                                            color={schedData.entrada > 0 ? 'primary' : 'default'}
                                                                            sx={{ minWidth: 40, cursor: schedData.entrada > 0 ? 'pointer' : 'default' }}
                                                                            onClick={() => {
                                                                                if (schedData.entrada > 0) {
                                                                                    handleOpenRouteModal(
                                                                                        route.routeNumber,
                                                                                        idx,
                                                                                        schedule.name,
                                                                                        'entrada'
                                                                                    );
                                                                                }
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            label={schedData.salida || 0}
                                                                            size="small"
                                                                            color={schedData.salida > 0 ? 'secondary' : 'default'}
                                                                            sx={{ minWidth: 40, cursor: schedData.salida > 0 ? 'pointer' : 'default' }}
                                                                            onClick={() => {
                                                                                if (schedData.salida > 0) {
                                                                                    handleOpenRouteModal(
                                                                                        route.routeNumber,
                                                                                        idx,
                                                                                        schedule.name,
                                                                                        'salida'
                                                                                    );
                                                                                }
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                        <TableCell align="center">
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                {rowTotal}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {/* Total row */}
                                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                                <TableCell>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        Total
                                                    </Typography>
                                                </TableCell>
                                                {(corporationData?.schedules || []).map((schedule, idx) => {
                                                    let totalEntrada = 0;
                                                    let totalSalida = 0;
                                                    routeOccupancy.forEach(route => {
                                                        const schedData = route.schedules?.[idx] || { entrada: 0, salida: 0 };
                                                        totalEntrada += schedData.entrada || 0;
                                                        totalSalida += schedData.salida || 0;
                                                    });
                                                    return (
                                                        <React.Fragment key={idx}>
                                                            <TableCell align="center">
                                                                <Typography variant="subtitle1" fontWeight="bold">
                                                                    {totalEntrada}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Typography variant="subtitle1" fontWeight="bold">
                                                                    {totalSalida}
                                                                </Typography>
                                                            </TableCell>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <TableCell align="center">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {routeOccupancy.reduce((sum, route) => {
                                                            let routeTotal = 0;
                                                            Object.values(route.schedules || {}).forEach(sched => {
                                                                routeTotal += (sched.entrada || 0) + (sched.salida || 0);
                                                            });
                                                            return sum + routeTotal;
                                                        }, 0)}
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

                {/* Sección B: Right column with summary and actions */}
                <Grid item xs={12} lg={4}>
                    <Grid container spacing={3}>
                        {/* Uso del Servicio */}
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
                                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                                                    <Box>
                                                        <Typography variant="h5" color="success.main" fontWeight="bold">
                                                            {serviceUsageSummary.colaboradoresUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Colaboradores
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.75 }}>
                                                    Activo
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
                                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                                                    <Box>
                                                        <Typography variant="h5" color="text.secondary" fontWeight="bold">
                                                            {serviceUsageSummary.colaboradoresNotUsing}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Colaboradores
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

                        {/* Colaboradores - carrusel por estado del servicio */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp color="primary" />
                                        Colaboradores
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />

                                    {/* Carrusel: flechas + contador grande */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                        <IconButton size="small" onClick={() => handleSlideChange(-1)} aria-label="Estado anterior">
                                            <ChevronLeft />
                                        </IconButton>
                                        <Box sx={{ textAlign: 'center', minWidth: 130 }}>
                                            <Typography variant="h3" sx={{ color: activeCarouselStatus.textColor }} fontWeight="bold">
                                                {colaboradorStatusSummary.total}
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
                                                onClick={() => { setStatusSlideIndex(i); fetchColaboradorStatusSummary(s.key); }}
                                                sx={{
                                                    width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                                                    backgroundColor: i === statusSlideIndex ? 'primary.main' : 'grey.300',
                                                    transition: 'background-color 0.2s'
                                                }}
                                            />
                                        ))}
                                    </Box>

                                    <Divider sx={{ my: 1 }} />

                                    {colaboradorSummary.byDepartment.length > 0 && (
                                        <>
                                            <Divider sx={{ my: 1 }} />
                                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                Por Departamento:
                                            </Typography>
                                            <List dense>
                                                {colaboradorSummary.byDepartment.map((dept, idx) => (
                                                    <ListItem key={idx} disableGutters>
                                                        <ListItemIcon sx={{ minWidth: 28 }}>
                                                            <DepartmentIcon fontSize="small" />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={dept.name}
                                                            secondary={`${dept.count} colaboradores`}
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </>
                                    )}
                                </CardContent>
                            </SummaryCard>
                        </Grid>

                        {/* Action cards */}
                        <Grid item xs={12}>
                            <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 1 }}>
                                <Grid container spacing={2}>
                                    {/* Gestión de Colaboradores */}
                                    <Grid item xs={12}>
                                        <SummaryCard>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <People sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                <Typography variant="h6" gutterBottom>
                                                    Gestión de Colaboradores
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                    Ver y gestionar todos los colaboradores registrados en esta corporación
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="large"
                                                    startIcon={<Group />}
                                                    onClick={handleViewColaboradores}
                                                    fullWidth
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    Ver Colaboradores
                                                </Button>
                                            </CardContent>
                                        </SummaryCard>
                                    </Grid>

                                    {/* Gestión de Buses */}
                                    <Grid item xs={12}>
                                        <SummaryCard>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <DirectionsBus sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                <Typography variant="h6" gutterBottom>
                                                    Gestión de Buses
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                    Ver y gestionar los buses asignados a esta corporación
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

                                    {/* Gestión de Protocolos y Reglamentos */}
                                    <Grid item xs={12}>
                                        <SummaryCard>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <ContractIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                                <Typography variant="h6" gutterBottom>
                                                    Protocolos y Reglamentos
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                    Ver y gestionar los protocolos y reglamentos de esta corporación
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="large"
                                                    startIcon={<ContractIcon />}
                                                    onClick={handleViewProtocols}
                                                    fullWidth
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    Ver Protocolos
                                                </Button>
                                            </CardContent>
                                        </SummaryCard>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            {/* Snackbar de notificaciones */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Modal de colaboradores por ruta */}
            <RouteColaboradoresModal
                open={modalOpen}
                onClose={handleCloseRouteModal}
                routeNumber={selectedRoute.routeNumber}
                scheduleIndex={selectedRoute.scheduleIndex}
                scheduleName={selectedRoute.scheduleName}
                stopType={selectedRoute.stopType}
                corporationId={corporationId}
                fiscalYear={currentFiscalYear}
                selectedDay={selectedDay}
            />
        </PageContainer>
    );
};

export default CorporateDashboardPage;
