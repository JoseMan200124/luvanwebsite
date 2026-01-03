import React, { useState, useEffect, useContext } from 'react';
import {
    Typography,
    Box,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Snackbar,
    Alert,
    CircularProgress,
    Switch,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Grid,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Save as SaveIcon,
    Dashboard as DashboardIcon,
    ViewModule as ViewModuleIcon,
    Storage as StorageIcon,
} from '@mui/icons-material';
import tw from 'twin.macro';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const PageContainer = tw.div`p-8 bg-gray-50 min-h-screen`;

const PermissionsManagementPage = () => {
    const { auth } = useContext(AuthContext);

    // Estados
    const [roles, setRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [permissions, setPermissions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    // Módulos del frontend agrupados
    const frontendModules = [
        {
            category: 'Panel Principal',
            icon: <DashboardIcon />,
            modules: [
                { key: 'dashboard', label: 'Dashboard' },
            ]
        },
        {
            category: 'Gestión de Usuarios y Roles',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'usuarios', label: 'Usuarios' },
            ]
        },
        {
            category: 'Gestión de Clientes y Rutas',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'colegios', label: 'Colegios' },
                { key: 'corporaciones', label: 'Corporaciones' },
                { key: 'buses', label: 'Buses' },
                { key: 'carga-masiva-horarios', label: 'Carga Masiva de Horarios' },
            ]
        },
        {
            category: 'Reportes y Estadísticas',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'reportes-uso', label: 'Reportes de Uso' },
                { key: 'estadisticas-financieras', label: 'Estadísticas Financieras' },
            ]
        },
        {
            category: 'Gestión de Personal',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'monitores', label: 'Monitores' },
                { key: 'pilotos', label: 'Pilotos' },
                { key: 'supervisores', label: 'Supervisores' },
                { key: 'auxiliares', label: 'Auxiliares' },
            ]
        },
        {
            category: 'Operaciones Móviles',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'asistencias', label: 'Asistencias' },
                { key: 'incidentes-conducta', label: 'Reportes de Conducta' },
                { key: 'incidentes-buses', label: 'Incidentes de Buses' },
                { key: 'emergencias-buses', label: 'Emergencias de Buses' },
                { key: 'solicitudes-mecanica', label: 'Solicitudes de Mecánica' },
                { key: 'horarios-rutas', label: 'Horarios de Rutas' },
                { key: 'registros-combustible', label: 'Registros de Combustible' },
            ]
        },
        {
            category: 'Seguridad y Auditoría',
            icon: <ViewModuleIcon />,
            modules: [
                { key: 'registro-actividades', label: 'Registro de Actividades' },
            ]
        },
    ];

    // Endpoints del backend agrupados por módulo
    const backendEndpoints = [
        {
            module: 'Dashboard',
            endpoints: [
                { key: 'dashboard-ver', label: 'Ver Dashboard' },
            ]
        },
        {
            module: 'Usuarios',
            endpoints: [
                { key: 'usuarios-listar', label: 'Listar Usuarios' },
                { key: 'usuarios-crear', label: 'Crear Usuario' },
                { key: 'usuarios-editar', label: 'Editar Usuario' },
                { key: 'usuarios-eliminar', label: 'Eliminar Usuario' },
                { key: 'usuarios-eliminar-permanente', label: 'Eliminar Permanentemente' },
                { key: 'usuarios-listar-pilotos', label: 'Listar Pilotos' },
                { key: 'usuarios-listar-monitoras', label: 'Listar Monitoras' },
                { key: 'usuarios-listar-padres', label: 'Listar Padres' },
                { key: 'usuarios-carga-masiva', label: 'Carga Masiva' },
                { key: 'usuarios-activar', label: 'Activar Usuario' },
                { key: 'usuarios-cambiar-estado', label: 'Cambiar Estado' },
            ]
        },
        {
            module: 'Colegios',
            endpoints: [
                { key: 'colegios-listar', label: 'Listar Colegios' },
                { key: 'colegios-crear', label: 'Crear Colegio' },
                { key: 'colegios-editar', label: 'Editar Colegio' },
                { key: 'colegios-eliminar', label: 'Eliminar Colegio' },
                { key: 'colegios-ver-detalle', label: 'Ver Detalle' },
                { key: 'colegios-ver-horarios', label: 'Ver Horarios' },
                { key: 'colegios-ver-inscripciones', label: 'Ver Inscripciones' },
                { key: 'colegios-carga-masiva', label: 'Carga Masiva' },
            ]
        },
        {
            module: 'Corporaciones',
            endpoints: [
                { key: 'corporaciones-listar', label: 'Listar Corporaciones' },
                { key: 'corporaciones-crear', label: 'Crear Corporación' },
                { key: 'corporaciones-editar', label: 'Editar Corporación' },
                { key: 'corporaciones-desactivar', label: 'Desactivar Corporación' },
                { key: 'corporaciones-ver-detalle', label: 'Ver Detalle' },
                { key: 'corporaciones-listar-colaboradores', label: 'Ver Colaboradores' },
            ]
        },
        {
            module: 'Buses',
            endpoints: [
                { key: 'buses-listar', label: 'Listar Buses' },
                { key: 'buses-crear', label: 'Crear Bus' },
                { key: 'buses-editar', label: 'Editar Bus' },
                { key: 'buses-eliminar', label: 'Eliminar Bus' },
                { key: 'buses-marcar-taller', label: 'Marcar en Taller' },
                { key: 'buses-carga-masiva', label: 'Carga Masiva' },
            ]
        },
        {
            module: 'Pagos',
            endpoints: [
                { key: 'pagos-listar', label: 'Listar Pagos' },
                { key: 'pagos-ver-detalle', label: 'Ver Detalle de Pago' },
                { key: 'pagos-registrar', label: 'Registrar Pago' },
                { key: 'pagos-editar', label: 'Editar Pago' },
                { key: 'pagos-eliminar', label: 'Eliminar Pago' },
                { key: 'pagos-estadisticas', label: 'Ver Estadísticas' },
            ]
        },
        {
            module: 'Personal (Listados)',
            endpoints: [
                { key: 'staff-listar-monitoras', label: 'Listar Monitores' },
                { key: 'staff-listar-pilotos', label: 'Listar Pilotos' },
                { key: 'staff-listar-supervisores', label: 'Listar Supervisores' },
                { key: 'staff-listar-auxiliares', label: 'Listar Auxiliares' },
                { key: 'usuarios-listar-pilotos', label: 'Listar Pilotos (Users)' },
                { key: 'usuarios-listar-monitoras', label: 'Listar Monitoras (Users)' },
            ]
        },
        {
            module: 'Incidentes y Emergencias',
            endpoints: [
                { key: 'incidentes-buses-listar', label: 'Listar Incidentes' },
                { key: 'incidentes-buses-ver-detalle', label: 'Ver Detalle' },
                { key: 'incidentes-buses-eliminar', label: 'Eliminar Incidente' },
                { key: 'emergencias-buses-listar', label: 'Listar Emergencias' },
                { key: 'emergencias-buses-ver-detalle', label: 'Ver Detalle' },
                { key: 'emergencias-buses-eliminar', label: 'Eliminar Emergencia' },
            ]
        },
        {
            module: 'Reportes',
            endpoints: [
                { key: 'reportes-uso-general', label: 'Reporte General de Uso' },
                { key: 'reportes-financieros', label: 'Reportes Financieros' },
                { key: 'reportes-asistencias', label: 'Reportes de Asistencias' },
            ]
        },
    ];

    // Cargar roles
    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await api.get('/permissions/roles', {
                    headers: { Authorization: `Bearer ${auth?.token}` },
                });
                setRoles(res.data.roles || []);
            } catch (err) {
                console.error('Error al obtener roles:', err);
                showSnackbar('Error al cargar roles', 'error');
            }
        };

        if (auth?.token) {
            fetchRoles();
        }
    }, [auth?.token]);

    // Cargar permisos del rol seleccionado
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!selectedRoleId) {
                setPermissions({});
                return;
            }

            setIsLoading(true);
            try {
                const res = await api.get(`/permissions/role/${selectedRoleId}`, {
                    headers: { Authorization: `Bearer ${auth?.token}` },
                });
                setPermissions(res.data.permissions || {});
            } catch (err) {
                console.error('Error al obtener permisos:', err);
                showSnackbar('Error al cargar permisos', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPermissions();
    }, [selectedRoleId, auth?.token]);

    const handlePermissionToggle = (key) => {
        setPermissions((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSavePermissions = async () => {
        if (!selectedRoleId) return;

        setIsSaving(true);
        try {
            await api.put(
                `/permissions/role/${selectedRoleId}`,
                { permissions },
                { headers: { Authorization: `Bearer ${auth?.token}` } }
            );
            showSnackbar('Permisos actualizados exitosamente', 'success');
        } catch (err) {
            console.error('Error al actualizar permisos:', err);
            showSnackbar('Error al actualizar permisos', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const showSnackbar = (message, severity) => {
        setSnackbar({ open: true, message, severity });
    };

    const getSelectedRole = () => {
        return roles.find(r => r.id === selectedRoleId);
    };

    const countActivePermissions = (moduleList) => {
        return moduleList.filter(m => permissions[m.key]).length;
    };

    return (
        <PageContainer>
            <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#1a237e', mb: 1 }}>
                        Gestión de Permisos
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#666' }}>
                        Configura los permisos de acceso para cada rol del sistema
                    </Typography>
                </Box>

                {/* Selector de Rol */}
                <Card sx={{ mb: 3, boxShadow: 2 }}>
                    <CardContent>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Seleccionar Rol</InputLabel>
                                    <Select
                                        value={selectedRoleId}
                                        onChange={(e) => setSelectedRoleId(e.target.value)}
                                        label="Seleccionar Rol"
                                    >
                                        <MenuItem value="">
                                            <em>-- Seleccionar --</em>
                                        </MenuItem>
                                        {roles.map((role) => (
                                            <MenuItem key={role.id} value={role.id}>
                                                {role.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            {selectedRoleId && (
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                        <Chip 
                                            label={`Rol: ${getSelectedRole()?.name}`}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>
                                </Grid>
                            )}
                        </Grid>
                    </CardContent>
                </Card>

                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {!isLoading && selectedRoleId && (
                    <>
                        {/* Permisos del Frontend */}
                        <Card sx={{ mb: 3, boxShadow: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <ViewModuleIcon sx={{ mr: 1, color: '#1976d2' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Acceso a Módulos de la Aplicación
                                    </Typography>
                                </Box>
                                <Divider sx={{ mb: 2 }} />

                                {frontendModules.map((category, idx) => (
                                    <Accordion key={idx} sx={{ mb: 1, boxShadow: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                {category.icon}
                                                <Typography sx={{ ml: 1, fontWeight: 500, flexGrow: 1 }}>
                                                    {category.category}
                                                </Typography>
                                                <Chip 
                                                    size="small"
                                                    label={`${countActivePermissions(category.modules)} / ${category.modules.length}`}
                                                    color={countActivePermissions(category.modules) > 0 ? "success" : "default"}
                                                    sx={{ mr: 1 }}
                                                />
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={2}>
                                                {category.modules.map((module) => (
                                                    <Grid item xs={12} sm={6} md={4} key={module.key}>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                p: 1.5,
                                                                borderRadius: 1,
                                                                bgcolor: permissions[module.key] ? '#e3f2fd' : '#f5f5f5',
                                                                transition: 'all 0.2s',
                                                                '&:hover': {
                                                                    bgcolor: permissions[module.key] ? '#bbdefb' : '#eeeeee',
                                                                }
                                                            }}
                                                        >
                                                            <Typography variant="body2">
                                                                {module.label}
                                                            </Typography>
                                                            <Switch
                                                                checked={!!permissions[module.key]}
                                                                onChange={() => handlePermissionToggle(module.key)}
                                                                color="primary"
                                                            />
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Permisos del Backend (Endpoints) 
                        <Card sx={{ mb: 3, boxShadow: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <StorageIcon sx={{ mr: 1, color: '#1976d2' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Permisos de Endpoints (API)
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                                    Controla qué acciones específicas puede realizar este rol en el sistema
                                </Typography>
                                <Divider sx={{ mb: 2 }} />

                                {backendEndpoints.map((category, idx) => (
                                    <Accordion key={idx} sx={{ mb: 1, boxShadow: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                <Typography sx={{ fontWeight: 500, flexGrow: 1 }}>
                                                    {category.module}
                                                </Typography>
                                                <Chip 
                                                    size="small"
                                                    label={`${countActivePermissions(category.endpoints)} / ${category.endpoints.length}`}
                                                    color={countActivePermissions(category.endpoints) > 0 ? "success" : "default"}
                                                    sx={{ mr: 1 }}
                                                />
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={2}>
                                                {category.endpoints.map((endpoint) => (
                                                    <Grid item xs={12} sm={6} md={4} key={endpoint.key}>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                p: 1.5,
                                                                borderRadius: 1,
                                                                bgcolor: permissions[endpoint.key] ? '#e8f5e9' : '#f5f5f5',
                                                                transition: 'all 0.2s',
                                                                '&:hover': {
                                                                    bgcolor: permissions[endpoint.key] ? '#c8e6c9' : '#eeeeee',
                                                                }
                                                            }}
                                                        >
                                                            <Typography variant="body2">
                                                                {endpoint.label}
                                                            </Typography>
                                                            <Switch
                                                                checked={!!permissions[endpoint.key]}
                                                                onChange={() => handlePermissionToggle(endpoint.key)}
                                                                color="success"
                                                            />
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </CardContent>
                        </Card>
                        */}

                        {/* Botón Guardar */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                onClick={handleSavePermissions}
                                disabled={isSaving}
                                sx={{ 
                                    px: 4,
                                    py: 1.5,
                                    bgcolor: '#1976d2',
                                    '&:hover': { bgcolor: '#1565c0' }
                                }}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </Box>
                    </>
                )}
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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

export default PermissionsManagementPage;
