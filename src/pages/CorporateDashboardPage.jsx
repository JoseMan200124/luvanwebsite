// src/pages/CorporateDashboardPage.jsx

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
    Business as CorporationIcon, 
    CalendarToday,
    DirectionsBus,
    Group,
    ArrowBack,
    TrendingUp,
    People,
    Description as ContractIcon,
    Work as DepartmentIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';
import RouteEmployeesModal from '../components/modals/RouteEmployeesModal';
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

const CorporateDashboardPage = () => {
    const { auth } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { fiscalYear, corporationId } = useParams();

    const [corporationData, setCorporationData] = useState(null);
    const [routeOccupancy, setRouteOccupancy] = useState([]);
    const [employeeSummary, setEmployeeSummary] = useState({
        total: 0,
        active: 0,
        byDepartment: []
    });
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Estado para el filtro de día (default Lunes)
    const [selectedDay, setSelectedDay] = useState('monday');
    
    // Estado para el modal de empleados por ruta
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

    const fetchEmployeeSummary = useCallback(async () => {
        if (!corporationId) return;
        
        try {
            const response = await api.get(`/corporations/${corporationId}/employees`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                params: {
                    fiscalYear: fiscalYear
                }
            });
            
            const employees = response.data.employees || [];
            
            // Count by department
            const departmentCounts = {};
            employees.forEach(emp => {
                if (emp.FamilyDetail?.department) {
                    const dept = emp.FamilyDetail.department;
                    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
                }
            });
            
            const byDepartment = Object.entries(departmentCounts).map(([name, count]) => ({
                name,
                count
            }));
            
            setEmployeeSummary({
                total: employees.length,
                active: employees.filter(emp => Number(emp.state) === 1).length,
                byDepartment
            });
        } catch (err) {
            console.error('Error fetching employee summary:', err);
            // Por ahora usamos datos de ejemplo
            setEmployeeSummary({
                total: 45,
                active: 42,
                byDepartment: []
            });
        }
    }, [auth.token, corporationId, fiscalYear]);

    useEffect(() => {
        if (auth.token && corporationId) {
            setLoading(true);
            Promise.all([
                fetchCorporationData(),
                fetchRouteOccupancy(),
                fetchEmployeeSummary()
            ]).finally(() => {
                setLoading(false);
            });
        }
    }, [auth.token, corporationId, fetchCorporationData, fetchRouteOccupancy, fetchEmployeeSummary]);

    const handleBackToSelection = () => {
        navigate('/admin/corporaciones');
    };

    const handleViewEmployees = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/empleados`, {
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

    // Manejador para abrir el modal de empleados por ruta
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
                        {/* Resumen de empleados */}
                        <Grid item xs={12}>
                            <SummaryCard>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp color="primary" />
                                        Colaboradores Registrados
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    
                                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                                        <Typography variant="h3" color="primary" fontWeight="bold">
                                            {employeeSummary.total}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Total de colaboradores
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
                                                primary="Activos" 
                                                secondary={`${employeeSummary.active} colaboradores`}
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon>
                                                <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: 'grey.500' 
                                                }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Inactivos" 
                                                secondary={`${employeeSummary.total - employeeSummary.active} colaboradores`}
                                            />
                                        </ListItem>
                                    </List>

                                    {employeeSummary.byDepartment.length > 0 && (
                                        <>
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                Por Departamento:
                                            </Typography>
                                            <List dense>
                                                {employeeSummary.byDepartment.map((dept, idx) => (
                                                    <ListItem key={idx}>
                                                        <ListItemIcon>
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

                        {/* Gestión de Empleados */}
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
                                        onClick={handleViewEmployees}
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

            {/* Modal de empleados por ruta */}
            <RouteEmployeesModal
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
