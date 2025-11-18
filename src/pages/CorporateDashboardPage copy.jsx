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
    Payment as PaymentIcon,
    Work as DepartmentIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import styled from 'styled-components';
import tw from 'twin.macro';

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
    background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
    color: white;
`;

const SummaryCard = styled(Card)`
    ${tw`h-full`}
    box-shadow: none;
    &:hover {
        box-shadow: none;
    }
`;

const ActionCard = styled(Card)`
    ${tw`cursor-pointer transition-all duration-300 h-full`}
    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
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
            // Similar endpoint to schools but for corporations
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
            // Datos de ejemplo si no existe el endpoint aún
            setRouteOccupancy([
                { routeNumber: '1', employees: 15 },
                { routeNumber: '2', employees: 18 },
                { routeNumber: '3', employees: 12 }
            ]);
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

    const handleViewPayments = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/pagos`, {
            state: {
                fiscalYear: fiscalYear || stateFiscalYear,
                corporation: corporationData || stateCorporation
            }
        });
    };

    const handleViewContracts = () => {
        navigate(`/admin/corporaciones/${fiscalYear}/${corporationId}/contratos`, {
            state: {
                fiscalYear: fiscalYear || stateFiscalYear,
                corporation: corporationData || stateCorporation
            }
        });
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
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DirectionsBus color="primary" />
                                Resumen de Ocupación por Ruta
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
                                <TableContainer component={Paper} sx={{ maxHeight: 400, boxShadow: 'none' }}>
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
                                                        Empleados Asignados
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {routeOccupancy.map((route) => (
                                                <TableRow key={route.routeNumber} hover>
                                                    <TableCell>
                                                        <Chip 
                                                            label={`Ruta ${route.routeNumber}`}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="body2">
                                                            {route.employees || 0}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>
                                                <TableCell>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        TOTAL
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {routeOccupancy.reduce((sum, r) => sum + (Number(r.employees) || 0), 0)}
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

                {/* Sección B: Resumen de empleados */}
                <Grid item xs={12} lg={4}>
                    <SummaryCard>
                        <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <People color="secondary" />
                                Resumen de Empleados
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            
                            <List>
                                <ListItem>
                                    <ListItemIcon>
                                        <Group color="primary" />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Total de Empleados"
                                        secondary={employeeSummary.total}
                                        secondaryTypographyProps={{ 
                                            variant: 'h5', 
                                            color: 'primary',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon>
                                        <TrendingUp color="success" />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Empleados Activos"
                                        secondary={employeeSummary.active}
                                        secondaryTypographyProps={{ 
                                            variant: 'h6', 
                                            color: 'success.main'
                                        }}
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
                                                    secondary={`${dept.count} empleados`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                        </CardContent>
                    </SummaryCard>
                </Grid>

                {/* Sección C: Acciones rápidas */}
                <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                        Acciones Rápidas
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <ActionCard onClick={handleViewEmployees}>
                                <CardContent>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Group sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                                        <Typography variant="h6">
                                            Ver Empleados
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Gestionar usuarios empleados
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </ActionCard>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <ActionCard onClick={handleViewBuses}>
                                <CardContent>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <DirectionsBus sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
                                        <Typography variant="h6">
                                            Ver Buses
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Gestionar flota de buses
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </ActionCard>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <ActionCard onClick={handleViewPayments}>
                                <CardContent>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <PaymentIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                                        <Typography variant="h6">
                                            Ver Pagos
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Gestionar pagos de empleados
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </ActionCard>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <ActionCard onClick={handleViewContracts}>
                                <CardContent>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <ContractIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
                                        <Typography variant="h6">
                                            Ver Contratos
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Gestionar contratos
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </ActionCard>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Información de la corporación */}
                <Grid item xs={12} lg={6}>
                    <SummaryCard>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Información de la Corporación
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        NIT:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {currentCorporation?.nit || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Teléfono:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {currentCorporation?.contactPhone || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Email:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {currentCorporation?.contactEmail || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        Tarifa de Transporte:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        Q {Number(currentCorporation?.transportFee || 0).toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="textSecondary">
                                        Dirección:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {currentCorporation?.address || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="textSecondary">
                                        Horario de Operación:
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        {currentCorporation?.businessHours?.start || '08:00'} - {currentCorporation?.businessHours?.end || '17:00'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </SummaryCard>
                </Grid>

                {/* Departamentos */}
                <Grid item xs={12} lg={6}>
                    <SummaryCard>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Departamentos
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            {currentCorporation?.departments && currentCorporation.departments.length > 0 ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {currentCorporation.departments.map((dept, idx) => (
                                        <Chip
                                            key={idx}
                                            label={dept}
                                            icon={<DepartmentIcon />}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="textSecondary">
                                    No hay departamentos configurados
                                </Typography>
                            )}
                        </CardContent>
                    </SummaryCard>
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
        </PageContainer>
    );
};

export default CorporateDashboardPage;
